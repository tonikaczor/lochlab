/* heft-nav.js - Kopfleiste der Lernhefte (erzeugt von mklernen2.py, nicht von Hand aendern).
 * Setzt die Leiste an den Anfang von .wrap und entfernt sich danach. Eine Zeile: "‹ Start", "Inhalt" (nur am Handy, das
 * Verzeichnis im Text entfaellt dort) und "Alle Hefte"; die Listen klappen als Blatt auf. Die Heft-Liste steht nur hier. */
(function () {
  var L = [["projekt-ampel.html", "Projekt Ampel"], ["projekt-daemmerung.html", "Projekt Dämmerungsschalter"], ["projekt-netzteil.html", "Projekt Netzteil"], ["lernen-loch.html", "LochLab: Löten"], ["lernen-schalt.html", "SchaltLab: Elektronik"], ["lernen-sim.html", "SimLab: Installation und Prüfung"], ["lernen-digi.html", "DigiLab: Digitaltechnik"], ["lernen-mess.html", "MessLab: Messtechnik"], ["lernen-haus.html", "HausLab: Elektroinstallation"], ["lernen-app.html", "App-Werkstatt: Eigene Apps mit KI"], ["lernen-pr.html", "Prüfungs-Lab: Abschlussprüfung"], ["lernen-sps.html", "SPS-Lab: Steuerungen programmieren"], ["lernen-pcb.html", "Leiterplatten-Lab: Entwurf, Fertigung, Prüfung"], ["lernen-ant.html", "Antriebs-Lab: Motoren, Regelung, Getriebe"], ["lernen-sen.html", "Sensorik-Lab: Sensoren, Messketten, Normsignale"], ["lernen-ds.html", "Datenblatt-Lab: Datenblätter lesen"], ["lernen-reg.html", "Regelungstechnik-Lab: Regelkreis, Regler, Einstellen"], ["lernen-thm.html", "Thermik-Lab: Wärme, Kühlkörper, Wärmewiderstand"], ["lernen-emv.html", "EMV-Lab: Störungen erkennen und beseitigen"], ["lernen-enr.html", "Energie-Lab: Solar, Akku, Wechselrichter"], ["lernen-els.html", "Elektrische Sicherheit: Schutz, Prüfung, Rettung"], ["lernen-nts.html", "Netzteile und Schaltregler: Wandlung, Verlust, Regelung"], ["lernen-wsl.html", "Wechselstrom und Schwingkreise"], ["lernen-ana.html", "Analogtechnik: Halbleiter und Verstärker"], ["lernen-hf.html", "Funk- und HF-Lab: Hochfrequenz verstehen"], ["lernen-w24.html", "Praxisprüfung W-2024: Schaltung verstehen"], ["lernen-vb.html", "Projekte: Verbundprojekte"], ["lernen.html", "Lernhefte: Übersicht"], ["lernen-tol.html", "Toleranz-Lab: Messen, Toleranzen, Passungen"], ["lernen-zer.html", "Zerspan-Lab: Schnittwerte, Kräfte, Hauptzeit"], ["lernen-hyd.html", "Hydraulik-Lab: Druck, Kraft, Schaltungen"], ["lernen-cnc.html", "CNC-Lab: Programmieren nach DIN 66025"], ["lernen-wer.html", "Werkstoff-Lab: Kennwerte, Härte, Wärmebehandlung"], ["lernen-ins.html", "Instandhaltungs-Lab: Warten, Prüfen, Fehler suchen"], ["lernen-pne.html", "Pneumatik-Lab: Druckluft, Ventile, Schaltungen"], ["lernen-fug.html", "Füge-Lab: Schweißen, Löten, Kleben, Schrauben"], ["lernen-mas.html", "Maschinenelemente-Lab: Getriebe, Federn, Lager"], ["lernen-mch.html", "Mechanik-Lab: Kräfte, Momente, Festigkeit"], ["lernen-fer.html", "Fertigungs-Lab: Verfahren, Handfertigung, Planung und Qualität"], ["lernen-mak.html", "Maschinen der Werkstatt: Drehen, Fräsen, Bohren, Sägen"], ["lernen-zei.html", "Zeichnungs-Lab: Ansichten, Linien, Bemaßung und Schnitte"], ["lernen-kon.html", "Konstruktions-Lab: Normteile, Schrauben, Lager und Toleranzen"]];
  var s = document.currentScript; if (!s) return;
  var d = document, cur = location.pathname.split('/').pop() || '';
  /* Darstellung wie auf der Startseite: lm4.theme (light|dark), sonst System. heft.css bringt die Farben je data-theme. */
  try { var th = localStorage.getItem('lm4.theme'); if (th === 'light' || th === 'dark') d.documentElement.setAttribute('data-theme', th); } catch (e) {}
  var st = d.createElement('style');
  st.textContent = '.lm-top{position:relative;display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;font-size:15px}.lm-top [hidden]{display:none!important}' +
    '.lm-start{display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0 14px;border:1px solid var(--line,#2a3540);border-radius:10px;font-size:16px;font-weight:700;text-decoration:none}' +
    '.lm-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:1px solid var(--line,#2a3540);border-radius:10px;background:var(--panel,transparent);color:inherit;font:inherit;font-size:15px;font-weight:600;cursor:pointer}' +
    '.lm-btn[aria-expanded=true]{border-color:var(--accent,#3b9eff)}.lm-top .lm-print{border:0;background:none;text-decoration:underline;font-weight:400;margin-left:auto}' +
    '.lm-panel{position:absolute;left:0;top:calc(100% + 4px);z-index:30;width:min(100%,460px);max-height:min(70vh,560px);overflow:auto;background:var(--panel,#1a2128);border:1px solid var(--line,#2a3540);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);padding:6px 4px}' +
    '.lm-panel a,.lm-panel .lm-print2{display:flex;align-items:center;width:100%;min-height:44px;padding:0 12px;border-radius:8px;color:var(--fg,inherit);text-decoration:none;font-size:15px}.lm-panel a:hover,.lm-panel a:focus-visible{background:rgba(128,128,128,.18)}' +
    '.lm-panel a[aria-current=page]{font-weight:700;color:var(--accent,#3b9eff)}.lm-ph{margin:4px 12px;font-size:14px;color:var(--mute,#9aa6b2)}' +
    '.lm-panel .lm-print2{display:none;border:0;background:none;font:inherit;font-size:15px;text-decoration:underline;cursor:pointer;color:var(--fg,inherit)}' +
    '.lm-figlab{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 8px;font-size:14px;text-align:center}' +
    '@media(min-width:701px){.lm-inh{display:none!important}}' +
    '@media(max-width:700px){html.lm-inhalt .toc{display:none}.lm-top{position:sticky;top:0;z-index:20;margin:0 -18px 8px;padding:6px 18px;background:var(--bg,#10151a);border-bottom:1px solid var(--line,#2a3540)}.lm-panel{left:0;right:0;width:auto;border-radius:0 0 12px 12px}}' +
    '@media(max-width:560px){.lm-top .lm-print{display:none}.lm-panel .lm-print2{display:flex}}' +
    '@media print{.lm-top,.lm-figlab{display:none!important}}';
  d.head.appendChild(st);
  var wrap = s.parentNode;
  var top = d.createElement('div'); top.className = 'nav noprint lm-top';
  top.innerHTML = '<a class="lm-start" href="index.html">‹ Start</a>' +
    '<button type="button" class="lm-btn lm-inh" aria-expanded="false" aria-controls="lm-p-inh" hidden>Inhalt <span aria-hidden="true">▾</span></button>' +
    '<button type="button" class="lm-btn lm-hef" aria-expanded="false" aria-controls="lm-p-hef">Alle Hefte <span aria-hidden="true">▾</span></button>' +
    '<button type="button" class="lm-btn lm-print">Drucken / als PDF sichern</button>' +
    '<div class="lm-panel" id="lm-p-inh" hidden></div><div class="lm-panel" id="lm-p-hef" hidden></div>';
  wrap.insertBefore(top, wrap.firstChild); wrap.removeChild(s);
  var bi = top.querySelector('.lm-inh'), bh = top.querySelector('.lm-hef'), pi = top.querySelector('#lm-p-inh'), ph = top.querySelector('#lm-p-hef');
  ph.innerHTML = '<p class="lm-ph">Alle Hefte und Projekte</p>' + L.map(function (x) { return '<a href="' + x[0] + '"' + (x[0] === cur ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '<button type="button" class="lm-print2">Drucken / als PDF sichern</button>';
  function close(back) {
    [[bi, pi], [bh, ph]].forEach(function (p) { if (!p[1].hidden && back === p[0]) p[0].focus(); p[1].hidden = true; p[0].setAttribute('aria-expanded', 'false'); });
  }
  function toggle(b, p) {
    var was = !p.hidden; close();
    if (!was) { p.hidden = false; b.setAttribute('aria-expanded', 'true'); var a = p.querySelector('a'); if (a) a.focus({ preventScroll: true }); }
  }
  bi.addEventListener('click', function () { toggle(bi, pi); });
  bh.addEventListener('click', function () { toggle(bh, ph); });
  top.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && t.closest('.lm-print,.lm-print2')) window.print();
    else if (t.closest && t.closest('.lm-panel a')) close();
  });
  d.addEventListener('click', function (e) { if (!top.contains(e.target)) close(); });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    close(!pi.hidden ? bi : !ph.hidden ? bh : null);
  });
  function build() {
    var as = [].slice.call(d.querySelectorAll('.toc a')), it;
    if (as.length) it = as.map(function (a) { return [a.getAttribute('href'), a.textContent]; });
    else it = [].slice.call(d.querySelectorAll('h2[id]')).map(function (h) { return ['#' + h.id, h.textContent]; });
    if (it.length) {
      pi.innerHTML = '<p class="lm-ph">Inhalt dieses Hefts</p>' + it.map(function (x) { return '<a href="' + x[0] + '">' + x[1] + '</a>'; }).join('');
      bi.hidden = false; d.documentElement.classList.add('lm-inhalt');
    }
    [].forEach.call(d.querySelectorAll('figure.fig'), function (f) {
      var e = f, a = null, n;
      while (e.parentNode !== wrap && e.parentNode) e = e.parentNode;
      while (e.previousElementSibling && e.tagName !== 'H2') e = e.previousElementSibling;
      for (n = e; n && !a; n = n.nextElementSibling) {
        if (n !== e && n.tagName === 'H2') break;
        a = n.matches('a.try') ? n : n.querySelector('a.try:not([href$=".pdf"])');
      }
      if (!a) return;
      var l = d.createElement('a'); l.className = 'lm-figlab noprint'; l.href = a.getAttribute('href');
      l.textContent = 'Im Lab ausprobieren: ' + a.textContent.replace(/^[^A-Za-zÄÖÜäöü0-9]+/, '');
      f.appendChild(l);
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
})();
