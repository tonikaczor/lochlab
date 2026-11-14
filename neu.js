'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release oben einen Block ergänzen und den ältesten löschen, so dass genau 3 bleiben. */
(function (root) {
  const LOG = [
    { v: 'v62.173', items: [
      ['Mega Update!', 'Das größte Update bisher: 62 Labs, Toni als Stimme, viele neue Funktionen und Verbesserungen.', 'ganze App'],
      ['Vorlesen bei mehr Stellen', 'Den Vorlese-Knopf gibt es jetzt auch bei „Warum brauche ich das?“, in den Projekten, im Ausbildungsplan und bei allen Wiki-Einträgen. Du tippst auf den Knopf und der Text wird dir vorgelesen. Die Texte liest dir die Stimme von Toni vor.', 'alle Labs, Projekte, Ausbildungsplan, Wiki'],
      ['Aufgaben vorlesen', 'Bei vielen Aufgaben gibt es jetzt einen Vorlese-Knopf. Aufgaben ohne passende Aufnahme bekommen keinen Knopf.', 'fast alle Labs'],
      ['Zeichnungen in den Lernheften', 'Die Lernhefte zeigen jetzt kleine Zeichnungen, die Zusammenhänge sichtbar machen: Reihen- und Parallelschaltung, Spannungsteiler, LED-Vorwiderstand, Kondensator laden, Netzteil, Strom- und Spannungsmessung, Wechselschaltung, hydraulische Presse, Passungen und das 4…20-mA-Signal. Bei „Bewegung reduzieren“ stehen sie still.', 'Lernhefte'],
      ['Buchen mit Animation', 'Im Buchführungs-Lab siehst du Buchungssätze jetzt animiert: Der Betrag wandert vom Soll-Konto zum Haben-Konto und der Saldo aktualisiert sich. Du findest sie im Editor und bei den Beispielen.', 'Buchführungs-Lab'],
      ['Werkstück-Weg', 'Im Maschinen-Lab gibt es den neuen Reiter „Werkstück-Weg“: Ein Werkstück wandert Station für Station durch die Maschinen, die aktive Maschine leuchtet auf. Du gehst Schritt für Schritt oder spielst den Weg ab.', 'Maschinen-Lab'],
      ['Neue Prüfampel im EMV-Lab', 'Die Prüfampel im EMV-Lab sieht jetzt aus wie in den anderen Labs: drei Lampen, Zustandswort und Marge.', 'EMV-Lab'],
      ['Studium und Technik', 'Neben den Ausbildungsberufen gibt es jetzt vier eigene Wege: Techniker Elektrotechnik, Studium Elektrotechnik, Wirtschaftsingenieur und Wirtschaftsinformatik. Du wählst deinen Weg oben auf der Startseite und bekommst einen passenden Plan. Azubis müssen das nicht nutzen.', 'Startseite, Wege'],
      ['Sechs neue Labs', 'Mathe-Brücke (komplexe Rechnung, Matrizen, Fourier-Reihe), Signale und Systeme, Regelungstechnik Aufbau, Embedded vertieft, Projekt und Wirtschaftlichkeit sowie Normen und Konformität. Sie sind mit „Fortgeschritten“ gekennzeichnet.', 'Studium und Technik'],
      ['Mein Stand', 'Eine Seite zeigt dir auf einen Blick, wo du stehst: Ampel je Lernfeld, Prüfungsthemen, fällige Karten, Lerntage und den nächsten sinnvollen Schritt. Sie liest nur und ändert nichts.', 'Startseite, Mein Stand'],
      ['Mein Weg', 'Oben auf der Startseite findest du eine ruhige Kurzansicht: Weitermachen, Mein Stand, Wiederholen, 10-Minuten-Einheit und Plan. Alle Labs liegen darunter und sind für neue Nutzer eingeklappt.', 'Startseite'],
      ['Prüfungs-Countdown', 'Setze das Datum deiner Prüfung und sieh „noch X Tage“, einen Wochenplan aus deinen schwachen Themen und einen Vorschlag für heute. Das Datum bleibt auf deinem Gerät.', 'Mein Stand'],
      ['Fehler werden Lernkarten', 'Falsch beantwortete Prüfungsfragen landen automatisch als Lernkarte und kommen später zum Wiederholen zurück.', 'Prüfungslab, Karten'],
      ['10-Minuten-Einheit', 'Wenig Zeit? Die 10-Minuten-Einheit stellt dir ein Päckchen aus Wiederholen, einer Aufgabe und Karten zusammen.', 'Startseite'],
      ['Ruhiger und größer', 'Spielelemente und Töne sind standardmäßig ruhiger. Die Schrift ist mindestens 14 Pixel groß, und du kannst am Tablet und am Handy jetzt zoomen.', 'ganze App'],
      ['Sichern erinnert dich', 'Die App erinnert dich freundlich daran, deinen Lernstand zu sichern, und zeigt, ob sie offline bereit ist.', 'Startseite'],
      ['Alles offline laden', 'Auf der Startseite lädst du mit einem Tipp alle Vorlese-Aufnahmen auf dein Gerät, damit sie auch ohne Netz laufen. Du siehst vorher, wie viel Platz es braucht, und kannst jederzeit abbrechen und später weitermachen.', 'Startseite, Offline-Karte'],
      ['Gerätetest', 'Auf einer eigenen Seite testest du dein Tablet oder Handy: Anzeige, Touch, Ton, Offline-Betrieb und Vorlesen.', 'Gerätetest'],
      ['Prüfungsfragen geprüft', 'Der Fragenpool wurde fachlich durchgesehen. Mehr als hundert Fragen sind genauer oder aktueller formuliert.', 'Prüfungslab'],
      ['Fehlerbild im Leiterplatten-Lab', 'Neuer Reiter mit 20 typischen Fehlern aus einer Modell-Fertigungslinie, vom Symptom über die Ursache bis zur Gegenmaßnahme, dazu ein Quiz, ein Ausbeute-Rechner und die Rückverfolgung von Chargen. Alle Zahlen sind Übungswerte.', 'Leiterplatten-Lab'],
      ['ESD im Leiterplatten-Lab', 'Neuer Reiter ESD: Du lernst, wie sich Bauteile durch elektrostatische Entladung schädigen, wie ein geschützter Arbeitsbereich mit Erdung, Verpackung und Ionisator aufgebaut ist und wie du dabei richtig misst. Mit Reglern spielst du Luftfeuchte, Systemwiderstand und Offset durch, dazu gibt es fünf Fehlerbilder und ein Quiz mit zwölf Aufgaben.', 'Leiterplatten-Lab'],
      ['Linien-Lab', 'Du untersuchst die Modell-Fertigungslinie von Wareneingang bis Versand und stellst mit Reglern Takt, Engpass, Durchlaufzeit und Ausbeute ein. Dazu kommen die Rückverfolgung einer Charge und die Schritte Lackieren und Verguss mit Rechner. 28 Aufgaben mit Tipps und Rechenweg, alle Zahlen sind Übungswerte.', 'Linien-Lab'],
    ] },
    { v: 'v55.172', items: [
      ['Bauteile spiegeln', 'Im SchaltLab kannst du Transistoren, Operationsverstärker, Poti, Wechsler und weitere Bauteile jetzt spiegeln. So liegen die Anschlüsse auf der Seite, die zu deinem Plan passt.', 'SchaltLab'],
      ['Vorschau beim Setzen', 'Wenn du ein Bauteil wählst, siehst du eine Vorschau in der aktuellen Drehung, auch am Tablet und am Handy. So weißt du schon vor dem Setzen, wie es liegt.', 'LochLab, SchaltLab'],
      ['Schneller zur nächsten Aufgabe', '„Nächste Aufgabe“ wechselt jetzt direkt, ohne die Seite neu zu laden. Am Handy sind die Leisten unten kleiner und die Karte „Warum brauche ich das?“ ist eingeklappt.', 'alle Labs'],
      ['Projekte im Lernpfad', 'Der Lernpfad zeigt jetzt für jeden Beruf einen Schritt „Projekte“ mit den passenden Verbundprojekten. Im Pneumatik-Lab zählen gelöste Aufgaben jetzt auch im Lernpfad und im Ausbildungsplan.', 'Startseite, Pneumatik-Lab'],
    ] },
    { v: 'v55.171', items: [
      ['Dein Ausbildungsplan', 'Neu auf der Startseite: Dein Ausbildungsplan zeigt die Lernfelder deines Berufs mit den passenden Labs, Heften, Wiki-Einträgen und Projekt-Stationen. Du siehst deinen Fortschritt je Lernfeld und bekommst einen Vorschlag, was als Nächstes passt. Zuordnungen, die noch geprüft werden, sind als Entwurf markiert.', 'Startseite ▸ Dein Ausbildungsplan'],
      ['Nächste Aufgabe', 'Wenn du eine Aufgabe geschafft hast, erscheint unten ein Knopf „Nächste Aufgabe“. Er führt dich direkt zur nächsten Aufgabe im selben Lab, ohne Umweg über das Menü.', 'alle Labs'],
      ['Warum brauche ich das?', 'In jedem Lab steht jetzt oben eine kurze Karte: wo das Thema im Betrieb vorkommt, zu welchem Lernfeld es gehört und in welchem Projekt es gebraucht wird. Die Karte lässt sich schließen.', 'alle Labs'],
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
