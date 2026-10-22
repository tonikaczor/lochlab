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
      { at: '#bMenu', t: 'KV-Diagramm und Zustandsautomaten', x: 'Im Menü findest du jetzt das KV-Diagramm (Gruppen bilden, Gleichung ablesen), das Werkzeug Zustandsautomat (Zustände eintragen, durchspielen, als Schaltung mit D-Flipflops bauen, mit Reset) und den Fehler-Würfel für Gatterschaltungen. Die Mini-CPU kennt jetzt auch Unterprogramme mit CALL und RET.' },
      NEXTSTEPS[0], END('DigiLab')] },
    haus: { name: 'HausLab', steps: [
      { t: 'Willkommen im HausLab', x: 'Hier installierst du Strom in einem Haus: Räume, Steckdosen, Schalter, Lampen, Leitungen und der Verteilerkasten. Ich zeige dir die wichtigsten Handgriffe in wenigen Minuten.' },
      { prep: a => a.load('Einfamilienhaus (fertig'), at: '#cv', t: 'Das Haus in 3D', x: 'Das ist ein fertig installiertes Einfamilienhaus. Du siehst die Räume von schräg oben. Die orange und blauen Linien sind Leitungen, sie laufen nur an Wänden und Decke entlang, so wie es in echten Häusern vorgeschrieben ist.' },
      { prep: (a, st) => { st.y = window.HAUS ? window.HAUS.cam.yaw : 0; }, at: '#pal', gate: (a, st) => !!window.HAUS && Math.abs(window.HAUS.cam.yaw - st.y) > 0.5, t: 'Haus drehen', x: 'Tippe unten auf einen der Drehpfeile (↺ oder ↻). So siehst du alle Wände. Mit „Oben“ schaust du von oben auf den Grundriss, mit + und − zoomst du.' },
      { at: '#pal', t: 'Werkzeuge unten', x: 'Hier wählst du: „Raum“ zum Zeichnen, dann Steckdose, Schalter, Wechselschalter, Lampe, Gerät, Abzweigdose und Verteiler. „Leitung“ verbindet zwei Dinge, „Löschen“ entfernt. Tippe auf eine Wand, die du siehst, um etwas zu setzen. Lampen setzt du auf den Boden: Sie hängen darüber an der Decke.' },
      { at: '#bSim', gate: a => a.simMode(), t: 'In den Betrieb schalten', x: 'Schalte oben von Zeichnen auf Sim. Jetzt ist der Strom an und du bedienst das Haus.' },
      { at: '#cv', t: 'Schalter bedienen', x: 'Tippe einen Lichtschalter an: Die Lampe leuchtet. Geräte an Steckdosen schaltest du auch durch Antippen. Bei jeder Steckdose siehst du die Spannung. Wenn ein Gerät einen Körperschluss hat, löst der FI aus.' },
      { at: '#pal', gate: () => !!document.querySelector('.sheet .hrail'), t: 'Verteilerkasten öffnen', x: 'Tippe unten auf „Verteiler“. Im Kasten sitzen der FI-Schutzschalter und die Sicherungsautomaten. Jeder Automat schützt einen Stromkreis.' },
      { at: '#pal', t: 'Drehstrom', x: 'Das Haus hat drei Phasen. Herd, Wallbox und Durchlauferhitzer sind Drehstromgeräte: Du setzt sie unter „Drehstromgerät“, im Verteiler wählst du einen dreipoligen Automaten, und die Leitung wird fünfadrig. Alles andere hängt einphasig an einer der drei Phasen.' },
      { at: '#pal', t: 'Etagen, Kreuzschalter, Dusche', x: 'Mit „EG“ und „OG“ wechselst du die Etage. Leitungen steigen nur im Treppenhaus nach oben. Neu sind auch Kreuzschalter, Taster mit Stromstoßschalter und die Dusche mit ihrem Schutzbereich (gestrichelter Kreis). Im Betrieb misst das Multimeter, der Zähler im Bedienfeld zählt die Kilowattstunden, und „Leitungen prüfen“ rechnet Spannungsfall und Belastbarkeit.' },
      { at: '#pal', t: 'Bestücken und verdrahten', x: 'Im Zeichenmodus tippst du auf leere Plätze und setzt FI und Automaten ein. Danach ziehst du mit „Leitung“ vom Verteilerkasten zum ersten Gerät und wählst den Abgang. Die Länge ermittelt das Lab selbst.' },
      { at: '#bMenu', t: 'Aufgaben und Häuser', x: 'Im Menü warten 26 Aufgaben: vom Lichtschalter über Wechselschaltung und Verteiler bis zu Drehstrom, Wallbox und dem kompletten Haus. Unter „Beispiele“ findest du vier Häuser fertig und im Rohbau, dazu Lernbeispiele zu Kreuzschaltung, Stromstoß, Bad und Hausanschluss, und das leere Grundstück zum freien Gestalten.' },
      NEXTSTEPS[0], END('HausLab')] },
    sps: { name: 'SPS-Lab', steps: [
      { t: 'Willkommen im SPS-Lab', x: 'Hier programmierst du eine speicherprogrammierbare Steuerung (SPS) und testest sie an einer animierten Anlage: Förderband, Ampel, Tank oder Garagentor. Ich zeige dir in wenigen Minuten, wie das geht.' },
      { prep: a => { a.load('Selbsthaltung'); a.go('prog'); }, at: '#edHost', t: 'Das Programm', x: 'Ich habe dir ein Beispiel geladen: die Selbsthaltung für ein Förderband in KOP (Kontaktplan). Links stehen die Eingänge (Taster, Sensoren), rechts die Ausgänge (Schütz, Lampe). Die SPS liest alle Eingänge, rechnet das Programm durch, setzt die Ausgänge und beginnt von vorn. Das nennt man den Zyklus.' },
      { at: '#tabs', t: 'Fünf Bereiche', x: 'Anlage zeigt die Maschine, Programm ist der Editor, Simulation zeigt Anlage und Ein- und Ausgänge zusammen, Aufgaben sind die Prüfaufgaben, Lernen erklärt die Grundlagen. Oben im Editor wechselst du zwischen KOP, FUP (Funktionsplan) und GRAFCET und siehst alles auch als Text.' },
      { at: '#pal', t: 'Leiste unten', x: 'Hier stehen Start, Schritt (ein einzelner Zyklus) und Reset, der Zeitraffer, die Umschaltung zwischen IEC (%IX0.0, AND) und Siemens (E0.0, U), die Symbole und die lustigen Effekte mit Ton.' },
      { prep: a => a.go('sim'), at: '#bRun', gate: a => a.running(), t: 'Starten', x: 'Tippe auf Start (▶). Die SPS beginnt, ihre Zyklen zu rechnen. Die Anlage reagiert erst, wenn du einen Eingang betätigst.' },
      { at: '#simPanel', gate: () => { const S = window.SPS_UI && window.SPS_UI.S; if (!S || !S.plc) return false; const q = S.plc.state().Q; return Object.keys(q).some(k => q[k]); }, t: 'Eingang betätigen', x: 'Tippe in der Liste auf den Taster S1_Start. Ein Ausgang wird gesetzt und das Band läuft an, auch wenn du den Taster wieder loslässt: Das ist die Selbsthaltung. Mit dem kleinen „F“ kannst du einen Wert fest vorgeben (Zwangssetzen), das hilft bei der Fehlersuche.' },
      { at: '#cv', t: 'Die Anlage', x: 'Hier siehst du die Anlage in Bewegung. Werkstücke laufen über das Band, Sensoren melden sie der SPS. Bei Fehlern in deinem Programm passiert etwas Sichtbares: Werkstücke fallen herunter, der Tank läuft über oder ein Auto wird eingeklemmt.' },
      { at: '#bMenu', t: 'Aufgaben, Beispiele, Anlagen', x: 'Im Menü warten 24 Aufgaben mit automatischer Prüfung: von der Selbsthaltung über Zeitglieder und Zähler bis zu GRAFCET, Fehlersuche und Aufgaben im Prüfungsstil. Dazu 18 Beispiele und vier Anlagen. Tipps gibt es in drei Stufen.' },
      NEXTSTEPS[0], END('SPS-Lab')] },
    pcb: { name: 'Leiterplatten-Lab', steps: [
      { t: 'Willkommen im Leiterplatten-Lab', x: 'Hier entwirfst du echte Leiterplatten mit mehreren Lagen, siehst, wie sie gefertigt, bestückt und geprüft werden, und suchst Fehler auf defekten Platinen. Ich zeige dir in wenigen Minuten, wo was ist.' },
      { prep: a => { a.load('exnetz'); a.go('edit'); }, at: '#viewHost', t: 'Das Layout', x: 'Ich habe dir ein Netzteil geladen. Rot ist die Oberseite, blau die Unterseite, gestrichelte Linien zeigen noch offene Verbindungen. Mit zwei Fingern oder dem Mausrad zoomst du. Deine bisherige Platine ist gesichert.' },
      { at: '#tabs', t: 'Sieben Bereiche', x: 'Layout, Lagen, Fertigung, Bestückung, Fehlersuche, Aufgaben und Lernen. Der Weg einer Platine: entwerfen, Lagenaufbau wählen, fertigen lassen, bestücken, prüfen und bei Bedarf reparieren.' },
      { at: '#tabs', gate: a => a.tab() === 'stack', t: 'Zu den Lagen', x: 'Tippe oben auf „Lagen“. Du siehst den Querschnitt: Kupfer, Prepreg, Kern, Lötstopplack. Schalte zwischen 1, 2, 4 und 6 Lagen um. Innenlagen nehmen Masse und Versorgung auf, das macht Signale ruhiger.' },
      { at: '#tabs', gate: a => a.tab() === 'fab', t: 'Zur Fertigung', x: 'Tippe auf „Fertigung“. Hier gibt es die Gerber-Dateien (eine pro Lage), die Herstellungsschritte als Animation, die Kosten und den Bereich „Prüfen“ mit Flying Probe, ICT, AOI, SPI, AXI und Boundary Scan.' },
      { at: '#tabs', gate: a => a.tab() === 'asm', t: 'Zur Bestückung', x: 'Tippe auf „Bestückung“. Dort stehen der Bestückungsplan, die Stückliste und das Löten: Reflow-Ofen für SMD und Handlöten für THT. Auch Tombstone und Lötbrücken kannst du hier erzeugen und verstehen.' },
      { at: '#tabs', gate: a => a.tab() === 'repair', t: 'Zur Fehlersuche', x: 'Tippe auf „Fehlersuche“. Mit Multimeter und Lupe findest du Fehler auf einer defekten Platine: Haarriss, Brücke, verpoltes Bauteil. Messen statt raten.' },
      { at: '#bMenu', t: 'Aufgaben und Beispiele', x: 'Im Menü warten 43 Aufgaben mit automatischer Prüfung: von Pads und Raster über Leiterbahnbreite, Mehrlagen und Layout bis zu Fertigung, Löten, Fehlersuche und Prüfungsaufgaben. Dazu 21 Beispiele. Tipps gibt es in drei Stufen.' },
      NEXTSTEPS[0], END('Leiterplatten-Lab')] },
    ant: { name: 'Antriebs-Lab', steps: [
      { t: 'Willkommen im Antriebs-Lab', x: 'Hier untersuchst du Motoren und Antriebe an fünf animierten Prüfständen: Gleichstrommotor mit H-Brücke, Servo, Schrittmotor, Drehstrommotor und Getriebe. Ich zeige dir in wenigen Minuten, wo was ist.' },
      { prep: a => { a.load('dc-pwm'); a.go('rig'); }, at: '#cv', t: 'Der Prüfstand', x: 'Ich habe dir den Gleichstrommotor mit PWM geladen. Das Bild zeigt Netzteil, H-Brücke, Motor und Bremse. Dein bisheriger Versuch ist gesichert.' },
      { at: '#pal', gate: a => a.running(), t: 'Starten', x: 'Tippe unten auf Start. Der Prüfstand rechnet jetzt in Echtzeit: Der Motor läuft hoch, die Messgeräte bewegen sich.' },
      { at: () => { const H = document.getElementById('ctlHost'); const c = H && [...H.children].find(k => /PWM/.test(k.textContent.slice(0, 40))); if (c && c.getBoundingClientRect().top > innerHeight - 80) c.scrollIntoView({ block: 'center' }); return c || H; }, t: 'Das Bedienpult', x: 'Hier stehen die Regler und Schalter des Prüfstands. Verstelle zum Beispiel den Tastgrad: Bei mehr PWM-Anteil bekommt der Motor im Mittel mehr Spannung und dreht schneller. Die Last bremst ihn wieder.' },
      { at: '#meters', t: 'Die Messgeräte', x: 'Drehzahl, Strom, Moment, Leistung und Temperatur siehst du an den Anzeigen. Ein roter Bereich warnt dich: Dort wird es für den Motor ungesund.' },
      { at: '#tabs', t: 'Sechs Bereiche', x: 'Prüfstand zum Bedienen, Kennlinien zum Auswerten, Ablauf für Schaltfolgen wie den Stern-Dreieck-Anlauf, Rechnen für Typenschild und Getriebe, Aufgaben mit Prüfung und Lernen mit den Grundlagen.' },
      { prep: a => a.go('curves'), at: '#tabs', gate: a => a.tab() === 'curves', t: 'Kennlinien', x: 'Tippe auf „Kennlinien“. Die Kurven werden aus dem Modell berechnet, der Marker zeigt deinen aktuellen Betriebspunkt. Darunter schreibt der Zeitschreiber Drehzahl, Strom, Moment und Temperatur der letzten Sekunden mit.' },
      { at: '#tabs', gate: a => a.tab() === 'seq', t: 'Ablauf', x: 'Tippe auf „Ablauf“. Hier schreibst du eine Schaltfolge als Tabelle: nach so vielen Sekunden setze diesen Wert. Damit baust du einen Stern-Dreieck-Anlauf oder eine Richtungsumkehr ohne Kurzschluss.' },
      { at: '#tabs', gate: a => a.tab() === 'calc', t: 'Rechnen', x: 'Tippe auf „Rechnen“. Der Rechner zeigt den Rechenweg für Leistung, Wirkungsgrad, Schlupf und Übersetzung. Der Typenschild-Rechner ist wie in der Prüfung.' },
      { at: '#bMenu', t: 'Aufgaben und Beispiele', x: 'Im Menü warten 30 Aufgaben mit automatischer Prüfung: von Leistung und Wirkungsgrad über PWM, Servo, Schrittmotor, Stern-Dreieck und Getriebe bis zur Fehlersuche und Aufgaben im Prüfungsstil. Dazu 22 Beispiele. Tipps gibt es in drei Stufen.' },
      NEXTSTEPS[0], END('Antriebs-Lab')] },
    sen: { name: 'Sensorik-Lab', steps: [
      { t: 'Willkommen im Sensorik-Lab', x: 'Hier untersuchst du Sensoren und Messketten an sieben animierten Prüfständen: Temperatur, Licht und Näherung, Kraft und Druck, Beschleunigung, Normsignale, digitale Sensoren und ADU. Ich zeige dir in wenigen Minuten, wo was ist.' },
      { prep: a => { a.load('NTC im Spannungsteiler'); a.go('rig'); }, at: '#cv', t: 'Die Messkette', x: 'Ich habe dir den NTC im Spannungsteiler geladen. Das Bild zeigt die Messkette: Messgröße, Sensor, Signalaufbereitung, Wandler und Anzeige. Dein bisheriger Versuch ist gesichert.' },
      { at: '#pal', gate: a => a.running(), t: 'Starten', x: 'Tippe unten auf Start. Der Prüfstand rechnet jetzt in Echtzeit: Die Signale laufen durch die Messkette, die Messgeräte bewegen sich.' },
      { at: () => { const H = document.getElementById('ctlHost'); const c = H && [...H.children].find(k => /Temperatur der Messstelle/.test(k.textContent.slice(0, 60))); if (c && c.getBoundingClientRect().top > innerHeight - 80) c.scrollIntoView({ block: 'center' }); return c || H; }, t: 'Das Bedienpult', x: 'Hier stehen die Regler und Schalter des Prüfstands. Verstelle die Temperatur der Messstelle: Der Sensor folgt mit seiner Zeitkonstante, der Widerstand ändert sich, die Spannung und der Zählwert auch.' },
      { at: '#meters', t: 'Die Messgeräte', x: 'Wahre Temperatur, angezeigte Temperatur, Fehler, Sensorwiderstand, Ausgangsspannung und ADU-Zählwert siehst du an den Anzeigen. Eine Abweichung zwischen wahr und angezeigt verrät dir Messfehler.' },
      { at: '#tabs', t: 'Sechs Bereiche', x: 'Prüfstand zum Bedienen, Kennlinien zum Auswerten, Ablauf für Messfolgen wie einen Temperatursprung, Rechnen für Sensor- und Brückenformeln, Aufgaben mit Prüfung und Lernen mit den Grundlagen.' },
      { prep: a => a.go('curves'), at: '#tabs', gate: a => a.tab() === 'curves', t: 'Kennlinien', x: 'Tippe auf „Kennlinien“. Die Kurven werden aus dem Modell berechnet, der Marker zeigt deinen aktuellen Betriebspunkt. Darunter schreibt der Zeitschreiber die Messwerte der letzten Sekunden mit.' },
      { at: '#tabs', gate: a => a.tab() === 'seq', t: 'Ablauf', x: 'Tippe auf „Ablauf“. Hier schreibst du eine Folge als Tabelle: nach so vielen Sekunden setze diesen Wert. Damit baust du zum Beispiel einen Temperatursprung oder einen Drahtbruch zu einem bestimmten Zeitpunkt.' },
      { at: '#tabs', gate: a => a.tab() === 'calc', t: 'Rechnen', x: 'Tippe auf „Rechnen“. Der Rechner zeigt den Rechenweg für NTC und Pt100, Brückenspannung, Verstärkung, Bürde, ADU-Stufe und Aliasing.' },
      { at: '#bMenu', t: 'Aufgaben und Beispiele', x: 'Im Menü warten 28 Aufgaben mit automatischer Prüfung: von der DMS-Brücke über Pt100 und Leitungsfehler, Schaltabstand, Kalibrierung, Normsignale und I²C bis zur Fehlersuche und Aufgaben im Prüfungsstil. Dazu 27 Beispiele. Tipps gibt es in drei Stufen.' },
      NEXTSTEPS[0], END('Sensorik-Lab')] },
    ds: { name: 'Datenblatt-Lab', steps: [
      { t: 'Willkommen im Datenblatt-Lab', x: 'Hier lernst du, Datenblätter zu lesen: Grenzwerte, Tabellen, Kennlinien, Thermik und Fachenglisch. Das brauchst du in der Abschlussprüfung. Die Datenblätter im Lab sind Übungsdatenblätter, angelehnt an echte Bauteile. Maßgeblich sind immer die Datenblätter der Hersteller.' },
      { prep: a => { a.load('Grenzwerte lesen'); a.go('lib'); }, at: '#vwLib', t: 'Das Datenblatt', x: 'Ich habe dir das Datenblatt des TF-BC547 geladen. Es sieht aus wie ein Blatt Papier: Titel und Merkmale, Pinbelegung, Grenzwerte, Kennwerte, Kennlinien, Thermik, Gehäuse und Anwendung. Dein bisheriger Arbeitsstand ist gesichert.' },
      { at: '#libSide', t: 'Die Bibliothek', x: 'Hier wählst du eines der 16 Übungsdatenblätter aus, von der Diode über Transistoren und Regler bis zum I²C-Baustein. Mit dem Filter suchst du nach Bauteilfamilien.' },
      { at: '#vwLib', gate: a => a.marks() > 0, optional: true, t: 'Eine Zeile markieren', x: 'Tippe in den Absolute Maximum Ratings oder den Recommended Operating Conditions auf eine Zeile, um sie zu markieren. So merkst du dir, woher ein Wert stammt. Beim Antippen siehst du auch den Unterschied: Grenzwerte sind keine Betriebswerte. (Du kannst den Schritt überspringen.)' },
      { at: '#tabs', t: 'Sieben Bereiche', x: 'Bibliothek zum Lesen, Lesen üben mit Fragen, Fachenglisch zum Vokabeln lernen, Bauteilwahl, Rechnen, Aufgaben mit Prüfung und Lernen mit den Grundlagen.' },
      { prep: a => a.go('read'), at: '#tabs', gate: a => a.tab() === 'read', t: 'Lesen üben', x: 'Tippe auf „Lesen üben“. Du bekommst eine Frage zu einem Datenblatt und suchst die Antwort im Blatt: in der Tabelle oder in einer Kennlinie. Bei Kennlinien zeigst du den Wert mit dem Fadenkreuz und tippst auf „Wert übernehmen“.' },
      { at: '#tabs', gate: a => a.tab() === 'engl', t: 'Fachenglisch', x: 'Tippe auf „Fachenglisch“. Mit Karteikarten lernst du die Begriffe, die in Datenblättern vorkommen. Karten, die du kannst, kommen seltener, schwere öfter.' },
      { at: '#tabs', gate: a => a.tab() === 'pick', t: 'Bauteilwahl', x: 'Tippe auf „Bauteilwahl“. Du bekommst Anforderungen wie Spannung, Strom und Gehäuse und wählst das passende Bauteil. Danach prüft das Lab deine Wahl gegen die Datenblattwerte und begründet sie.' },
      { at: '#tabs', gate: a => a.tab() === 'calc', t: 'Rechnen', x: 'Tippe auf „Rechnen“. Der Rechner zeigt den Rechenweg für LED-Vorwiderstand, Verlustleistung und Sperrschichttemperatur, Derating, E-Reihen und Toleranzen. Werte kannst du direkt aus einem Datenblatt übernehmen.' },
      { at: '#bMenu', t: 'Aufgaben und Beispiele', x: 'Im Menü warten 34 Aufgaben mit automatischer Prüfung: von Grenzwerten und Kennwerten über Kennlinien, Thermik und Bauteilwahl bis zu Zeitdiagrammen, Fachenglisch, Fehlersuche und Aufgaben im Prüfungsstil. Dazu 14 Beispiele. Tipps gibt es in drei Stufen.' },
      NEXTSTEPS[0], END('Datenblatt-Lab')] },
    reg: { name: 'Regelungstechnik-Lab', steps: [
      { t: 'Willkommen im Regelungstechnik-Lab', x: 'Hier lernst du, wie ein Regler eine Größe auf einem Sollwert hält: Füllstand, Durchfluss, Raumtemperatur, Thermostat, Drehzahl und Lage an sieben animierten Prüfständen. Ich zeige dir in wenigen Minuten, wo was ist. Die Anlagen sind Übungsanlagen.' },
      { prep: a => { a.load('Füllstand P-Regler'); a.go('rig'); }, at: '#cv', t: 'Der Prüfstand', x: 'Ich habe dir die Füllstandsregelung geladen. Das Bild zeigt Tank, Pumpe und Entnahmeventil. Der Regler soll den Füllstand (die Regelgröße) auf dem Sollwert halten, indem er die Pumpe (das Stellglied) ansteuert. Dein bisheriger Versuch ist gesichert.' },
      { at: '#pal', gate: a => a.running(), t: 'Starten', x: 'Tippe unten auf Start. Der Prüfstand rechnet jetzt: Die Pumpe füllt den Tank, der Messschreiber zeichnet Sollwert, Istwert und Stellgröße mit.' },
      { at: '#meters', t: 'Die Messgeräte', x: 'Sollwert, Istwert, Regeldifferenz e und Stellgröße y stehen an den Anzeigen. Die Regeldifferenz ist der Sollwert minus der Istwert: Der Regler stellt so lange nach, bis sie klein ist.' },
      { at: '#scopeHost', t: 'Der Messschreiber', x: 'Hier siehst du den Verlauf: Sollwert w, Istwert x und Stellgröße y über der Zeit. Daran erkennst du, wie gut der Regler arbeitet: ob der Istwert den Sollwert erreicht, ob er überschwingt und wie lange er braucht.' },
      { at: () => { const H = document.getElementById('ctlHost'); const c = H && [...H.children].find(k => /Regler/.test(k.textContent.slice(0, 30))); if (c && c.getBoundingClientRect().top > innerHeight - 80) c.scrollIntoView({ block: 'center' }); return c || H; }, t: 'Das Bedienpult', x: 'Hier stehen die Einstellungen: Sollwert, Reglerart und Verstärkung Kp sowie die Störgröße. Ändere den Sollwert und sieh zu, wie der Istwert nachläuft. Mit einem reinen P-Regler bleibt meistens eine Regelabweichung stehen. Dagegen hilft ein I-Anteil.' },
      { at: '#ctlHost', t: 'Hand und Automatik', x: 'In der Betriebsart Hand stellst du die Stellgröße selbst ein, der Regler ist abgeschaltet. In Automatik regelt er. Beim Umschalten springt die Stellgröße nicht. So findest du den Arbeitspunkt, bevor du den Regler einschaltest.' },
      { at: '#tabs', t: 'Sieben Bereiche', x: 'Prüfstand zum Bedienen, Strecke messen für die Sprungantwort, Regler einstellen mit Einstellregeln, Ablauf für Sprünge nach Zeitplan, Rechnen, Aufgaben mit Prüfung und Lernen mit den Grundlagen.' },
      { prep: a => a.go('meas'), at: '#tabs', gate: a => a.tab() === 'meas', t: 'Strecke messen', x: 'Tippe auf „Strecke messen“. Du fährst einen Arbeitspunkt an, löst einen Sprung der Stellgröße aus und legst an der aufgezeichneten Kurve die Wendetangente an. So liest du Ks, Tu und Tg ab. Damit weißt du, wie die Regelstrecke reagiert, bevor du den Regler einstellst.' },
      { at: '#tabs', gate: a => a.tab() === 'tune', t: 'Regler einstellen', x: 'Tippe auf „Regler einstellen“. Aus den gemessenen Kennwerten berechnen Einstellregeln wie Ziegler-Nichols einen Vorschlag für Kp, Tn und Tv. Danach prüfst du am Prüfstand, wie gut er regelt: Überschwingen, Ausregelzeit und bleibende Abweichung.' },
      { at: '#tabs', gate: a => a.tab() === 'calc', t: 'Rechnen', x: 'Tippe auf „Rechnen“. Der Rechner zeigt den Rechenweg für Proportionalbereich, Kreisverstärkung, bleibende Abweichung, Einstellregeln, Zweipunktregler und die Umrechnung von Normsignalen in der SPS.' },
      { at: '#bMenu', t: 'Aufgaben und Beispiele', x: 'Im Menü warten 30 Aufgaben mit automatischer Prüfung: von den Anlagenteilen und dem P-Regler über Sprungantwort, Einstellregeln, Zweipunktregler und Windup bis zur Stabilität, Fehlersuche und Aufgaben im Prüfungsstil. Dazu 24 Beispiele. Tipps gibt es in drei Stufen.' },
      NEXTSTEPS[0], END('Regelungstechnik-Lab')] },
    thm: { name: 'Thermik-Lab', steps: [
      { t: 'Willkommen im Thermik-Lab', x: 'Hier lernst du, wo im Gerät die Wärme entsteht und wie sie abgeführt wird: Linearregler, Leistungstransistor, MOSFET, Diode, Widerstand und LED an fünf animierten Prüfständen. Ich zeige dir in wenigen Minuten, wo was ist. Alle Bauteile sind Übungsbauteile mit Übungswerten.' },
      { prep: a => { a.load('7805 ohne Kühlkörper: Abschaltung'); a.go('rig'); }, at: '#cv', t: 'Der Prüfstand', x: 'Ich habe dir den Spannungsregler 7805 ohne Kühlkörper geladen. Das Bild zeigt das Gehäuse im Schnitt: Die Wärme entsteht in der Sperrschicht und fließt über das Gehäuse in die Luft. Dein bisheriger Versuch ist gesichert.' },
      { at: '#pal', gate: a => a.running(), t: 'Starten', x: 'Tippe unten auf Start. Der Prüfstand rechnet jetzt die Erwärmung. Mit dem Tempo unten lässt du die Zeit schneller laufen.' },
      { at: '#meters', t: 'Die Messgeräte', x: 'Hier stehen die Verlustleistung und die Temperaturen: Sperrschicht, Gehäuse, Kühlkörper und Umgebung. Die Verlustleistung ist die Wärmeleistung, die im Bauteil entsteht. Beim Linearregler ist sie die Spannungsdifferenz mal der Laststrom.' },
      { at: '#scopeHost', t: 'Der Messschreiber', x: 'Der Schreiber zeichnet die Temperaturen über der Zeit. Die Kurven springen nicht, sie laufen auf einen Endwert zu: Das Bauteil speichert Wärme. Kommt die Sperrschicht an ihre Grenze, schaltet der Regler ab. Dann ist er wieder kühler und läuft wieder an.' },
      { at: '#ctlHost', t: 'Das Bedienpult', x: 'Hier stellst du Eingangsspannung, Laststrom und die Montage ein. Ändere den Laststrom und beobachte: Die Verlustleistung wächst mit dem Strom, und mit ihr die Temperatur.' },
      { at: '#ctlHost', gate: a => a.montageChanged(), t: 'Kühlkörper montieren', x: 'Such in der Gruppe „Montage und Umgebung“ den Kühlkörper und wähle eine Größe. Probiere danach Glimmerscheibe und Wärmeleitpaste. Jedes Glied der Kette hat einen Wärmewiderstand, und die Widerstände addieren sich.' },
      { at: '#rigBar', gate: a => a.viewChanged(), optional: true, t: 'Wärmebild und Ersatzschaltbild', x: 'In der Leiste über dem Bild wechselst du die Ansicht: Schnitt, Wärmebild, Ersatzschaltbild und Balken. Das Wärmebild zeigt, wo es heiß ist, der Balken, wie viel Temperaturunterschied jedes Glied der Kette verbraucht. (Du kannst den Schritt auch überspringen.)' },
      { at: '#tabs', t: 'Sechs Bereiche', x: 'Prüfstand zum Bedienen, Rechnen mit dem Berechnungsgang, Vergleichen von drei Aufbauten nebeneinander, Ablauf für Änderungen nach Zeitplan, Aufgaben mit Prüfung und Lernen mit den Grundlagen.' },
      { prep: a => a.go('calc'), at: '#tabs', gate: a => a.tab() === 'calc', t: 'Rechnen', x: 'Tippe auf „Rechnen“. Der Prüfungsassistent führt dich Schritt für Schritt von der Verlustleistung über die Wärmewiderstandskette bis zum nötigen Kühlkörper. Jeder Rechenweg wird mit Zahlen und Einheiten gezeigt.' },
      { at: '#tabs', gate: a => a.tab() === 'cmp', t: 'Vergleichen', x: 'Tippe auf „Vergleichen“. Drei Aufbauten laufen nebeneinander, zum Beispiel ohne Paste, mit Paste und mit größerem Kühlkörper. So siehst du sofort, welche Maßnahme wie viel bringt.' },
      { at: '#bMenu', t: 'Aufgaben und Beispiele', x: 'Im Menü warten 30 Aufgaben mit automatischer Prüfung: von der Verlustleistung über die Wärmekette, Montage und Kühlkörperwahl bis zu Fehlersuche und Prüfungsaufgaben. Dazu 24 Beispiele. Tipps gibt es in drei Stufen.' },
      NEXTSTEPS[0], END('Thermik-Lab')] },
    vb: { name: 'Verbundprojekte', steps: [
      { t: 'Willkommen bei den Verbundprojekten', x: 'Hier bauen alle Labs zusammen ein Gerät: Garagentor, Ampel, Uhr, Gartenbewässerung oder Förderanlage. Jede Station arbeitet in einem Lab und liefert ihr Ergebnis an die nächste. Ich zeige dir in wenigen Minuten, wie das geht.' },
      { at: () => document.getElementById('view'), t: 'Fünf Projekte', x: 'Wähle ein Projekt und eine Stufe: Einsteiger mit Starthilfen, Standard oder Profi. Dein Name und die Stufe bestimmen das Lastenheft, also die Zahlen deines Auftrags. Wer im Team arbeitet, nimmt denselben Teamnamen.' },
      { at: () => document.getElementById('view'), gate: a => a.started(), optional: true, t: 'Projekt starten', x: 'Tippe bei einem Projekt auf „Starten“ und lege es an. Du kannst es später zurücksetzen, eine Sicherung bleibt erhalten. (Du kannst den Schritt überspringen.)' },
      { at: () => document.getElementById('view'), gate: a => a.lastenheftOpened(), optional: true, t: 'Das Lastenheft', x: 'Im Projekt klappst du das Lastenheft auf. Dort stehen die Anforderungen: Spannungen, Ströme, Zeiten, Toleranzen. Alle Stationen prüfen dein Ergebnis gegen diese Werte.' },
      { at: () => document.getElementById('view'), t: 'Die Phasenleiste', x: 'Die Phasenleiste zeigt alle Stationen in der Reihenfolge des Projekts, jede mit dem Symbol des Labs, in dem du arbeitest, und ihrem Stand. Eine Station wird erst frei, wenn die vorige bestanden ist (🔒 gesperrt, ▶ offen, ⚠ nicht bestanden, ✓ bestanden). ↻ „Eingang geändert“ heißt: Eine Vorstation hat neue Daten geliefert, du prüfst und übergibst noch einmal.' },
      { at: () => document.getElementById('view'), gate: a => a.stationViewed(), optional: true, t: 'Eine Station öffnen', x: 'Tippe auf die nächste offene Station. Du siehst Auftrag, Eingänge von den Vorstationen und einen Knopf, der das passende Lab öffnet. Tipps gibt es in drei Stufen, die dritte zeigt die Musterlösung und wird vermerkt.' },
      { at: () => document.getElementById('view'), t: 'Die Leiste im Lab', x: 'Im Lab erscheint oben eine Leiste mit dem Auftrag. Dort drückst du „Prüfen“ (nichts wird gespeichert) und „Übergeben“ (das Ergebnis geht an die nächste Station). Ohne Projekt bleibt die Leiste unsichtbar, das Lab arbeitet wie immer.' },
      { at: () => document.getElementById('view'), t: 'Der Gesamttest', x: 'Sind alle Stationen bestanden, prüft der Gesamttest das fertige Gerät mit Kennzahlen. Danach gibt es Abschlussbericht und Zertifikat mit Medaille. Das druckst du als A4-Seite aus dem Menü.' },
      { at: () => document.getElementById('view'), t: 'Teilen und Teamarbeit', x: 'Über „Teilen“ erzeugst du einen Code, einen Link oder einen QR für deinen Partner oder als Sicherung. Der Partner braucht denselben Teamnamen und dieselbe Stufe, dann passt das Lastenheft.' },
      { at: '#bMenu', t: 'Menü', x: 'Im Menü findest du Bericht, Zertifikat, Teilen, Abzeichen, die Kampagne und diesen Trainer. Den Ausbilder-Bereich mit Musterlösungen und Beispielständen öffnet nur der Ausbilder.' },
      NEXTSTEPS[0], END('Projekte')] },
    pr: { name: 'Prüfungs-Lab', steps: [
      { t: 'Willkommen im Prüfungs-Lab', x: 'Hier übst du für die Abschlussprüfung: Themen trainieren, Rechenaufgaben lösen und Probeprüfungen mit Zeitlimit machen. Am Ende weißt du, wo du stehst.' },
      { at: '#tabs', t: 'Die sechs Bereiche', x: 'Start, Probeprüfung, Training, Auswertung, Formeln und Aufgaben. Ein guter Weg: erst Themen üben, dann Probeprüfung, dann die Schwächen beheben.' },
      { at: '#tabs', gate: () => (window.LabTrainerAPI && window.LabTrainerAPI.tab() === 'training'), t: 'Zum Training', x: 'Tippe oben auf „Training“. Du wählst ein Thema und bekommst zehn Fragen. Nach jeder Antwort siehst du sofort die Erklärung oder den Lösungsweg.' },
      { at: '#view', t: 'Rechnen mit Einheit', x: 'Bei Rechenaufgaben gibst du nur die Zahl ein. Die Einheit steht daneben. Rundungen bis 2 % gelten als richtig, Komma oder Punkt sind egal.' },
      { at: '#tabs', gate: () => (window.LabTrainerAPI && window.LabTrainerAPI.tab() === 'pruefung'), t: 'Zur Probeprüfung', x: 'Tippe auf „Probeprüfung“. Es gibt 20 Aufgaben mit Zeitlimit. Am Ende bekommst du Punkte, eine Note nach dem IHK-Schlüssel und eine Auswertung nach Themen.' },
      { at: '#tabs', gate: () => (window.LabTrainerAPI && window.LabTrainerAPI.tab() === 'auswertung'), t: 'Auswertung', x: 'Tippe auf „Auswertung“. Dort siehst du, welche Themen noch schwach sind, mit einem Lernplan und dem passenden Lab zum Ausprobieren.' },
      { at: '#bMenu', t: 'Aufgaben, Abzeichen, Hilfe', x: 'Im Menü findest du die Aufgaben, die Formelsammlung, Abzeichen, die Kampagne und diesen Trainer.' },
      NEXTSTEPS[0], END('Prüfungs-Lab')] },
    app: { name: 'App-Werkstatt', steps: [
      { t: 'Willkommen in der App-Werkstatt', x: 'Hier baust du eigene kleine Apps und deinen eigenen Wissensspeicher. Die Arbeit macht eine KI (Claude, ChatGPT oder eine andere), du gibst den Auftrag und prüfst das Ergebnis. Vorkenntnisse brauchst du nicht.' },
      { at: '#tabs', t: 'Die sechs Bereiche', x: 'Start, Auftrag, Werkstatt, Notizen, Bibliothek und Aufgaben. Der Weg: Auftrag schreiben, Code in der Werkstatt starten, prüfen, verbessern, speichern.' },
      { at: '#tabs', gate: () => (window.LabTrainerAPI && window.LabTrainerAPI.tab() === 'auftrag'), t: 'Zum Auftrag', x: 'Tippe oben auf „Auftrag“. Dort setzt der Baukasten einen guten Auftrag für dich zusammen. Er nennt sieben Dinge: Art der App, Zielgruppe, Thema, Bedienung, Technik, Umfang und Ausgabe.' },
      { at: '#view', t: 'Auftrag kopieren', x: 'Mit „Auftrag kopieren“ nimmst du den Text mit in die KI deiner Wahl. Kopiere die Antwort der KI (den ganzen Code) wieder zurück. Unten kannst du auch einen eigenen Auftrag prüfen lassen.' },
      { at: '#tabs', gate: () => (window.LabTrainerAPI && window.LabTrainerAPI.tab() === 'werkstatt'), t: 'Zur Werkstatt', x: 'Tippe jetzt auf „Werkstatt“. Dort fügst du den Code ein und startest die App. Sie läuft abgeschottet: Sie sieht weder deinen Fortschritt noch das Internet.' },
      { at: '#view', t: 'Prüfen statt glauben', x: 'Unter der Vorschau stehen Meldungen. Fehlermeldungen kopierst du in deine nächste Eingabe an die KI. Aber auch ohne Fehler gilt: Rechne Zahlen nach und prüfe Aussagen, die KI behauptet manchmal Falsches.' },
      { at: '#tabs', gate: () => (window.LabTrainerAPI && window.LabTrainerAPI.tab() === 'notizen'), t: 'Notizen', x: 'Tippe auf „Notizen“. Hier baust du dein Wissen auf: eigene Notizen, mit [[Doppelklammern]] verknüpft. Der Export als ZIP öffnet sich in der App Obsidian.' },
      { at: '#bMenu', t: 'Aufgaben, Abzeichen, Hilfe', x: 'Im Menü findest du die Aufgaben, Abzeichen, die Kampagne und diesen Trainer. Die Aufgaben führen dich in sechs Stufen vom ersten Start bis zur eigenen Lernapp für die Klasse.' },
      NEXTSTEPS[0], END('App-Werkstatt')] },
    mess: { name: 'MessLab', steps: [
      { t: 'Willkommen im MessLab', x: 'Hier lernst du Messen wie ein Profi: mit Multimeter, Oszilloskop, Netzgerät, Funktionsgenerator und mehr. Ich zeige dir in wenigen Minuten, wie die Werkbank funktioniert.' },
      { prep: a => a.load('Spannung messen'), at: '#cv', t: 'Eine Messschaltung', x: 'Ein Spannungsteiler aus zwei Widerständen an 9 V. Wie viel Spannung fällt an jedem Widerstand ab? Das messen wir gleich.' },
      { at: '#bSim', gate: a => a.simMode(), t: 'Auf Simulation schalten', x: 'Messen geht nur bei laufender Schaltung (außer Widerstände). Schalte oben von Zeichnen auf Sim.' },
      { at: '#side', t: 'Die Werkbank', x: 'Rechts findest du die Karte „Werkbank“. Dort öffnest du alle Messgeräte. Tippe gleich auf „Messgeräte öffnen“.' },
      { at: '#pal', gate: () => { const b = document.querySelector('.wbdock'); return !!b && b.style.display !== 'none'; }, t: 'Werkbank öffnen', x: 'Tippe rechts auf „Messgeräte öffnen“. Unten erscheint die Werkbank mit Netzgerät, Funktionsgenerator, Multimeter und Oszilloskop.' },
      { at: '.wbdock', t: 'Fest oder frei', x: 'Die Geräte sitzen fest unten in einer Leiste. Mit „Frei“ rechts oben werden sie zu Fenstern, die du verschieben kannst. In der Leiste schaltest du jedes Gerät ein und aus, auch Frequenzzähler, Leistungsmesser und Kennlinienschreiber.' },
      { at: '.wbdock', t: 'Das Multimeter', x: 'Der Drehschalter wählt, was gemessen wird: V⎓ Gleichspannung, V∿ Wechselspannung, A Strom, Ω Widerstand. Strom gehört in die mA- oder 10-A-Buchse, Spannung in die VΩ-Buchse. Falsch gewählt, bekommst du Hinweise oder brennt die Sicherung durch.' },
      { at: '.wbdock', t: 'Messen', x: 'Tippe im Multimeter auf „Messspitzen setzen“, dann auf den oberen und den unteren Anschluss von R2: erst rot, dann schwarz. Die Anzeige zeigt 6 V. Probiere auch R1: Die zwei Spannungen ergeben zusammen 9 V.' },
      { at: '.wbdock', t: 'Oszilloskop und mehr', x: 'Das Oszilloskop zeichnet den Spannungsverlauf über der Zeit. Mit „Messpunkt setzen“ wählst du, was du sehen willst. Die Beispiele „Sinus am Oszilloskop“ und „RC-Tiefpass mit Rechteck“ eignen sich zum Üben.' },
      { at: '#bMenu', t: 'Aufgaben mit Zahlen', x: 'Im Menü warten die Messaufgaben: Du misst, trägst die Zahl in ein Feld ein, und das Lab prüft sie gegen den simulierten Wert. Dazu gibt es Messfehler-Aufgaben: Warum zeigt das Gerät Unsinn?' },
      { at: '.wbdock', t: 'Neue Geräte', x: 'In der Werkbank gibt es jetzt den Frequenzgang (Bode-Messplatz mit Grenzfrequenz), den Logikanalysator (digitale Kanäle und Buswert) und das Messprotokoll zum Ausdrucken. Unter der Anzeige des Multimeters steht die Genauigkeit.' },
      NEXTSTEPS[0], END('MessLab')] },
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
    try { const d = JSON.parse(localStorage.getItem('lm4.trainer') || '{}'); d[lab] = 1; localStorage.setItem('lm4.trainer', JSON.stringify(d)); if (root.Badges) root.Badges.stat('trainer', Object.keys(d).filter(k => !((root.LAB_REG || {})[k] || {}).hub).length, 'max'); } catch (e) {}
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
