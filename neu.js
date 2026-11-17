'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release oben einen Block ergänzen und den ältesten löschen, so dass genau 3 bleiben. */
(function (root) {
  const LOG = [
    { v: 'v62.178', items: [
      ['SchaltLab: weiter nach der Fehlersuche', 'Nach „Tiefpass filtert nicht“ ging es nicht weiter. Jetzt öffnet „Nächste Aufgabe“ den nächsten Fall im Schaltungs-Detektiv.', 'SchaltLab'],
      ['So gehst du vor', 'Viele Aufgaben für das 1. Lehrjahr erklären jetzt im Tipp die Begriffe und nennen die Schritte, die von dir erwartet werden.', 'SchaltLab, LochLab, DigiLab, MessLab, Sicherheits-Lab, Rechen-Lab'],
      ['Prüfungs-Lab nach Lehrjahr', 'Auch im Prüfungs-Lab stehen zuerst die Aufgaben bis zu deinem Lehrjahr. Die Hilfe im Rechen-Lab erklärt jetzt die Netzwerke.', 'Prüfungs-Lab, Rechen-Lab'],
    ] },
    { v: 'v62.177', items: [
      ['Lernpfad nach Lehrjahr', 'Für Elektroniker-Berufe richtet sich der Weg jetzt nach deinem Lehrjahr. Unter „Ich“ stellst du „Mein Lehrjahr“ ein. Der Weg zeigt dir dann in jedem Lab zuerst den Teil, der zu deinem Lehrjahr passt. Das Rechen-Lab kommt im 1. Lehrjahr direkt nach dem SchaltLab.', 'Startseite'],
      ['Lehrjahr in den Labs', 'Die Aufgabenliste zeigt zuerst die Aufgaben bis zu deinem Lehrjahr. Spätere Aufgaben stehen darunter unter „Kommt im 2. Lehrjahr“ und bleiben frei wählbar. „Nächste Aufgabe“ schlägt dir keine spätere Aufgabe mehr von sich aus vor.', 'Alle Labs'],
    ] },
    { v: 'v62.176', items: [
      ['Widerstandsnetzwerke im Rechen-Lab', 'Unter „Üben“ findest du jetzt „Netzwerke“: Schaltungen mit zwei bis zehn Widerständen in acht Stufen. Du berechnest Gesamtwiderstand, Teilströme, Teilspannungen und Leistungen. Jede Stufe hat beliebig viele neue Aufgaben.', 'Rechen-Lab'],
      ['Lösungsweg mit Ersatzschaltung', 'Der Lösungsweg fasst die Schaltung Schritt für Schritt zusammen und zeigt dir jedes Mal das neue Schaltbild. Am Handy kannst du das Bild seitlich schieben oder das Handy quer halten.', 'Rechen-Lab'],
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
