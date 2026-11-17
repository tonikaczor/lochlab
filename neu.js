'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release oben einen Block ergänzen und den ältesten löschen, so dass genau 3 bleiben. */
(function (root) {
  const LOG = [
    { v: 'v62.181', items: [
      ['Rechen-Duell: Notizfeld', 'Unter jeder Aufgabe im Rechen-Duell gibt es jetzt ein Notizfeld für Nebenrechnungen. Du schreibst mit dem Stift, dem Finger oder der Tastatur. Bei jeder neuen Aufgabe ist das Notizfeld wieder leer.', 'Rechen-Lab'],
      ['Rechen-Duell: Taschenrechner', 'Neu ist ein wissenschaftlicher Taschenrechner zum Auf- und Zuklappen: Klammern, Punkt vor Strich, Wurzel, Potenz, sin, cos, tan, log, ln und EXP. Das Ergebnis kannst du mit einem Knopf ins Antwortfeld übernehmen.', 'Rechen-Lab'],
      ['Rechen-Duell: Beitreten und Gleichstand', 'Beim Beitreten per QR-Code kommt keine falsche Fehlermeldung mehr. Haben zwei gleich viele Aufgaben richtig, steht jetzt dabei, wer schneller war.', 'Rechen-Lab'],
    ] },
    { v: 'v62.180', items: [
      ['Rechen-Duell', 'Neu im Rechen-Lab: Alle bekommen dieselben Rechenaufgaben (5, 10 oder 15). Wer nach Ablauf der Zeit mehr richtig hat, gewinnt. Bei Gleichstand gewinnt, wer schneller war. Starte es im Reiter „Duell“ oder auf der Startseite unter Üben.', 'Rechen-Lab'],
      ['Rechen-Lab: Bruchrechnung', '9 neue Aufgaben: kürzen, erweitern, addieren, multiplizieren, dividieren, gemischte Zahlen und eine Werkstatt-Aufgabe. Du tippst das Ergebnis als Bruch ein, zum Beispiel 5/8 oder 1 3/8. Der Bruch muss vollständig gekürzt sein.', 'Rechen-Lab'],
      ['Rechen-Lab: Klammern', '9 neue Aufgaben: ausmultiplizieren, Minusklammer, zwei Klammern, binomische Formeln, ausklammern und verschachtelte Klammern. Jede Aufgabe nennt im Tipp die Schritte.', 'Rechen-Lab'],
    ] },
    { v: 'v62.179', items: [
      ['Rechen-Lab: Prüfung Teil 1', '22 neue Rechenaufgaben zu den Themen der Abschlussprüfung Teil 1, zum Beispiel LED-Vorwiderstand, Spannungsteiler, Wirkungsgrad, Dualzahlen, Kondensator und Operationsverstärker. Jede Aufgabe nennt im Tipp die Schritte.', 'Rechen-Lab'],
      ['Duell passend zum Lehrjahr', 'Stufe 1 im Duell bringt jetzt nur Aufgaben aus dem 1. Lehrjahr. Die Stufe steckt im Code, deshalb bekommen alle dieselbe Aufgabe, wenn sie dasselbe Lab wählen.', 'Duell'],
      ['Duell: QR-Code in der App scannen', 'Unter „Duell beitreten“ gibt es den Knopf „QR-Code scannen“. So bleibst du in der App. Die Kamera-App des iPads öffnet sonst den Browser.', 'Duell'],
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
