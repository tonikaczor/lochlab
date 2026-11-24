'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release oben einen Block ergänzen und den ältesten löschen, so dass genau 3 bleiben. */
(function (root) {
  const LOG = [
    { v: 'v64.190', items: [
      ['Neu: EMS-Lab „So fertigt Tonfunk“', 'Tonfunk fertigt Elektronik im Auftrag von Kunden. Im EMS-Lab siehst du den Weg einer Baugruppe in 15 Schritten, von der Anfrage bis zur Rechnung, und mit einem Stern die Schritte, an denen dein Beruf mitarbeitet.', 'Alle Berufe'],
      ['Sieben Rechner und 48 Aufgaben', 'Ausbeute, Prüfkosten von ICT und Flying-Probe, MSL-Uhr für feuchteempfindliche Bauteile, Zehnerregel der Fehlerkosten, Rückverfolgung, Drehmoment und Kalkulation einer Baugruppe. Dazu 48 Aufgaben mit drei Tipp-Stufen und 40 Fachbegriffe.', 'Alle Berufe'],
      ['Im Lernpfad gleich am Anfang', 'Das EMS-Lab steht in jedem Ausbildungsplan und Lernpfad direkt nach dem Arbeitsschutz. Erst sicher arbeiten, dann wissen, wie der Betrieb fertigt.', 'Lernpfad, Mein Plan'],
    ] },
    { v: 'v63.189', items: [
      ['Abzeichen in jedem Lab', 'Bisher gab es in rund 40 Labs keine Abzeichen, zum Beispiel im Lager-, Zeichnungs- und Kalkulations-Lab. Jetzt zählt jede gelöste Aufgabe in jedem Lab für deine Abzeichen, auch der Trainer.', 'Alle Berufe'],
      ['Eigene Kampagne für drei weitere Berufe', 'Technische Produktdesigner bauen in „Das Gehäuse“ mit Meisterin Kontur ein Gehäuse. Fachkräfte für Lagerlogistik bringen in „Der Großauftrag“ mit Meister Palette einen Auftrag durchs Lager. Industriekaufleute begleiten in „Der Lautsprecher-Auftrag“ mit Ausbilderin Saldo einen Auftrag von der Anfrage bis zum Abschluss. Jede Kampagne hat 16 Kapitel und einen Epilog.', 'Technischer Produktdesigner, Fachkraft für Lagerlogistik, Industriekaufmann'],
      ['Mehr Abzeichen und ein Kampagnen-Fehler behoben', 'Neue Themen-Abzeichen für Produktdesign, Lager und Kaufleute, dazu je ein Abzeichen für die ganze Kampagne. Kapitel, die du auf der Startseite geschafft hast, zählen jetzt auch für die Kapitel-Abzeichen.', 'Abzeichen'],
    ] },
    { v: 'v63.188', items: [
      ['Arbeitsschutz-Lab für alle Berufe', 'Sicherheitszeichen, Gefahrstoffe, Schutzausrüstung und Erste Hilfe gehen alle an: Das Arbeitsschutz-Lab steht jetzt in jedem Beruf und im ersten Lernfeld des 1. Lehrjahrs, gleich nach dem Einstieg. Die Erste-Hilfe-Aufgaben sind auf dem Stand der aktuellen Leitlinien (DGUV, Reanimation 2025).', 'Alle Berufe'],
      ['Abzeichen, die du wirklich verdienen kannst', 'Die Abzeichen-Liste zeigt nur noch Abzeichen, die du in deinem Beruf erreichen kannst. Schon verdiente Abzeichen bleiben immer sichtbar. Neu für Industriemechaniker: das Abzeichen „Die Presse“ für die ganze Kampagne.', 'Abzeichen'],
      ['Prüfungsfragen Industriemechanik korrigiert', 'Zwei Ankreuzfragen im Prüfungs-Pool Industriemechanik waren missverständlich (Kronenmutter, Magnesium). Sie sind jetzt eindeutig.', 'Industriemechaniker'],
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
