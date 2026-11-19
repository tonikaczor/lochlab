'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release oben einen Block ergänzen und den ältesten löschen, so dass genau 3 bleiben. */
(function (root) {
  const LOG = [
    { v: 'v62.184', items: [
      ['Rechen-Lab: Elektrotechnik rechnen', '38 neue Aufgaben in zwei neuen Rubriken. „Elektrotechnik“: Spannungsteiler mit Last, Brückenschaltung, Blindwiderstand, Drehstromleistung, Kompensation, Fehlerschleife, Geräteprüfung, Kühlkörper. „Elektronik vertieft“: Pegel in dB und dBm, Funkstrecke, AD-Wandler, Schaltregler, Verluste am MOSFET, Schnittstellen und die Grenzen des Operationsverstärkers. Beide Rubriken kannst du auch im Rechen-Duell wählen.', 'Rechen-Lab'],
      ['Nach Beruf einsortiert', 'Die Rubrik „Elektrotechnik“ gehört bei Elektronikern und Industrieelektrikern zum Lernfeld 5.2 im 2. und 3. Lehrjahr. „Elektronik vertieft“ ist dort ein freiwilliges Zusatzthema und zählt nicht in den Fortschritt. In den Wegen Technik und Studium gehören beide Rubriken fest zum Plan. In allen anderen Berufen stehen sie als freiwilliges Zusatzthema am Ende.', 'Mein Plan'],
      ['Wiki: 37 neue Seiten zur Elektrotechnik', 'Neu sind unter anderem Pegel und Dezibel, Wellenwiderstand und Anpassung, Funkstrecke, Modulation, Schaltregler, MOSFET als Schalter, Messunsicherheit, Bandbreite am Oszilloskop, unsymmetrische Last, Kompensation, Abschaltbedingung, Erstprüfung, Geräteprüfung, aktive Filter, Grenzen des Operationsverstärkers, Abtastung, UART, I²C, SPI, RS-485 und CAN, Bauteile mit Reserve auslegen und typische Ausfallbilder.', 'Wiki'],
      ['Formelheft erweitert', 'Im Formelheft stehen 32 neue Formeln, dazu die neue Gruppe „Funk und Hochfrequenz“ mit Pegel, Reflexionsfaktor und Freiraumdämpfung.', 'Formelheft'],
      ['Rechen-Duell: Reiter gesperrt', 'Solange eine Runde läuft, sind die anderen Reiter im Rechen-Lab gesperrt. Nachschlagen während des Duells geht so nicht mehr. Nach der Runde ist alles wieder frei.', 'Rechen-Lab'],
    ] },
    { v: 'v62.183', items: [
      ['Updates laden schneller', 'Bei einer neuen Version holt die App nur noch die Dateien, die sich geändert haben. Alles andere übernimmt sie aus dem Offline-Speicher. Das Update ist dadurch viel schneller fertig und braucht kaum Datenvolumen.', 'Start'],
      ['Duell: Anzeige verdeckt nichts mehr', 'Im Netzteil-Lab, Leiterplatten-Lab und Analogtechnik-Lab lag die orange Duell-Anzeige mit der Zeit über dem Lab-Namen. Jetzt bekommt sie während des Duells eine eigene Zeile über der Kopfzeile.', 'Duell'],
      ['Rechen-Lab: 18 neue Aufgaben', 'In jeder Rubrik gibt es zwei weitere Aufgaben, von Zeit umrechnen über Zollmaß und Toleranz bis Stromverstärkung und Kondensatoren. Sie kommen auch im Duell und beim Üben allein dran.', 'Rechen-Lab'],
      ['App öffnet sofort', 'Die App startet jetzt immer direkt aus dem Offline-Speicher, auch bei schwachem Netz. Gibt es eine neue Version, erscheint oben ein oranger Knopf „Neue Version bereit“. Erst wenn du ihn antippst, wird sie geladen.', 'Start'],
      ['Wiki: 16 neue Bauteile', 'Neu im Wiki sind unter anderem RGB-Leuchtdiode, Drehgeber, DIP-Schalter, Schraubklemme, Messwiderstand, Ferritperle, Suppressordiode, Pt100, Bewegungsmelder, Darlington-Transistor und ULN2003.', 'Wiki'],
    ] },
    { v: 'v62.182', items: [
      ['Rechen-Duell: Deine Fehler erklärt', 'Nach der Runde siehst du unter dem Ergebnis jede falsche Aufgabe mit deiner Antwort, der richtigen Lösung und dem Rechenweg Schritt für Schritt. Mit „Ähnliche Aufgabe üben“ rechnest du sie gleich noch einmal mit neuen Zahlen.', 'Rechen-Lab'],
      ['Rechen-Duell: Überspringen und Abgeben', '„Überspringen“ stellt die Aufgabe jetzt ans Ende. Du kannst sie später noch lösen. Mit „Abgeben“ beendest du die Runde, wenn du fertig bist.', 'Rechen-Lab'],
      ['Rechen-Duell: Rubriken wählen', 'Beim neuen Duell wählst du „Gemischt“ oder einzelne Rubriken, zum Beispiel nur Bruchrechnung und Klammern. Die Wahl steckt im Code, alle bekommen dieselben Aufgaben.', 'Rechen-Lab'],
      ['Prüfungs-Duell: mehrere Aufgaben hintereinander', 'Ein Duell kann jetzt aus 1, 3 oder 5 Fehlersuchen bestehen. Nach jeder Aufgabe siehst du deinen Zwischenstand, am Ende zählt die Summe. Der Duell-Code am Schluss gilt für alle Aufgaben zusammen.', 'Duell'],
      ['Rechen-Duell: gleich scannen', '„QR-Code scannen“ und „Mit Code beitreten“ stehen jetzt direkt auf der ersten Seite und bei „Neues Duell“. Du musst nicht mehr erst zurückgehen.', 'Rechen-Lab'],
      ['Wiki: 33 neue Bauteile', 'Das Wiki erklärt jetzt auch Z-Diode, Schottky-Diode, PNP-Transistor, Optokoppler, Quarz, Schütz, Timer 555, Schieberegister, Servo, Schrittmotor, Ultraschallsensor und viele mehr. Suche einfach nach dem Namen.', 'Wiki'],
      ['Englisch-Lab: über 400 neue Fachwörter', 'Der Vokabeltrainer kennt jetzt 602 Wörter. Neu sind technische Begriffe aus Elektrik, Messtechnik, Funk, Digitaltechnik, Mechanik, Werkstoffen und Arbeitssicherheit, zum Beispiel Messschieber, Aderendhülse und Spannungsteiler.', 'Englisch-Lab'],
      ['Einführung: Bauteilleiste', 'In der Einführung von DigiLab, SchaltLab und SimLab zeigt der Schritt „Bauteile“ auf dem Tablet und am PC jetzt auf die Bauteilleiste links und nicht mehr auf die untere Leiste.', 'DigiLab'],
    ] },
      ];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function open() {
    if (document.getElementById('neuBox')) return;
    const cur = root.LAB_VERSION || LOG[0].v;
    const w = document.createElement('div'); w.id = 'neuBox';
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom)) 16px;-webkit-overflow-scrolling:touch';
    const block = (b, open) => `<details${open ? ' open' : ''} style="margin:8px 0;border:1px solid #38424d;border-radius:10px;padding:8px 12px;background:#252d36"><summary style="cursor:pointer;font-weight:700;font-size:16px;line-height:20px;padding:12px 0;min-height:20px">${esc(b.v)}${b.v === cur ? ' <span style="background:#1a7f37;color:#fff;border-radius:8px;padding:1px 8px;font-size:12px;margin-left:6px">aktuell</span>' : ''}</summary><ul style="margin:8px 0 2px;padding-left:20px">${b.items.map(i => `<li style="margin:7px 0"><b>${esc(i[0])}</b>: ${esc(i[1])}<br><span style="color:#6cb8ff;font-size:13px">Fundort: ${esc(i[2])}</span></li>`).join('')}</ul></details>`;
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:640px;width:100%;font:15px system-ui,sans-serif"><div style="position:sticky;top:-16px;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:8px;background:#1f262e;padding:6px 0 8px;margin-top:-6px"><b style="font-size:19px">Neu in Tonfunk Lab ${esc(cur)}</b><button id="neuX" style="flex:none;min-width:48px;height:44px;border-radius:12px;background:#2c343e;border:1px solid #46525f;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div><p style="color:#9aa6b2;margin:6px 0 4px">Das ist zuletzt dazugekommen und so findest du es.</p>${LOG.slice(0, 3).map((b, i) => block(b, i === 0)).join('')}<button id="neuX2" style="display:block;width:100%;height:46px;margin-top:14px;border-radius:12px;background:#2c343e;border:1px solid #46525f;color:#e8eaed;font:600 15px system-ui;cursor:pointer">Schließen</button></div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.querySelector('#neuX').onclick = close; w.querySelector('#neuX2').onclick = close; document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); } }); w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
  }
  root.WhatsNew = { open, LOG };
})(typeof window !== 'undefined' ? window : globalThis);
