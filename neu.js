'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release hier oben einen Block ergänzen. */
(function (root) {
  const LOG = [
    { v: 'v5.111', items: [
      ['Lötübung', 'Löten üben mit Hitze und Zinn (sechs Lötstellen) und Lupen-Prüfung: schlechte Lötstellen auf einer Reihe erkennen.', 'Menü ▸ Lötübung (alle Labs)'],
      ['Oszilloskop-Trainer', 'Übungsgerät mit Zeitbasis, Volt je Kästchen und Trigger, fünf Ableseaufgaben mit Zufallszahlen und ein Kurven-Rätsel (welche Schaltung macht diese Kurve?).', 'Menü ▸ Oszilloskop-Trainer (alle Labs)'],
      ['Rangliste und Wochenwertung', 'Punkte pro Azubi, „Woche starten“ merkt den Stand, die Spalte „diese Woche“ zeigt den Zuwachs. Wochenpreis kopieren und Urkunde drucken.', 'Ausbilder: Auswertung (auswertung.html)'] ] },
    { v: 'v5.110', items: [
      ['Schaltungs-Detektiv', 'Acht Fälle mit Geschichte: In jeder Schaltung steckt ein versteckter Fehler. Du misst, findest Bauteil und Fehlerart und sammelst Punkte. Jeder falsche Versuch kostet Punkte.', 'Menü ▸ Schaltungs-Detektiv (SchaltLab)'],
      ['Multimeter wie echt', 'Drehschalter (V Gleich, V Wechsel, A, Ω), Buchsen (VΩ, mA, 10 A) und eine Messgerätesicherung. Wer falsch einstellt, bekommt die Folgen zu spüren: Spannung in der Strombuchse brennt die Sicherung durch, Widerstand misst man nur spannungsfrei.', 'Simulation ▸ Messen (SchaltLab, SimLab, Arduino-, Pi-Lab)'],
      ['Zeitreise und Wasser-Ansicht im LochLab', 'In der Simulation: ⏪ Zurück und ⏩ Schritt spulen die Zeit, 💧 Wasser zeigt Druck, Engstelle, Tank, Pumpe und Rad.', 'LochLab: Simulation an, Leiste unten'] ] },
    { v: 'v5.109', items: [
      ['Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen in jedem Lab: Scheinwerfer auf die Stelle, Erklärung in der Sprechblase, bei manchen Schritten wartet der Trainer, bis du es selbst gemacht hast. Beim ersten Besuch eines Labs wird er angeboten. Zwei neue Abzeichen.', 'Menü ▸ Trainer: Erste Schritte (alle Labs)'] ] },
    { v: 'v5.108', items: [
      ['Neu in dieser Version', 'Diese Übersicht: Stichpunkte je Version mit Fundort. Auch per Tipp auf die Versionsanzeige unten rechts.', 'Menü ▸ Neu in dieser Version'] ] },
    { v: 'v5.107', items: [
      ['Spule als Schwungrad', 'In der Wasser-Ansicht dreht sich ein Rad mit dem Spulenstrom, es läuft träge an und aus.', 'Simulation an, blauer Wasser-Schalter oben'] ] },
    { v: 'v5.106', items: [
      ['Wasser-Schalter oben', 'Blauer Schalter neben dem grünen Sim-Schalter, merkt sich den Zustand.', 'Kopfleiste, nur bei eingeschalteter Simulation'] ] },
    { v: 'v5.105', items: [
      ['Kein Flackern mehr', 'Beim Absetzen, Verschieben und Rechtsklick bleibt das Bild ruhig, Kurven werden nicht mehr geleert.', 'überall'] ] },
    { v: 'v5.104', items: [
      ['Bauteile sprechen', 'Bauteil antippen, dann erklärt es sich selbst per Sprachausgabe mit Sprechblase. Automatisch an oder aus schaltbar.', 'Bauteilkarte „Erkläre dich“, Menü ▸ Bauteile sprechen automatisch'],
      ['Wasser-Ansicht', 'Strom als Wasser, Spannung als Druck. Widerstand = Engstelle, Kondensator = Tank, Batterie = Pumpe, Spule = Rad.', 'Kopfleiste (blauer Schalter), Simulationskarte, Menü'],
      ['Zeitreise', 'Simulation zurückspulen und Schritt für Schritt ansehen.', 'Simulationskarte in der Seitenleiste (Regler, Schritt, Live)'],
      ['Tagesaufgabe', 'Jeden Tag neue Zahlen, für alle gleich, mit Serie und Kalender.', 'Menü ▸ Tagesaufgabe (SchaltLab)'],
      ['Duell', 'Gleiche Aufgabe, schnellste Zeit gewinnt. Zeiten gehen in die Rangliste der Auswertung.', 'Menü ▸ Duell (SchaltLab), Ausbilder: Auswertung'],
      ['Escape-Room', 'Vier Räume, jede gelöste Aufgabe verrät eine Ziffer des Türcodes.', 'Menü ▸ Escape-Room (SchaltLab)'],
      ['Tonwerkstatt', 'Klaviertasten mit echten Tönen, fertiger tone()-Code, 555-Sirenenrechner.', 'Menü ▸ Tonwerkstatt (alle Labs)'] ] },
    { v: 'v5.103', items: [
      ['Abzeichen und Konfetti', 'Für Erfolge, Serien und Projekte.', 'Menü ▸ Abzeichen'],
      ['Fehler-Würfel', 'Würfelt einen versteckten Fehler in die Schaltung, den du finden musst.', 'Menü ▸ Fehler-Würfel'],
      ['Zufallsaufgaben', 'Eigene Zahlen für jeden Azubi, „Neue Zahlen würfeln“.', 'Menü ▸ Aufgaben (SchaltLab)'],
      ['Vorhersage-Modus', 'Vor dem Start tippen, was passiert.', 'Menü ▸ Vorhersage-Modus'],
      ['Spannungsquelle live ändern', 'Volt, bei Wechselspannung auch Frequenz, ohne Neustart.', 'Bedienfeld (Simulation), LochLab: Quelle antippen'],
      ['Export', 'Bild (PNG), Animation (GIF), Messkurven (CSV).', 'Menü ▸ Bild speichern, Animation als GIF, Oszilloskop-Daten'] ] },
    { v: 'Früher', items: [
      ['Auto-Weg für Drähte', 'Draht legt sich rechtwinklig um Hindernisse, mit Vorschau.', 'Zeichnen, Drahtwerkzeug'],
      ['Seitenleisten', 'Ein- und ausklappen, in der Breite ziehen.', 'Griffe an den Leisten'],
      ['Abgabe per QR und Auswertung', 'Aufgaben verteilen, Ergebnisse scannen, Gruppenüberblick.', 'Menü ▸ Ergebnis senden, Ausbilder: Auswertung'],
      ['Tipp-Stufen, Messprotokoll, Rechner, Lernhefte', 'Hilfen, Protokoll zum Drucken, Ohm- und RC-Rechner, Arbeitsblätter.', 'Menü und Startseite'] ] }
  ];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function open() {
    if (document.getElementById('neuBox')) return;
    const cur = root.LAB_VERSION || LOG[0].v;
    const w = document.createElement('div'); w.id = 'neuBox';
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px';
    const block = (b, open) => `<details${open ? ' open' : ''} style="margin:8px 0;border:1px solid #38424d;border-radius:10px;padding:8px 12px;background:#252d36"><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(b.v)}${b.v === cur ? ' <span style="background:#2fae45;color:#fff;border-radius:8px;padding:1px 8px;font-size:12px;margin-left:6px">aktuell</span>' : ''}</summary><ul style="margin:8px 0 2px;padding-left:20px">${b.items.map(i => `<li style="margin:7px 0"><b>${esc(i[0])}</b>: ${esc(i[1])}<br><span style="color:#6cb8ff;font-size:13px">Fundort: ${esc(i[2])}</span></li>`).join('')}</ul></details>`;
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:640px;width:100%;font:15px system-ui,sans-serif"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">Neu in Tonfunk Lab ${esc(cur)}</b><button id="neuX" style="background:none;border:0;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div><p style="color:#9aa6b2;margin:6px 0 4px">Das ist zuletzt dazugekommen und so findest du es.</p>${LOG.map((b, i) => block(b, i < 2)).join('')}</div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.querySelector('#neuX').onclick = close; w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
  }
  root.WhatsNew = { open, LOG };
})(typeof window !== 'undefined' ? window : globalThis);
