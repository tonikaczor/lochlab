'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release oben einen Block ergänzen und den ältesten löschen, so dass genau 3 bleiben. */
(function (root) {
  const LOG = [
        { v: 'v55.170', items: [
      ['Projekte für alle Berufe', 'Sechs neue Projekte: Pneumatische Presse (Industriemechaniker), Kundenauftrag vom Wareneingang bis zur Rampe (Lagerlogistik), Auftrag kalkulieren und abrechnen (Industriekaufleute), Werkstatt-Netz mit Messdaten-Server (Fachinformatiker), Gehäuse für das Labornetzteil (Technische Produktdesigner) und der Tonfunk-Auftrag, bei dem ein Gerät durch alle Berufe läuft und jeder seine Stationen bearbeitet. Zu jeder Station gehören ein Formular und Aufgaben in den passenden Labs.', 'Startseite ▸ Projekte; Projekte-Bereich'],
      ['Projekte nach Beruf', 'Die Zeile Projekte steht jetzt weit oben auf der Startseite und zeigt die Projekte deines Berufs mit Fortschritt. Im Projekt-Bereich stehen deine Projekte zuerst, die anderen sind eingeklappt. In den Labs weist ein Hinweis auf das Projekt hin, in dem das Lab vorkommt.', 'Startseite ▸ Projekte; Projekte-Bereich; alle Labs'],
    ] },
{ v: 'v55.169', items: [
      ['Heute für dich', 'Die Startseite zeigt jetzt, wie viele Aufgaben zum Wiederholen anstehen und wie lange das ungefähr dauert.', 'Startseite ▸ Wiederholen'],
      ['Rückmeldung nach jeder Aufgabe', 'Nach einer gelösten Aufgabe kannst du mit einem Klick sagen: zu leicht, passt, zu schwer oder unklar. Die Rückmeldung bleibt nur auf deinem Gerät, ganz ohne Namen. Ausbilder sehen unter „Rückmeldungen zu Aufgaben“ die auffälligen Aufgaben und können die Auswertung exportieren.', 'Alle Labs ▸ Aufgaben; Ausbilder-Übersicht ▸ Rückmeldungen zu Aufgaben'],
    ] },
    { v: 'v55.168', items: [
      ['Fachliche Korrekturen nach Prüfung', 'Alle Aufgaben und Texte wurden noch einmal doppelt nachgeprüft. Berichtigt wurden unter anderem: FI-Schutzschalter 30 mA gilt für Steckdosenkreise bis 32 A (Haus-Check, Heft), Teilungseinheit 17,5 mm (Schaltschrank-Lab), Schrauben in DIN 8593 bei An- und Einpressen (Füge-Lab), Druckluftquelle als unausgefülltes Dreieck (Pneumatik-Lab), Drehzahlreihe R20/3 und ein Beispiel im Zerspan-Heft, Not-Halt als ergänzende Schutzmaßnahme und DIN 18012 (Wiki), Steuerbus (IT-Systeme-Lab), Reibwert Kunststoff auf Stahl 0,15 (Ladungssicherung), Körperstrom-Aufgabe mit einer Sekunde (Elektrosicherheit).', 'Labs und Hefte'],
      ['Antriebs-Lab: Aufgabe Dreieck am Netz', 'Die Prüfung meldet nicht mehr fälschlich Kippmoment und verlangt jetzt ausdrücklich Netzbetrieb.', 'Antriebs-Lab ▸ Aufgaben'],
      ['Klarere Hinweise', 'Sicherheits- und Vereinfachungshinweise in SPS-, Digi-, Thermik-, Hydraulik- und Instandhaltungs-Aufgaben und -Heften (zum Beispiel Not-Halt über eigenen Sicherheitskreis, Zweihandbedienung, absolute Drücke, fünf Sicherheitsregeln). Die GRAFCET-Kennbuchstaben sind erklärt.', 'SPS-Lab, Digi-Lab, Thermik-Lab, Hydraulik-Lab, Instandhaltungs-Lab ▸ Aufgaben und Hefte'],
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
