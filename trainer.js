'use strict';
/* Tonfunk Lab: Trainer. Kurze Einführung zum Mitmachen für jedes Lab: Scheinwerfer auf die Stelle, Sprechblase mit Erklärung,
   bei manchen Schritten wartet der Trainer, bis man es selbst gemacht hat. Zustand kommt über window.LabTrainerAPI (jedes Lab setzt sie). */
(function (root) {
  const $ = s => document.querySelector(s);
  const A = () => root.LabTrainerAPI || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NEXTSTEPS = [
    { at: '#bMenu', t: 'Menü: Aufgaben, Öffnen, Drucken', x: 'Im Menü stehen ganz oben die Aufgaben mit Prüfung (das Lab sagt dir, was schon stimmt, auf Wunsch gibt es Tipps in drei Stufen), das Öffnen gespeicherter Arbeiten und das Drucken. Weiter unten: Rechner, Tagesaufgabe, Abzeichen, Tonwerkstatt und „Neu in dieser Version“. Diesen Trainer startest du dort jederzeit neu.' }];
  const END = (name) => ({ t: 'Geschafft!', x: 'Das war die Einführung ins ' + name + '. Jetzt bist du dran: Probiere Beispiele aus oder starte eine Aufgabe. Viel Spaß beim Tüfteln!' });

  const SCRIPTS = {
    sch: { name: 'SchaltLab', steps: [
      { t: 'Willkommen im SchaltLab', x: 'Ich zeige dir in etwa drei Minuten, wie du Schaltungen aufbaust und ausprobierst. Bei markierten Stellen darfst du selbst mitmachen. Mit „Weiter“ geht es voran, mit ✕ brichst du jederzeit ab.' },
      { prep: a => a.load('LED mit Vorwiderstand'), at: '#cv', t: 'Die Zeichenfläche', x: 'Ich habe dir eine fertige Schaltung geladen: Batterie, Schalter, Widerstand und LED. Der Widerstand begrenzt den Strom, damit die LED nicht kaputtgeht. Man nennt ihn Vorwiderstand. Deine bisherige Schaltung ist unter „Gespeicherte Schaltungen“ gesichert.' },
      { at: '#pal', t: 'Bauteile', x: 'Hier wählst du Bauteile aus. Bauteil antippen, dann auf die Fläche tippen zum Absetzen. Das Suchfeld findet schnell, was du brauchst.' },
      { at: '#cv', gate: a => a.sel() && a.sel().k === 'R', t: 'Bauteil antippen', x: 'Tippe in der Zeichnung auf den Widerstand.' },
      { at: '#side', t: 'Daten des Bauteils', x: 'Rechts siehst du jetzt, was zum Bauteil gehört, und kannst den Wert ändern. Merke dir den Wert des Widerstands.' },
      { at: '#bSim', gate: a => a.simMode(), t: 'Auf Simulation schalten', x: 'Jetzt wird es spannend. Schalte oben von „Zeichnen“ auf „Sim“.' },
      { at: '#bRun', t: 'Stopp und Start', x: 'Die Simulation läuft sofort los und rechnet die Schaltung live. Mit „Stopp“ hältst du sie an, mit „Start“ läuft sie weiter. Das Tempo stellst du in der Seitenleiste ein.' },
      { at: '#cv', prep: (a, st) => { st.sw = a.switchState(); }, gate: (a, st) => a.switchState() !== st.sw, t: 'Strom sehen', x: 'Die gelben Punkte zeigen den Strom, die Farbe der Leitung zeigt die Spannung. Tippe den Schalter in der Zeichnung an und sieh, wie die LED reagiert.' },
      { at: '#side', prep: (a, st) => { const p = a.part('R'); st.r = p ? p.v : null; }, gate: (a, st) => { const p = a.part('R'); return !!p && p.v !== st.r; }, t: 'Wert ändern', x: 'Wähle den Widerstand und ändere seinen Wert, zum Beispiel auf 100 Ω. Wird die LED heller? Mit sehr kleinem Wert brennt sie durch. Das ist hier ungefährlich, es ist nur Simulation.' },
      { at: '#bWater', gate: a => a.water(), optional: true, t: 'Wasser-Ansicht', x: 'Probiere den blauen Schalter: Der Strom wird zu Wasser im Rohr, die Spannung zum Druck. Das hilft beim Verstehen. (Du kannst den Schritt auch überspringen.)' },
      NEXTSTEPS[0], END('SchaltLab')] },
    sim: { name: 'SimLab', steps: [
      { t: 'Willkommen im SimLab', x: 'Das SimLab ist dein Experimentierlabor für die Hausinstallation: Schalter, Sicherungsautomat, Steckdose und Lampe. Ich zeige dir die Grundlagen in wenigen Minuten.' },
      { prep: a => a.load('Ausschaltung'), at: '#cv', t: 'Eine Ausschaltung', x: 'Ich habe dir eine Ausschaltung geladen: Netz, Sicherungsautomat, Schalter und Lampe. Die farbigen Drähte entsprechen den echten Leitungsfarben (braun Außenleiter, blau Neutralleiter, grün-gelb Schutzleiter).' },
      { at: '#pal', t: 'Bauteile', x: 'Hier wählst du Bauteile aus. Bauteil antippen, dann auf die Fläche tippen zum Absetzen.' },
      { at: '#bSim', gate: a => a.simMode(), t: 'Auf Simulation schalten', x: 'Schalte oben von „Zeichnen“ auf „Sim“.' },
      { at: '#bRun', t: 'Stopp und Start', x: 'Die Simulation läuft sofort los, jetzt liegt Spannung an. Mit „Stopp“ hältst du sie an, mit „Start“ läuft sie weiter.' },
      { at: '#cv', prep: (a, st) => { st.sw = a.switchState(); }, gate: (a, st) => a.switchState() !== st.sw, t: 'Schalten', x: 'Tippe den Schalter in der Zeichnung an. Die Lampe geht an oder aus. Die Punkte zeigen, wo Strom fließt.' },
      { at: '#bCab', t: 'Schaltschrank', x: 'Die Schaltschrank-Ansicht zeigt Sicherungsautomaten und FI so, wie du sie im Verteiler bedienst. Nach einem Kurzschluss schaltest du hier wieder ein.' },
      { at: '#bPP', t: 'Prüfplatz', x: 'Im Prüfplatz übst du das Prüfen elektrischer Geräte nach VDE 0701 und 0702: Schutzleiter, Isolation, Ableitstrom.' },
      NEXTSTEPS[0], END('SimLab')] },
    code: { name: 'Arduino-Lab', steps: [
      { t: 'Willkommen im Arduino-Lab', x: 'Hier programmierst du einen Arduino Uno und siehst sofort, was die Schaltung macht. Ich zeige dir das mit dem Klassiker: einer blinkenden LED.' },
      { prep: a => a.load('Blink'), at: '#cv', t: 'Die Schaltung', x: 'Links der Arduino Uno, an Pin 13 hängt eine LED mit Vorwiderstand. Das ist die Schaltung zum Programm.' },
      { at: '#edWrap', t: 'Das Programm', x: 'Im Programmfenster steht der Code. „setup“ läuft einmal am Anfang, „loop“ immer wieder. pinMode stellt den Pin ein, digitalWrite schaltet ihn, delay wartet in Millisekunden.' },
      { at: '#cdRun', gate: a => a.prog() && a.simMode(), t: 'Programm starten', x: 'Tippe auf „Start“. Das Lab übersetzt dein Programm und lässt es laufen.' },
      { at: '#cv', t: 'Die LED blinkt', x: 'Die LED folgt dem Programm. Die Zeit läuft in der Simulation, nicht ganz in Echtzeit. Das Tempo stellst du in der Seitenleiste ein.' },
      { at: '#codeTa', prep: (a, st) => { st.c = ($('#codeTa') || {}).value; }, gate: (a, st) => (($('#codeTa') || {}).value) !== st.c, t: 'Selbst ändern', x: 'Ändere im Code eine Zahl bei delay, zum Beispiel auf 100, und starte mit „Neu starten“. Die LED blinkt dann schneller.' },
      { at: '#serWrap', t: 'Serieller Monitor', x: 'Mit Serial.println schickt dein Programm Text an den Computer. Hier siehst du ihn, genau wie im echten Serial Monitor. Auch ein Plotter für Messwerte ist dabei.' },
      { at: '#bEx', t: 'Beispiele', x: 'Hier findest du fertige Programme zum Ausprobieren: Taster, Poti, Töne, Servo, LCD und mehr.' },
      NEXTSTEPS[0], END('Arduino-Lab')] },
    pi: { name: 'Pi-Lab', steps: [
      { t: 'Willkommen im Pi-Lab', x: 'Hier programmierst du einen Raspberry Pi in Python und siehst sofort, was die Schaltung macht. Ich zeige dir das mit einer blinkenden LED.' },
      { prep: a => a.load('LED blinkt'), at: '#cv', t: 'Die Schaltung', x: 'Der Raspberry Pi hat eine GPIO-Leiste. An GPIO17 hängt eine LED mit Vorwiderstand. Das ist die Schaltung zum Programm.' },
      { at: '#edWrap', t: 'Das Programm', x: 'Im Programmfenster steht dein Python-Programm. Mit gpiozero schaltest du die LED, mit sleep wartest du Sekunden. Die Einrückung zeigt, was in die Schleife gehört.' },
      { at: '#cdRun', gate: a => a.prog() && a.simMode(), t: 'Programm starten', x: 'Tippe auf „Start“. Das Lab führt dein Python-Programm aus.' },
      { at: '#cv', t: 'Die LED blinkt', x: 'Die LED folgt dem Programm. Das Tempo stellst du in der Seitenleiste ein.' },
      { at: '#codeTa', prep: (a, st) => { st.c = ($('#codeTa') || {}).value; }, gate: (a, st) => (($('#codeTa') || {}).value) !== st.c, t: 'Selbst ändern', x: 'Ändere eine Zahl bei sleep, zum Beispiel auf 0.2, und starte mit „Neu starten“. Die LED blinkt dann schneller.' },
      { at: '#serWrap', t: 'Terminal', x: 'Mit print schickt dein Programm Text ins Terminal. Hier siehst du ihn, genau wie auf dem echten Pi.' },
      { at: '#bEx', t: 'Beispiele', x: 'Hier findest du fertige Programme: Taster, PWM, Ampel, Sensoren und mehr.' },
      NEXTSTEPS[0], END('Pi-Lab')] },
    digi: { name: 'DigiLab', steps: [
      { t: 'Willkommen im DigiLab', x: 'Hier lernst du Digitaltechnik: Gatter, Wahrheitstabellen, Flipflops, Zähler und sogar eine kleine CPU. Ich zeige dir die Grundlagen in wenigen Minuten.' },
      { prep: a => a.load('Grundgatter'), at: '#cv', t: 'Eine digitale Schaltung', x: 'Links die Batterie mit 5 V, zwei Schalter A und B, drei Gatter (UND, ODER, NICHT) und rechts drei LEDs. Ein Gatter macht aus Nullen und Einsen wieder eine Null oder Eins.' },
      { at: '#pal', t: 'Bauteile', x: 'Hier findest du Taktgeber, Gatter, Flipflops, ICs und die Mini-CPU. Antippen und auf die Fläche tippen zum Absetzen.' },
      { at: '#bSim', gate: a => a.simMode(), t: 'Auf Simulation schalten', x: 'Schalte oben von Zeichnen auf Sim. Jetzt rechnet das Lab die Pegel live.' },
      { at: '#cv', prep: (a, st) => { st.sw = a.switchState(); }, gate: (a, st) => a.switchState() !== st.sw, t: 'Eingang schalten', x: 'Tippe einen der Schalter an. Beobachte, welche LEDs leuchten: UND braucht beide Schalter, ODER reicht einer.' },
      { at: '#side', t: 'Digitaltechnik-Karte', x: 'Rechts findest du die Werkzeuge: die Wahrheitstabelle (alle Kombinationen auf einmal), „Aus Tabelle bauen“ (Schaltung nach Wunsch) und den Zahlenumrechner.' },
      { at: '#bMenu', t: 'Menü: Wahrheitstabelle und mehr', x: 'Im Menü stehen Aufgaben, Beispiele und die Digital-Werkzeuge. Lade das Beispiel „4-Bit-Binärzähler“ und tippe unten bei den Messpunkten auf einen Baustein: Dann erscheint das Zeitdiagramm mit allen Takten.' },
      { at: '#bEx', t: 'Beispiele', x: 'Von Gattern über Addierer und Speicher bis zum Mini-Prozessor, der ein Programm ausführt.' },
      NEXTSTEPS[0], END('DigiLab')] },
    loch: { name: 'LochLab', steps: [
      { t: 'Willkommen im LochLab', x: 'Im LochLab planst du eine Schaltung auf einer Lochrasterplatine, so wie du sie später lötest. Ich zeige dir die Grundlagen in wenigen Minuten.' },
      { prep: a => a.load('LED mit Vorwiderstand'), at: '#cv', t: 'Die Platine', x: 'Ich habe dir ein Beispiel geladen: eine LED mit Vorwiderstand und Schalter auf der Platine. Deine bisherige Arbeit ist gesichert. Mit zwei Fingern oder dem Mausrad zoomst du.' },
      { at: '#nav', t: 'Bauteilliste', x: 'Links stehen alle Bauteile. Das Suchfeld findet schnell das passende. Bauteil antippen, dann auf der Platine absetzen.' },
      { at: '#cv', prep: (a, st) => { st.n = a.parts(); }, gate: (a, st) => a.parts() > st.n, t: 'Bauteil setzen', x: 'Wähle in der Liste einen Widerstand und tippe auf die Platine, um ihn abzusetzen. Mit dem Rückgängig-Pfeil oben nimmst du ihn gleich wieder weg.' },
      { at: '#bUndo', t: 'Rückgängig', x: 'Mit diesem Pfeil machst du Schritte zurück, mit dem Pfeil daneben wieder vor. Probiere ruhig aus, es geht nichts kaputt.' },
      { at: '#cv', gate: a => !!a.sel(), t: 'Bauteil antippen', x: 'Tippe auf ein Bauteil auf der Platine. Dann siehst du seine Daten.' },
      { at: '#side', t: 'Daten des Bauteils', x: 'Hier stehen Wert und Einstellungen des gewählten Bauteils. Auch „Erkläre dich“ ist dabei: Das Bauteil erzählt dir, wie es funktioniert.' },
      { at: '#bSim', gate: a => a.simMode(), t: 'Simulation', x: 'Schalte oben auf „Sim“. Dann kannst du die Schaltung ausprobieren, bevor du sie lötest.' },
      NEXTSTEPS[0], END('LochLab')] },
  };

  let steps = null, idx = 0, st = {}, prepped = {}, passed = false, timer = 0, ring = null, bub = null, dim = null, script = null;
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const target = s => { if (!s || !s.at) return null; const el = typeof s.at === 'function' ? s.at() : $(s.at); return vis(el) ? el : null; };

  function ensure() {
    if (ring) return;
    const css = document.createElement('style'); css.id = 'trCss';
    css.textContent = '#trRing{position:fixed;z-index:99;border:3px solid #ffb020;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.52),0 0 18px 4px rgba(255,176,32,.7);pointer-events:none;transition:left .25s,top .25s,width .25s,height .25s;animation:trPulse 1.4s ease-in-out infinite}@keyframes trPulse{50%{border-color:#ffd37a}}#trDim{position:fixed;inset:0;z-index:98;background:rgba(0,0,0,.52);pointer-events:none}#trBub{position:fixed;z-index:100;background:#1f262e;color:#e8eaed;border:2px solid #ffb020;border-radius:14px;padding:14px 16px;width:min(92vw,390px);box-sizing:border-box;font:15px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)}#trBub h4{margin:0 0 6px;font-size:17px}#trBub .bt{display:flex;gap:8px;margin-top:12px;align-items:center;flex-wrap:wrap}#trBub button{background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:9px;padding:9px 13px;font-size:14px;cursor:pointer}#trBub button.pri{background:#ff9d00;border-color:#ff9d00;color:#1b1b1b;font-weight:700}#trBub button[disabled]{opacity:.45;cursor:default}#trBub .pg{margin-left:auto;color:#9aa6b2;font-size:12px}#trBub .hint{color:#ffd37a;font-size:13px;margin-top:8px}#trBub .okk{color:#5ee27d;font-size:14px;margin-top:8px;font-weight:700}';
    document.head.appendChild(css);
    ring = document.createElement('div'); ring.id = 'trRing'; dim = document.createElement('div'); dim.id = 'trDim'; bub = document.createElement('div'); bub.id = 'trBub';
    document.body.append(dim, ring, bub);
  }
  function stop() {
    if (timer) clearInterval(timer); timer = 0;
    ['trRing', 'trDim', 'trBub', 'trCss'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); }); ring = dim = bub = null; steps = null;
  }
  function finish() {
    const lab = (A().lab) || '';
    try { const d = JSON.parse(localStorage.getItem('lm4.trainer') || '{}'); d[lab] = 1; localStorage.setItem('lm4.trainer', JSON.stringify(d)); if (root.Badges) root.Badges.stat('trainer', Object.keys(d).length, 'max'); } catch (e) {}
    stop(); if (root.LabUI && root.LabUI.toast) root.LabUI.toast('Trainer abgeschlossen');
  }
  function render() {
    const s = steps[idx], last = idx === steps.length - 1, gated = !!s.gate;
    bub.innerHTML = `<h4>${esc(s.t)}</h4><div>${esc(s.x)}</div><div id="trMsg">${gated ? '<div class="hint">Mach den Schritt an der markierten Stelle, dann geht es von selbst weiter.</div>' : ''}</div><div class="bt"><button id="trBack"${idx ? '' : ' disabled'}>◀ Zurück</button>${gated ? '<button id="trSkip">' + (s.optional ? 'Überspringen' : 'Selbst weiter') + '</button>' : '<button class="pri" id="trNext">' + (last ? 'Fertig' : 'Weiter ▶') + '</button>'}<button id="trEnd" aria-label="Trainer beenden" title="Beenden">✕</button><span class="pg">${idx + 1} / ${steps.length}</span></div>`;
    bub.querySelector('#trBack').onclick = () => go(idx - 1);
    const n = bub.querySelector('#trNext'); if (n) n.onclick = () => { if (last) finish(); else go(idx + 1); };
    const sk = bub.querySelector('#trSkip'); if (sk) sk.onclick = () => go(idx + 1);
    bub.querySelector('#trEnd').onclick = stop;
  }
  function go(i) {
    if (!steps) return; if (i < 0) i = 0; if (i >= steps.length) { finish(); return; }
    idx = i; passed = false; const s = steps[i];
    if (s.prep && !prepped[i]) { prepped[i] = 1; try { s.prep(A(), st); } catch (e) {} }
    render(); place();
  }
  function place() {
    if (!steps || !bub) return; const s = steps[idx], el = target(s), vw = innerWidth, vh = innerHeight, bh = bub.offsetHeight, bw = bub.offsetWidth;
    if (el) {
      const r = el.getBoundingClientRect(), p = 6;
      ring.style.display = 'block'; dim.style.display = 'none'; ring.style.left = (r.left - p) + 'px'; ring.style.top = (r.top - p) + 'px'; ring.style.width = (r.width + 2 * p) + 'px'; ring.style.height = (r.height + 2 * p) + 'px';
      let x, y; const below = r.bottom + 14 + bh <= vh, above = r.top - 14 - bh >= 0;
      if (vw < 720) { x = (vw - bw) / 2; y = (r.top + r.height / 2 > vh / 2) ? 10 : vh - bh - 10; }
      else if (below) { x = Math.min(Math.max(10, r.left), vw - bw - 10); y = r.bottom + 14; }
      else if (above) { x = Math.min(Math.max(10, r.left), vw - bw - 10); y = r.top - 14 - bh; }
      else if (r.right + 14 + bw <= vw) { x = r.right + 14; y = Math.min(Math.max(10, r.top), vh - bh - 10); }
      else { x = Math.max(10, r.left - 14 - bw); y = Math.min(Math.max(10, r.top), vh - bh - 10); }
      bub.style.left = Math.round(x) + 'px'; bub.style.top = Math.round(y) + 'px';
    } else {
      ring.style.display = 'none'; dim.style.display = 'block'; bub.style.left = Math.round((vw - bw) / 2) + 'px'; bub.style.top = Math.round(Math.max(10, (vh - bh) / 2)) + 'px';
    }
  }
  function tick() {
    if (!steps) return; const s = steps[idx];
    place();
    if (s.gate && !passed) {
      let ok = false; try { ok = !!s.gate(A(), st); } catch (e) {}
      if (ok) {
        passed = true; const m = bub.querySelector('#trMsg'); if (m) m.innerHTML = '<div class="okk">✓ Sehr gut!</div>';
        const k = idx; setTimeout(() => { if (steps && idx === k) go(idx + 1); }, 1100);
      }
    }
  }
  function start() {
    const lab = A().lab, sc = SCRIPTS[lab];
    if (!sc) { if (root.LabUI) root.LabUI.toast('Für dieses Lab gibt es noch keinen Trainer'); return; }
    const oc = document.getElementById('trOffer'); if (oc) oc.remove();
    stop(); ensure(); script = sc; steps = sc.steps; st = {}; prepped = {}; go(0);
    timer = setInterval(tick, 250);
    window.addEventListener('resize', place);
  }
  /* Einmaliges Angebot beim ersten Besuch eines Labs, sobald das Passwort-Tor weg ist */
  function offer() {
    const lab = A().lab; if (!lab || !SCRIPTS[lab] || /[?&](aufgabe|ex|neu|bsp|tag|duell|escape)/.test(location.search)) return;
    let seen = {}; try { seen = JSON.parse(localStorage.getItem('lm4.trainerseen') || '{}'); } catch (e) {} if (seen[lab]) return;
    const g = document.getElementById('gate'); if (g && vis(g)) { setTimeout(offer, 1500); return; }
    if (document.getElementById('trBub') || document.querySelector('.backdrop')) { setTimeout(offer, 3000); return; }
    const mark = () => { seen[lab] = 1; try { localStorage.setItem('lm4.trainerseen', JSON.stringify(seen)); } catch (e) {} c.remove(); };
    const c = document.createElement('div'); c.id = 'trOffer';
    c.style.cssText = 'position:fixed;left:12px;bottom:70px;z-index:60;background:#1f262e;color:#e8eaed;border:2px solid #ffb020;border-radius:14px;padding:12px 14px;max-width:min(88vw,330px);font:14px/1.4 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.5)';
    c.innerHTML = '<b>Neu hier?</b><br>Der Trainer zeigt dir in wenigen Minuten, wie das ' + esc(SCRIPTS[lab].name) + ' funktioniert.<div style="display:flex;gap:8px;margin-top:10px"><button id="tfGo" style="background:#ff9d00;border:0;border-radius:9px;padding:8px 14px;font-weight:700;cursor:pointer">Los geht’s</button><button id="tfNo" style="background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:9px;padding:8px 14px;cursor:pointer">Später</button></div>';
    document.body.appendChild(c);
    c.querySelector('#tfGo').onclick = () => { mark(); start(); }; c.querySelector('#tfNo').onclick = mark;
  }
  root.Trainer = { start, stop, offer, SCRIPTS };
  if (/[?&]trainer\b/.test(location.search)) { const t = setInterval(() => { const g = document.getElementById('gate'); if (!g || !vis(g)) { clearInterval(t); setTimeout(start, 600); } }, 500); }
  else setTimeout(offer, 2500);
})(typeof window !== 'undefined' ? window : globalThis);
