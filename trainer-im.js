'use strict';
/* Tonfunk Lab: Trainer "Erste Schritte" für die 14 Industriemechaniker-Labs (fer, tol, zer, wer, fug, mas, mch, mak, cnc, pne, hyd, ins, zei, kon).
   Wird NACH trainer.js geladen und hängt je Lab ein Skript an Trainer.SCRIPTS (gleiche Datensatzform: prep, at, gate, optional, t, x).
   Die IM-Labs sind Seiten-Labs mit Reiterband (labrahmen.js) statt Prüfstand. Deshalb stellt diese Datei auch window.LabTrainerAPI bereit
   (nur wenn das Lab selbst keine setzt): lab, tab(), go(k) und Zähler für Klicks und Eingaben an echten Bedienelementen.
   Abschluss: trainer.js setzt lm4.trainer[lab]. Die IM-Labs laden badges.js nicht, darum trägt diese Datei den Zähler lm4.stats.trainer nach
   (gleiche Rechnung wie trainer.js), damit die Abzeichen "einsteiger" und "trainer5" beim nächsten Abzeichen-Check zählen.
   Im Menü des Labs kommt die Zeile "Trainer: Erste Schritte" dazu. */
(function (root) {
  var doc = root.document; if (!doc || !root.Trainer || !root.Trainer.SCRIPTS) return;
  var LAB = root.LAB, SC = root.Trainer.SCRIPTS;
  var IM = { fer: 1, tol: 1, zer: 1, wer: 1, fug: 1, mas: 1, mch: 1, mak: 1, cnc: 1, pne: 1, hyd: 1, ins: 1, zei: 1, kon: 1 };
  if (!IM[LAB] || SC[LAB]) return;

  /* ------------------------------------------------------------------ Helfer */
  function vis(el) { if (!el || !el.getBoundingClientRect) return false; var r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; var cs = root.getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; }
  function all(sel) { try { return Array.prototype.slice.call(doc.querySelectorAll(sel)); } catch (e) { return []; } }
  function first(sel) { var L = all(sel); for (var i = 0; i < L.length; i++) if (vis(L[i])) return L[i]; return null; }
  function imBild(el) { var r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= root.innerHeight && r.left >= 0 && r.right <= root.innerWidth; }
  /* Element in den sichtbaren Bereich holen (LabRahmen.zeig kennt die feste Grafik am Handy) */
  function zeig(el) {
    if (!el) return;
    try { if (root.LabRahmen && root.LabRahmen.zeig) { root.LabRahmen.zeig(el); return; } } catch (e) {}
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
  }
  /* Die Seite selbst soll nicht rollen (das Lab füllt das Bild, es rollt nur der Inhaltsbereich): ein Versatz durch scrollIntoView wird zurückgenommen */
  function oben() { try { var app = doc.getElementById('app'); if (!app || Math.abs(app.getBoundingClientRect().height - root.innerHeight) > 2) return; if (root.scrollY || doc.documentElement.scrollTop || doc.body.scrollTop) root.scrollTo(0, 0); [doc.body, app, doc.getElementById('mid')].forEach(function (e) { if (e && e.scrollTop) e.scrollTop = 0; }); } catch (e) {} }
  function zeigSel(sel) { var f = function () { var el = first(sel); if (el) zeig(el); }; setTimeout(f, 60); setTimeout(f, 500); setTimeout(oben, 650); setTimeout(oben, 1100); }

  /* ------------------------------------------------------------------ Zähler: Klicks und Eingaben an Bedienelementen */
  var KL = {}, ED = {}, letzteEingabe = 0;
  function zaehl(M, e) { var t = e.target; if (!t || !t.closest) return; for (var sel in M) { try { if (t.closest(sel)) M[sel]++; } catch (er) {} } }
  doc.addEventListener('click', function (e) { zaehl(KL, e); }, true);
  function ein(e) { letzteEingabe = Date.now(); zaehl(ED, e); }
  doc.addEventListener('input', ein, true); doc.addEventListener('change', ein, true);

  /* ------------------------------------------------------------------ Reiter: Stand lesen, wechseln, Knopf im Reiterband finden */
  function tabKnopf(k) { return doc.querySelector('#tabs [data-t="' + k + '"], #tabs [data-tab="' + k + '"]'); }
  function tabJetzt() { var b = doc.querySelector('#tabs .on, #tabs [aria-selected="true"]'); return b ? (b.getAttribute('data-t') || b.getAttribute('data-tab') || '') : ''; }
  function tabGeh(k) { var b = tabKnopf(k); if (b && tabJetzt() !== k) b.click(); }
  /* Der Knopf, der als Nächstes zum Reiter k führt: Reiter im Band, sonst erst die Gruppe im Band, dann der Teil im Umschalter darunter */
  function bandKnopf(k) {
    var b = doc.querySelector('.lr-band [data-lr-t="' + k + '"]'); if (vis(b)) return b;
    var items = null; try { items = root.LabRahmen && root.LabRahmen._modell && root.LabRahmen._modell(); } catch (e) {}
    var band = doc.querySelector('.lr-band');
    if (items && items.length && vis(band)) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i], hat = (it.teile || []).some(function (t) { return t.key === k; }); if (!hat) continue;
        var teil = doc.querySelector('.lr-teile [data-lr-teil="' + k + '"]');
        if (band.children[i] && band.children[i].getAttribute('aria-selected') === 'true' && vis(teil)) return teil;
        if (band.children[i]) return band.children[i];
      }
    }
    var t = tabKnopf(k); if (vis(t)) return t;
    return vis(band) ? band : (vis(doc.getElementById('tabs')) ? doc.getElementById('tabs') : null);
  }
  function bandZeig(k) { var f = function () { var el = bandKnopf(k); if (el && !imBild(el)) { try { el.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} } }; setTimeout(f, 60); setTimeout(f, 500); setTimeout(oben, 650); setTimeout(oben, 1100); }

  /* ------------------------------------------------------------------ Aufgaben: Liste, offene Aufgabe, Knöpfe */
  /* Schlüssel des Aufgaben-Reiters: 'tasks', im Pneumatik-Lab 'aufg' (erst bei Bedarf lesen: manche Labs bauen ihre Reiter nach dem Laden) */
  function TT() { return tabKnopf('aufg') && !tabKnopf('tasks') ? 'aufg' : 'tasks'; }
  var ROW = '#mid .row[data-t]', HINT = '#mid [data-ta="hint"], #mid [data-a="hint"], #mid [data-a="tip"]', CHK = '#mid [data-ta="chk"], #mid [data-a="check"]';
  function aufgabeOffen() { return !!first(CHK); }
  function aufgabeOeffnen() { tabGeh(TT()); if (!aufgabeOffen()) { var r = first(ROW); if (r) r.click(); } }

  /* ------------------------------------------------------------------ LabTrainerAPI (wie in den Elektronik-Labs: Zustand des Labs für den Trainer) */
  if (!root.LabTrainerAPI) {
    root.LabTrainerAPI = {
      lab: LAB, tab: tabJetzt, go: tabGeh,
      klicks: function (sel) { if (!(sel in KL)) KL[sel] = 0; return KL[sel]; },
      eingaben: function (sel) { if (!(sel in ED)) ED[sel] = 0; return ED[sel]; },
      ruhe: function () { return Date.now() - letzteEingabe; },
      task: aufgabeOffen, blatt: function () { return !!doc.querySelector('.backdrop'); },
      zeig: zeigSel, bandZeig: bandZeig, aufgabeOeffnen: aufgabeOeffnen
    };
  }

  /* ------------------------------------------------------------------ Bausteine für die Schritte (Form wie in trainer.js) */
  var nr = 0;
  /* Reiter wählen: wartet, bis der Reiter k offen ist */
  function REITER(k, t, x) { return { prep: function (a) { a.bandZeig(k); }, at: function () { return bandKnopf(k); }, gate: function (a) { return a.tab() === k; }, t: t, x: x }; }
  /* Eingabefeld, Regler oder Auswahlliste bedienen: wartet auf eine Eingabe im Element sel (Reiter k wird vorher geöffnet, falls der Schritt davor übersprungen wurde) */
  function EINGABE(k, sel, t, x) { var id = 'e' + (++nr); return { prep: function (a, st) { if (k) a.go(k); st[id] = a.eingaben(sel); a.zeig(sel); }, at: function () { return first(sel); }, gate: function (a, st) { return a.eingaben(sel) > st[id] && a.ruhe() > 900; }, t: t, x: x }; }
  /* Knopf antippen: wartet auf einen Klick auf sel; der Rahmen liegt um ring (Standard: der Knopf selbst) */
  function KLICK(k, sel, ring, t, x, opt) { var id = 'k' + (++nr); return { prep: function (a, st) { if (k) a.go(k); st[id] = a.klicks(sel); a.zeig(ring || sel); }, at: function () { return first(ring || sel); }, gate: function (a, st) { return a.klicks(sel) > st[id]; }, optional: !!opt, t: t, x: x }; }
  var UEBEN = function () { return { prep: function (a) { a.bandZeig(TT()); }, at: function () { return bandKnopf(TT()); }, gate: function (a) { return a.tab() === TT(); }, t: 'Zu den Aufgaben', x: 'Tippe oben auf „Üben“ und wähle darunter „Aufgaben“. Dort warten die Aufgaben in drei Stufen. Das Lab prüft deine Antwort sofort.' }; };
  var OEFFNEN = function () { var id = 'k' + (++nr); return { prep: function (a, st) { a.go(TT()); st[id] = a.klicks(ROW); a.zeig(ROW); }, at: function () { return first(ROW); }, gate: function (a, st) { return a.klicks(ROW) > st[id] || a.task(); }, t: 'Erste Aufgabe öffnen', x: 'Tippe auf die erste Aufgabe in der Liste. Die Punkte hinter dem Namen zeigen die Stufe: ein Punkt ist leicht, drei Punkte sind schwer.' }; };
  var TIPP = function () { var id = 'k' + (++nr); return { prep: function (a, st) { a.aufgabeOeffnen(); st[id] = a.klicks(HINT); a.zeig(HINT); }, at: function () { return first(HINT); }, gate: function (a, st) { return a.klicks(HINT) > st[id]; }, optional: true, t: 'Tipp holen', x: 'Kommst du nicht weiter? Tippe auf „Tipp“. Lies den Tipp. Öffnet sich ein Blatt, schließt du es mit dem ✕. Beim Üben kosten Tipps nichts. (Du kannst den Schritt auch überspringen.)' }; };
  var ANTW_K = '#mid [data-tc], #mid [data-qc], #mid [data-o], #mid .opts button', ANTW_E = '#mid input, #mid select, #mid textarea';
  var PRUEFEN = function () { var id = 'k' + (++nr); return { prep: function (a, st) { a.aufgabeOeffnen(); st[id] = a.klicks(CHK); st[id + 'a'] = a.klicks(ANTW_K) + a.eingaben(ANTW_E); a.zeig(CHK); }, at: function () { return first(CHK); }, gate: function (a, st) { return a.klicks(CHK) > st[id] && a.klicks(ANTW_K) + a.eingaben(ANTW_E) > st[id + 'a'] && !a.blatt(); }, t: 'Antworten und prüfen', x: 'Beantworte die Aufgabe: Wähle eine Antwort aus oder trage dein Ergebnis ein. Tippe dann auf „Prüfen“. Das Lab sagt dir sofort, ob es stimmt. Bei einem Fehler versuchst du es noch einmal.' }; };
  var LOESUNG = function (x) { return REITER('bsp', 'Fertige Lösungen ansehen', 'Tippe oben auf „Hilfe“ und wähle darunter „Beispiele“. ' + x); };
  var ENDE = function (name) { return { at: '#bMenu', t: 'Geschafft!', x: 'Das war die Einführung ins ' + name + '. Im Menü oben links findest du Aufgaben, Beispiele, Hilfe und diesen Trainer wieder. Jetzt bist du dran. Viel Spaß beim Üben!' }; };
  var START = function (k, t, x) { return { prep: function (a) { a.go(k); }, t: t, x: x }; };


  /* ------------------------------------------------------------------ Skripte je Lab */
  var S = {
    fer: { name: 'Fertigungs-Lab', steps: [
      START('ver', 'Willkommen im Fertigungs-Lab', 'Hier lernst du die Fertigungsverfahren kennen: Biegen, Gewinde und Bohren, Planung, Qualität und Vorrichtung. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst. Alle Werte sind Übungswerte.'),
      REITER('bie', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Biegen und Gewinde“ und wähle darunter „Biegen“.'),
      EINGABE('bie', '#in-bie-s', 'Zahl ändern', 'Trage bei „Blechdicke s“ eine andere Zahl ein, zum Beispiel 2. Die Zeichnung und die gestreckte Länge rechnen sofort mit.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gerechnete Beispiele mit Rechenweg. Mit „In den Rechner laden“ probierst du sie selbst aus.'),
      ENDE('Fertigungs-Lab')] },
    tol: { name: 'Toleranz-Lab', steps: [
      START('cal', 'Willkommen im Toleranz-Lab', 'Hier liest du Messschieber und Bügelmessschraube ab und rechnest mit Toleranzen und Passungen. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst.'),
      REITER('mic', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Bügelmessschraube“.'),
      KLICK('mic', '#mid [data-mode="selbst"]', null, 'Selbst einstellen', 'Tippe auf „Selbst einstellen“. Dann drehst du die Messschraube mit dem Regler unter dem Bild und liest den Wert selbst ab.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gelöste Beispiele. Mit „Laden“ siehst du sie am Messgerät oder im Rechner.'),
      ENDE('Toleranz-Lab')] },
    zer: { name: 'Zerspan-Lab', steps: [
      START('dreh', 'Willkommen im Zerspan-Lab', 'Hier rechnest du Drehzahl, Vorschub und Hauptzeit beim Drehen, Fräsen und Bohren. Das Bild zeigt dir, was die Zahlen an der Maschine bedeuten. Alle Werte sind Übungswerte.'),
      REITER('fraes', 'Reiter wählen', 'Oben wechselst du das Verfahren. Tippe auf „Fräsen“.'),
      EINGABE('fraes', '#fraes-d-r', 'Regler schieben', 'Schiebe den Regler „Fräserdurchmesser d“. Bild und Rechnung ändern sich sofort. Daneben kannst du die Zahl auch eintippen.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gerechnete Beispiele. Mit „Laden“ siehst du sie in der Simulation.'),
      ENDE('Zerspan-Lab')] },
    wer: { name: 'Werkstoff-Lab', steps: [
      START('zug', 'Willkommen im Werkstoff-Lab', 'Hier lernst du Werkstoffe kennen: Zugversuch, Härteprüfung, Bezeichnungen, Gefüge, Wärmebehandlung und die Werkstoffwahl. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst.'),
      REITER('name', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Bezeichnungen“.'),
      KLICK('name', '#mid [data-nm]', null, 'Werkstoff antippen', 'Tippe auf einen Kurznamen, zum Beispiel S235JR. Das Lab zerlegt den Namen und erklärt dir jeden Teil. Du kannst auch selbst einen Namen eintippen.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gelöste Beispiele. Mit „Laden“ siehst du sie im passenden Bereich.'),
      ENDE('Werkstoff-Lab')] },
    fug: { name: 'Füge-Lab', steps: [
      START('vf', 'Willkommen im Füge-Lab', 'Hier lernst du, wie Teile verbunden werden: Schweißen, Löten, Kleben, Schrauben und Welle-Nabe-Verbindungen. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst. Alle Werte sind Übungswerte.'),
      REITER('sr', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Schrauben und Welle-Nabe“ und wähle darunter „Schrauben“.'),
      EINGABE('sr', '#fug-sr-Mset', 'Regler schieben', 'Schiebe den Regler für das Anzugsmoment. Das Lab zeigt dir, ob die Schraube zu locker, richtig oder zu fest angezogen ist.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gerechnete Beispiele mit Rechenweg. Mit „In den Rechner laden“ probierst du sie selbst aus.'),
      ENDE('Füge-Lab')] },
    mas: { name: 'Maschinenelemente-Lab', steps: [
      START('uebs', 'Willkommen im Maschinenelemente-Lab', 'Hier rechnest du Übersetzungen, Zahnradmaße, Riemen, Ketten, Federn und Lager. Die Bilder bewegen sich mit deinen Zahlen. Alle Werte sind Übungswerte.'),
      REITER('zahn', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Zahnradmaße“.'),
      EINGABE('zahn', '#rg-zahn-z1', 'Regler schieben', 'Schiebe den Regler „Zähne z1“. Das Zahnrad im Bild wird größer oder kleiner, und alle Maße rechnen sofort mit.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gerechnete Beispiele mit Rechenweg. Mit „In den Rechner laden“ probierst du sie selbst aus.'),
      ENDE('Maschinenelemente-Lab')] },
    mch: { name: 'Mechanik-Lab', steps: [
      START('kr', 'Willkommen im Mechanik-Lab', 'Hier rechnest du mit Kräften, Hebeln, Trägern, Reibung, Spannung und Leistung. Jedes Thema hat ein Bild, das mit deinen Zahlen mitgeht. Alle Werte sind Übungswerte.'),
      REITER('he', 'Reiter wählen', 'Oben steht die Gruppe „Statik“. Darunter wählst du den Teil. Tippe auf „Hebel“.'),
      EINGABE('he', '#in-he-F1', 'Zahl ändern', 'Trage bei „Last links F1“ eine andere Zahl ein. Der Hebel im Bild kippt oder kommt ins Gleichgewicht, und die Momente rechnen sofort mit.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gerechnete Beispiele mit Rechenweg. Du kannst sie in den Rechner laden und selbst verändern.'),
      ENDE('Mechanik-Lab')] },
    mak: { name: 'Maschinen-Lab', steps: [
      START('mach', 'Willkommen im Maschinen-Lab', 'Hier lernst du die Maschinen der Werkstatt kennen: Bauteile, Bedienelemente, den Weg des Werkstücks und das CNC-Bedienfeld. Alles ist Übung am Bild. An der echten Maschine arbeitest du nur nach Unterweisung.'),
      REITER('rech', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Rechner“.'),
      KLICK('rech', '#mid [data-pr]', null, 'Verfahren wählen', 'Wähle ein Verfahren: Bohren, Drehen oder Fräsen. Der Rechner zeigt dir dann die passende Drehzahl für die Maschine.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gerechnete Beispiele mit Rechenweg. Mit „In den Rechner laden“ probierst du sie selbst aus.'),
      ENDE('Maschinen-Lab')] },
    cnc: { name: 'CNC-Lab', steps: [
      START('prog', 'Willkommen im CNC-Lab', 'Hier schreibst du CNC-Programme für Drehen und Fräsen und siehst sofort, welchen Weg das Werkzeug fährt. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst. Die Simulation ersetzt keine Unterweisung an der Maschine.'),
      EINGABE('prog', '#exSel', 'Beispielprogramm laden', 'Tippe auf die Liste „Beispielprogramm laden“ und wähle ein Programm. Es erscheint im Editor, und das Bild zeigt den Werkzeugweg.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertige Programme mit Erklärung. Mit „Programm laden“ siehst du sie in der Simulation.'),
      ENDE('CNC-Lab')] },
    pne: { name: 'Pneumatik-Lab', steps: [
      START('sym', 'Willkommen im Pneumatik-Lab', 'Hier lernst du die Schaltzeichen der Pneumatik, siehst Schaltpläne in Bewegung und rechnest Kolbenkraft und Luftverbrauch. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst.'),
      REITER('anl', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Schaltpläne“.'),
      KLICK('anl', '#mid .cirsel [data-c]', '#mid .cirsel', 'Schaltung wählen', 'Tippe in der Leiste auf eine andere Schaltung. Darunter erscheint der Schaltplan. Dort kannst du die Ventile betätigen und dem Kolben zusehen.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertige Schaltungen mit Erklärung. Mit „Simulation öffnen“ siehst du sie arbeiten.'),
      ENDE('Pneumatik-Lab')] },
    hyd: { name: 'Hydraulik-Lab', steps: [
      START('sim', 'Willkommen im Hydraulik-Lab', 'Hier siehst du Hydraulik-Schaltpläne in Bewegung, lernst die Schaltzeichen und rechnest Kraft, Druck und Volumenstrom. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst. Alle Werte sind Übungswerte.'),
      REITER('calc', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Rechner“.'),
      EINGABE('calc', '#cD', 'Zahl ändern', 'Trage bei „Kolbendurchmesser D“ eine andere Zahl ein. Kolbenfläche und Kraft rechnen sofort mit, und du siehst den Rechenweg.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertige Anlagen mit Erklärung. Mit „Simulation öffnen“ siehst du sie arbeiten.'),
      ENDE('Hydraulik-Lab')] },
    ins: { name: 'Instandhaltungs-Lab', steps: [
      START('begr', 'Willkommen im Instandhaltungs-Lab', 'Hier lernst du, wie Maschinen gewartet und Fehler gefunden werden: Grundbegriffe, Fehlersuche, Schmierung, Schäden, Kennzahlen, Wartungsplan und Sicherheit. Ich zeige dir in wenigen Minuten, wie du das Lab bedienst.'),
      REITER('kenn', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Kennzahlen“.'),
      EINGABE('kenn', '#mid [data-kc="b"]', 'Zahl ändern', 'Trage bei „Betriebszeit“ eine andere Zahl ein. Die Kennzahl MTBF rechnet sofort mit, und du siehst den Rechenweg.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gelöste Fälle aus der Instandhaltung. Mit „Ansehen“ gehst du sie Schritt für Schritt durch.'),
      ENDE('Instandhaltungs-Lab')] },
    zei: { name: 'Zeichnungs-Lab', steps: [
      START('werk', 'Willkommen im Zeichnungs-Lab', 'Hier lernst du, technische Zeichnungen zu lesen: Ansichten, Schnitte, Linien, Bemaßung und Maßstab. In der Werkstatt drehst du ein Werkstück und siehst seine Ansichten. Ich zeige dir, wie du das Lab bedienst.'),
      REITER('mas', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Maßstab“.'),
      EINGABE('mas', '#mNat', 'Zahl ändern', 'Trage bei „Naturmaß“ eine andere Zahl ein. Das Lab rechnet das Zeichnungsmaß im gewählten Maßstab sofort aus.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertige Werkstücke mit allen Ansichten. Du kannst sie drehen und Kanten und Maße einblenden.'),
      ENDE('Zeichnungs-Lab')] },
    kon: { name: 'Konstruktions-Lab', steps: [
      START('schr', 'Willkommen im Konstruktions-Lab', 'Hier arbeitest du wie in der Konstruktion: Schrauben auswählen, Toleranzrahmen lesen, Stücklisten schreiben, Lager und Federn bestimmen. Alle Tabellenwerte sind Übungswerte.'),
      REITER('tol', 'Reiter wählen', 'Oben wechselst du das Thema. Tippe auf „Toleranzrahmen“.'),
      EINGABE('tol', '#mid [data-k="tol"]', 'Zahl ändern', 'Trage bei „Toleranzwert“ eine andere Zahl ein, zum Beispiel 0,05. Der Toleranzrahmen im Bild ändert sich sofort, und das Lab erklärt, was er bedeutet.'),
      UEBEN(), OEFFNEN(), TIPP(), PRUEFEN(),
      LOESUNG('Dort stehen fertig gelöste Beispiele mit Rechenweg. Mit „In den Rechner laden“ probierst du sie selbst aus.'),
      ENDE('Konstruktions-Lab')] }
  };
  SC[LAB] = S[LAB];

  /* ------------------------------------------------------------------ Abschluss: Zähler für die Abzeichen nachtragen, kurze Meldung */
  function fertig() { try { return !!JSON.parse(localStorage.getItem('lm4.trainer') || '{}')[LAB]; } catch (e) { return false; } }
  var warFertig = fertig();
  function abschluss() {
    if (warFertig || !fertig()) return; warFertig = true;
    try {
      if (!root.Badges) {
        var d = JSON.parse(localStorage.getItem('lm4.trainer') || '{}'), n = Object.keys(d).filter(function (k) { return !((root.LAB_REG || {})[k] || {}).hub; }).length;
        var s = JSON.parse(localStorage.getItem('lm4.stats') || '{}'); if (!s || typeof s !== 'object') s = {};
        s.trainer = Math.max(s.trainer || 0, n); localStorage.setItem('lm4.stats', JSON.stringify(s));
      }
      if (!(root.LabUI && root.LabUI.toast)) { var t = doc.getElementById('toast'); if (t) { t.textContent = 'Trainer abgeschlossen'; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2200); } }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ Menü des Labs: Zeile "Trainer: Erste Schritte" */
  function menueZeile(bd) {
    try {
      var kopf = bd.querySelector('.sh-h b'); if (!kopf || kopf.textContent.trim() !== 'Menü') return;
      var body = bd.querySelector('.sh-b'); if (!body || body.querySelector('[data-trim]')) return;
      var r = doc.createElement('button'); r.type = 'button'; r.className = 'row'; r.setAttribute('data-trim', '1');
      r.innerHTML = '<div class="grow"><b>Trainer: Erste Schritte</b><small>Kurze Einführung zum Mitmachen</small></div>';
      r.addEventListener('click', function (e) { e.stopPropagation(); var x = bd.querySelector('.sh-h .x, .sh-h button'); if (x) x.click(); else if (bd.parentNode) bd.parentNode.removeChild(bd); setTimeout(function () { root.Trainer.start(); }, 0); });
      var home = body.querySelector('.row[data-m="home"]'); if (home && home.parentNode === body) body.insertBefore(r, home); else body.appendChild(r);
    } catch (e) {}
  }
  try {
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.classList && n.classList.contains('backdrop')) setTimeout(function () { menueZeile(n); }, 0); });
        Array.prototype.forEach.call(m.removedNodes, function (n) { if (n.nodeType === 1 && n.id === 'trBub') abschluss(); });
      });
    }).observe(doc.body, { childList: true });
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
