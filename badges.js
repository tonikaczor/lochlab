/* Abzeichen, Konfetti und Töne (alle Labs). Die Abzeichen werden aus den gespeicherten Ergebnissen berechnet, der Zustand liegt in „lm4.badges“,
   Zähler (GIF, Würfel, Vorhersage ...) in „lm4.stats“. Kein Server: alles bleibt auf dem Gerät und geht mit dem Ergebnis-Code an den Ausbilder. */
(function () {
  var get = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  var set = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function ui() { return { sheet: (window.LabUI && window.LabUI.sheet) || window.sheet }; }
  var stats = function () { return get('lm4.stats', {}); }, earned = function () { return get('lm4.badges', {}); };

  function ctx() {
    var R = window.AUFGABEN || [], d = window.Auswertung ? window.Auswertung.own() : {}, h = get('sim.hints', {}), st = stats();
    var ids = function (lab) { return R.filter(function (r) { return r[1] === lab; }).map(function (r) { return r[0]; }); };
    var n = function (list) { return list.filter(function (id) { return (d[id] || 0) >= 100; }).length; };
    var all = R.map(function (r) { return r[0]; });
    return { d: d, h: h, st: st, R: R, ids: ids, n: n, all: all, fehler: R.filter(function (r) { return /Fehlersuche/.test(r[2]); }).map(function (r) { return r[0]; }) };
  }
  var both = function (c, a, b) { return (c.d[a] || 0) >= 100 && (c.d[b] || 0) >= 100 ? 2 : (((c.d[a] || 0) >= 100) + ((c.d[b] || 0) >= 100)); };
  /* id, Symbol, Name, Beschreibung, Fortschritt [ist, soll] */
  var DEFS = [
    ['start', '🎯', 'Erster Treffer', 'Die erste Aufgabe vollständig richtig.', function (c) { return [c.n(c.all), 1]; }],
    ['fuenf', '🔥', 'Dranbleiber', 'Fünf Aufgaben geschafft.', function (c) { return [c.n(c.all), 5]; }],
    ['zehn', '🏅', 'Zehnerpack', 'Zehn Aufgaben geschafft.', function (c) { return [c.n(c.all), 10]; }],
    ['viertel', '🏆', 'Viertelhundert', 'Fünfundzwanzig Aufgaben geschafft.', function (c) { return [c.n(c.all), 25]; }],
    ['ohnetipp', '🧠', 'Ohne Hilfe', 'Drei Aufgaben geschafft, ohne einen Tipp zu brauchen.', function (c) { return [c.all.filter(function (id) { return (c.d[id] || 0) >= 100 && !c.h[id]; }).length, 3]; }],
    ['fehler', '🔍', 'Fehlerjäger', 'Drei Fehlersuche-Aufgaben gelöst.', function (c) { return [c.n(c.fehler) + (c.st.dice || 0), 3]; }],
    ['loeter', '🛠', 'Lötmeister', 'Fünf Aufgaben im LochLab geschafft.', function (c) { return [c.n(c.ids('loch')), 5]; }],
    ['elektro', '⚡', 'Elektroniker', 'Acht Aufgaben im SchaltLab geschafft.', function (c) { return [c.n(c.ids('sch')), 8]; }],
    ['haus', '🏠', 'Haustechniker', 'Sechs Aufgaben im SimLab geschafft.', function (c) { return [c.n(c.ids('sim')), 6]; }],
    ['prog', '💻', 'Programmierer', 'Fünf Aufgaben im Arduino-Lab oder Pi-Lab geschafft.', function (c) { return [c.n(c.ids('code').concat(c.ids('pi'))), 5]; }],
    ['allround', '🌍', 'Allrounder', 'In jedem Lab mindestens eine Aufgabe geschafft.', function (c) { var labs = Object.keys(window.AUFGABEN_LABS || { loch: 1, sch: 1, sim: 1, code: 1, pi: 1 }).filter(function (l) { return !((window.LAB_REG || {})[l] || {}).hub; }); return [labs.filter(function (l) { return c.n(c.ids(l)) > 0; }).length, labs.length]; }],
    ['ampel', '🚦', 'Ampelmeister', 'Projekt Ampel: Plan und Aufbau geschafft.', function (c) { return [both(c, 's17', 'l15'), 2]; }],
    ['daemmer', '🌙', 'Nachtschwärmer', 'Projekt Dämmerungsschalter: Plan und Aufbau geschafft.', function (c) { return [both(c, 's18', 'l16'), 2]; }],
    ['netzteil', '🔌', 'Stromversorger', 'Projekt Netzteil: Plan und Aufbau geschafft.', function (c) { return [both(c, 's19', 'l17'), 2]; }],
    ['film', '🎬', 'Filmreif', 'Eine Animation als GIF aufgenommen.', function (c) { return [c.st.gif || 0, 1]; }],
    ['messprofi', '📏', 'Messprofi', 'Fünf Messungen im Messprotokoll, die innerhalb der Toleranz liegen.', function (c) { return [c.st.protoOk || 0, 5]; }],
    ['wuerfel', '🎲', 'Würfelglück', 'Einen gewürfelten Fehler gefunden.', function (c) { return [c.st.dice || 0, 1]; }],
    ['wuerfel5', '🎰', 'Würfelkönig', 'Fünf gewürfelte Fehler gefunden.', function (c) { return [c.st.dice || 0, 5]; }],
    ['hellseher', '🔮', 'Hellseher', 'Fünf richtige Vorhersagen hintereinander.', function (c) { return [c.st.predictBest || 0, 5]; }],
    ['kapitel4', '🧭', 'Auf dem Weg', 'Vier Kapitel der Kampagne geschafft.', function (c) { return [c.st.kapitel || 0, 4]; }],
    ['kampagne', '🏆', 'Abschlussgerät', 'Die ganze Kampagne geschafft.', function (c) { return [c.st.kampagne || 0, 1]; }],
    ['osziprofi', '📈', 'Oszi-Profi', 'Im Oszilloskop-Trainer alles richtig gemacht.', function (c) { return [c.st.osziPerfekt || 0, 1]; }],
    ['ruhighand', '✋', 'Ruhige Hand', 'Sechs von sechs Lötstellen in der Lötübung gelungen.', function (c) { return [c.st.loetPerfekt || 0, 1]; }],
    ['scharfauge', '🔍', 'Scharfes Auge', 'In der Lupen-Prüfung alle schlechten Lötstellen gefunden, ohne falschen Alarm.', function (c) { return [c.st.lupePerfekt || 0, 1]; }],
    ['detektiv', '🕵️', 'Schaltungs-Detektiv', 'Drei Detektiv-Fälle gelöst.', function (c) { return [c.st.detektiv || 0, 3]; }],
    ['dmm', '🔌', 'Multimeter-Profi', 'Spannung, Wechselspannung, Strom und Widerstand richtig gemessen.', function (c) { return [(c.st.mmV ? 1 : 0) + (c.st.mmAC ? 1 : 0) + (c.st.mmA ? 1 : 0) + (c.st.mmR ? 1 : 0), 4]; }],
    ['einsteiger', '🎓', 'Erste Schritte', 'Den Trainer eines Labs bis zum Ende durchgespielt.', function (c) { return [c.st.trainer || 0, 1]; }],
    ['trainer5', '🧭', 'Alle Labs erkundet', 'Den Trainer in allen Labs durchgespielt.', function (c) { return [c.st.trainer || 0, Object.keys(window.AUFGABEN_LABS || { a: 1, b: 1, c: 1, d: 1, e: 1 }).filter(function (l) { return !((window.LAB_REG || {})[l] || {}).hub; }).length]; }],
    ['duell', '⚔️', 'Duellant', 'Ein Duell zu Ende gebracht.', function (c) { return [c.st.duelle || 0, 1]; }],
    ['escape', '🗝️', 'Ausbruchskünstler', 'Den Escape-Room geschafft.', function (c) { return [c.st.escape || 0, 1]; }],
    ['serie3', '🔥', 'Dreier-Serie', 'Drei Tage hintereinander die Tagesaufgabe gelöst.', function (c) { return [c.st.dailyBest || 0, 3]; }],
    ['serie7', '🌟', 'Wochenläufer', 'Sieben Tage in Folge die Tagesaufgabe gelöst.', function (c) { return [c.st.dailyBest || 0, 7]; }],
    ['digital', '🔢', 'Digitaltechniker', 'Sechs Aufgaben im DigiLab geschafft.', function (c) { return [c.n(c.ids('digi')), 6]; }],
    ['cpu', '🖥️', 'Prozessor-Programmierer', 'Zwei Programme für die Mini-CPU geschrieben, die laufen.', function (c) { return [c.n(['dc1', 'dc2', 'dc3', 'dc4']), 2]; }],
    ['tabelle', '📋', 'Tabellenkünstler', 'Eine Wahrheitstabelle ausgewertet und eine Schaltung daraus bauen lassen.', function (c) { return [(c.st.wt ? 1 : 0) + (c.st.synth ? 1 : 0), 2]; }],
    ['zahlen', '🔟', 'Zahlenakrobat', 'Alle sechs Aufgaben im Zahlenumrechner richtig.', function (c) { return [c.st.zahlPerfekt || 0, 1]; }],
    ['denker', '🤔', 'Vorausdenker', 'Fünf Denkfragen vor dem Start richtig beantwortet.', function (c) { return [c.st.denk || 0, 5]; }],
    ['hausbau', '🏠', 'Elektroinstallateur', 'Sechs Aufgaben im HausLab geschafft.', function (c) { return [c.n(c.ids('haus')), 6]; }],
    ['wechselschalter', '⇅', 'Wechselschalter-Meister', 'Die Wechselschaltung im Flur richtig verdrahtet.', function (c) { return [c.n(['ha4']), 1]; }],
    ['verteilermeister', '▤', 'Verteilermeister', 'Den Verteilerkasten bestückt und ein ganzes Haus installiert.', function (c) { return [c.n(['ha3', 'ha13']), 2]; }],
    ['geschosse', '🪜', 'Treppenhaus-Profi', 'Ein Obergeschoss angeschlossen und die Treppenhausbeleuchtung von zwei Etagen geschaltet.', function (c) { return [c.n(['ha19', 'ha20']), 2]; }],
    ['kreuzprofi', '✕', 'Schaltkünstler', 'Kreuzschaltung und Stromstoßschalter im Haus gebaut.', function (c) { return [c.n(['ha21', 'ha22']), 2]; }],
    ['badschutz', '🚿', 'Badschutz', 'Schutzbereich im Bad eingehalten und die Hauptsicherung gewählt.', function (c) { return [c.n(['ha23', 'ha24']), 2]; }],
    ['spannungsfall', '📉', 'Leitungsrechner', 'Den Spannungsfall einer langen Leitung unter 3 % gebracht und ein Haus mit Obergeschoss komplett installiert.', function (c) { return [c.n(['ha25', 'ha26']), 2]; }],
    ['drehstrom', '⚡', 'Drehstrom-Profi', 'Zwei Drehstrom-Aufgaben im HausLab geschafft.', function (c) { return [c.n(['ha15', 'ha16', 'ha17', 'ha18']), 2]; }],
    ['fehlersucher', '🕵️', 'Elektro-Fehlersucher', 'Beide Fehlersuchen im Haus gelöst.', function (c) { return [c.n(['ha8', 'ha9']), 2]; }],
    ['messer', '📏', 'Messtechniker', 'Sechs Aufgaben im MessLab geschafft.', function (c) { return [c.n(c.ids('mess')), 6]; }],
    ['werkbank', '🔧', 'Werkbank-Meister', 'Netzgerät, Generator, Multimeter und Oszilloskop in der Werkbank benutzt.', function (c) { return [(c.st.bench_psu ? 1 : 0) + (c.st.bench_gen ? 1 : 0) + (c.st.bench_dmm ? 1 : 0) + (c.st.bench_osc ? 1 : 0), 4]; }],
    ['bode', '〽', 'Bode-Meister', 'Einen Frequenzgang aufgenommen und die Grenzfrequenz abgelesen.', function (c) { return [c.st.bode || 0, 1]; }],
    ['tastkopf', '🔬', 'Tastkopf-Abgleicher', 'Einen Tastkopf richtig kompensiert.', function (c) { return [c.n(['m27']), 1]; }],
    ['analysator', '🧮', 'Logik-Beobachter', 'Mit dem Logikanalysator einen Bus beobachtet.', function (c) { return [c.st.la || 0, 1]; }],
    ['protokoll', '📋', 'Protokollführer', 'Ein Messprotokoll ausgedruckt.', function (c) { return [c.st.protDruck || 0, 1]; }],
    ['kvmeister', '🗺', 'KV-Künstler', 'Ein KV-Diagramm benutzt und eine Schaltung daraus gebaut.', function (c) { return [c.n(['d15', 'd16']), 1]; }],
    ['automat', '🤖', 'Automatenbauer', 'Einen Zustandsautomaten gebaut.', function (c) { return [c.n(['d17', 'd18', 'd19']), 1]; }],
    ['unterprog', '↩', 'Unterprogrammierer', 'Mit CALL und RET ein Unterprogramm geschrieben.', function (c) { return [c.n(['dc5', 'dc6']), 1]; }],
    ['kifuehrer', '🪪', 'KI-Führerschein', 'Alle sechs Lektionen zum sicheren Umgang mit KI geschafft.', function (c) { return [c.n(['ap18']), 1]; }],
    ['stromplan', '🗺', 'Stromlaufplan-Leser', 'Fünf Prüfungsschaltungen im MessLab gemessen und berechnet.', function (c) { return [c.n(['mp1', 'mp2', 'mp3', 'mp4', 'mp5', 'mp6', 'mp7', 'mp8', 'mp9']), 5]; }],
    ['pruefpraxis', '🛠', 'Prüfungspraxis', 'Alle vier Arduino-Aufgaben der Prüfungspraxis geschafft.', function (c) { return [c.n(['cp1', 'cp2', 'cp3', 'cp4']), 4]; }],
    ['teilprofi', '🎖', 'Alle Prüfungsteile', 'Teil 1, Systementwurf und Funktions- und Systemanalyse in der Probeprüfung bestanden.', function (c) { return [c.n(['pr14', 'pr15', 'pr16']), 3]; }],
    ['pruefstart', '📝', 'Prüfung bestanden', 'Eine Probeprüfung mit mindestens 50 % bestanden.', function (c) { return [c.n(['pr10']), 1]; }],
    ['pruefgut', '🎓', 'Note 2', 'In einer Probeprüfung mindestens 81 % erreicht.', function (c) { return [c.n(['pr11']), 1]; }],
    ['pruefsehrgut', '🏆', 'Note 1', 'In einer Probeprüfung mindestens 92 % erreicht.', function (c) { return [c.n(['pr12']), 1]; }],
    ['themenprofi', '📚', 'Alle Themen gemeistert', 'Alle acht Prüfungsthemen mit mindestens 80 % geübt.', function (c) { return [c.n(['pr1', 'pr2', 'pr3', 'pr4', 'pr5', 'pr6', 'pr7', 'pr8']), 8]; }],
    ['rechenprofi', '🔥', 'Rechenprofi', 'Zehn Rechenaufgaben in Folge richtig gelöst.', function (c) { return [c.n(['pr9']), 1]; }],
    ['aufsteiger', '📈', 'Aufsteiger', 'In einer späteren Probeprüfung besser als in der ersten.', function (c) { return [c.n(['pr13']), 1]; }],
    ['appbauer', '📱', 'App-Bauer', 'Fünf Aufgaben in der App-Werkstatt geschafft.', function (c) { return [c.n(c.ids('app')), 5]; }],
    ['promptprofi', '✍', 'Auftragsprofi', 'Gute Aufträge für die KI geschrieben.', function (c) { return [c.n(['ap2', 'ap3']), 2]; }],
    ['kipruefer', '🔍', 'KI-Prüfer', 'Fehler in KI-Antworten und in einer App gefunden.', function (c) { return [c.n(['ap7', 'ap9']), 2]; }],
    ['wissensnetz', '🕸', 'Wissensnetz', 'Ein Netz aus verknüpften Notizen gebaut.', function (c) { return [c.n(['ap11', 'ap12']), 2]; }],
    ['obsidianer', '🗂', 'Obsidianer', 'Notizen als ZIP für Obsidian exportiert.', function (c) { return [c.st.appExport || 0, 1]; }],
    ['lernappdev', '🏆', 'Lernapp-Entwickler', 'Die eigene Lernapp für die Klasse gebaut.', function (c) { return [c.n(['ap17']), 1]; }],
    ['kennlinie', '📉', 'Kennlinien-Forscher', 'Mit dem Kennlinienschreiber eine Kennlinie aufgenommen.', function (c) { return [c.st.bench_trace || 0, 1]; }],
    ['messfehler', '🧐', 'Fehlerjäger beim Messen', 'Vier Messfehler-Aufgaben gelöst.', function (c) { return [c.n(['m15', 'm16', 'm17', 'm18', 'm19', 'm20', 'm22']), 4]; }],
    ['zufall', '🎰', 'Zahlenjongleur', 'Eine Zufallsaufgabe mit eigenen Zahlen gelöst.', function (c) { return [c.n(['r1', 'r2', 'r3', 'r4']) , 1]; }],
    ['spserste', '🏭', 'Erste SPS-Aufgabe', 'Die erste Aufgabe im SPS-Lab geschafft.', function (c) { return [c.n(c.ids('sps')), 1]; }],
    ['spszehn', '🧰', 'SPS-Praktiker', 'Zehn Aufgaben im SPS-Lab geschafft.', function (c) { return [c.n(c.ids('sps')), 10]; }],
    ['spsalle', '🏆', 'SPS-Meister', 'Alle Aufgaben im SPS-Lab geschafft.', function (c) { return [c.n(c.ids('sps')), c.ids('sps').length || 24]; }],
    ['spsgra', '🪜', 'Schrittketten-Profi', 'Alle drei GRAFCET-Aufgaben im SPS-Lab geschafft.', function (c) { return [c.n(['sp17', 'sp18', 'sp19']), 3]; }],
    ['spsfehler', '🔧', 'Anlagen-Doktor', 'Alle drei Fehlersuchen an den Anlagen gelöst.', function (c) { return [c.n(['sp20', 'sp21', 'sp22']), 3]; }],
    ['spssprachen', '🗣️', 'Dreisprachig', 'Ein Programm in KOP, in FUP und in GRAFCET gestartet.', function (c) { return [(c.st.spslang_kop ? 1 : 0) + (c.st.spslang_fup ? 1 : 0) + (c.st.spslang_gra ? 1 : 0), 3]; }],
    ['spslauf', '▶️', 'Anlage läuft', 'Zum ersten Mal ein Programm an einer Anlage gestartet.', function (c) { return [c.st.spsrun || 0, 1]; }],
    ['spsforce', '🔒', 'Zwangssetzer', 'Einen Ein- oder Ausgang mit dem Zwangssetzen festgehalten.', function (c) { return [c.st.spsforce || 0, 1]; }],
    ['spsprogs', '💾', 'Programmsammler', 'Drei eigene SPS-Programme gespeichert.', function (c) { return [c.st.spsprogs || 0, 3]; }],
    ['pcberste', '🔌', 'Erste Platinen-Aufgabe', 'Die erste Aufgabe im Leiterplatten-Lab geschafft.', function (c) { return [c.n(c.ids('pcb')), 1]; }],
    ['pcbzehn', '🧰', 'Platinen-Praktiker', 'Zehn Aufgaben im Leiterplatten-Lab geschafft.', function (c) { return [c.n(c.ids('pcb')), 10]; }],
    ['pcballe', '🏆', 'Platinen-Meister', 'Alle Aufgaben im Leiterplatten-Lab geschafft.', function (c) { return [c.n(c.ids('pcb')), c.ids('pcb').length || 43]; }],
    ['pcbbahnen', '〰️', 'Bahnenzieher', 'Fünfzig Leiterbahnen gezeichnet.', function (c) { return [c.st.pcbtracks || 0, 50]; }],
    ['pcbvia', '🕳️', 'Via-Künstler', 'Zehn Vias gesetzt.', function (c) { return [c.st.pcbvias || 0, 10]; }],
    ['pcblagen4', '🥪', 'Vierlagen-Profi', 'Eine vierlagige Platine ohne DRC-Fehler und mit allen Verbindungen gebaut.', function (c) { return [c.st.pcblayers4 || 0, 1]; }],
    ['pcbgerber', '📦', 'Gerber-Pionier', 'Gerber-Dateien angesehen oder als Paket gepackt.', function (c) { return [c.st.pcbgerber || 0, 1]; }],
    ['pcbfix', '🩹', 'DRC-Aufräumer', 'Zehn DRC-Fehler beseitigt.', function (c) { return [c.st.pcbfix || 0, 10]; }],
    ['pcbloet', '🔥', 'Lötprofi', 'Fünf Lötstellen von Hand oder im Ofen gut gelungen.', function (c) { return [c.st.pcbsolder || 0, 5]; }],
    ['pcbdoktor', '🔍', 'Platinen-Doktor', 'Alle sechs Fehlersuchen an defekten Platinen gelöst.', function (c) { return [c.n(['pb33', 'pb34', 'pb35', 'pb36', 'pb37', 'pb38']), 6]; }],
    ['pcbpruef', '🔬', 'Prüfverfahren-Kenner', 'Alle drei Aufgaben zu Prüfverfahren (Flying Probe und Co.) gelöst.', function (c) { return [c.n(['pb39', 'pb40', 'pb41']), 3]; }],
    ['pcbsammler', '💾', 'Platinensammler', 'Drei eigene Platinen gespeichert.', function (c) { return [c.st.pcbsaved || 0, 3]; }],
    ['anterste', '⚙️', 'Erste Antriebs-Aufgabe', 'Die erste Aufgabe im Antriebs-Lab geschafft.', function (c) { return [c.n(c.ids('ant')), 1]; }],
    ['antzehn', '🧰', 'Antriebs-Praktiker', 'Zehn Aufgaben im Antriebs-Lab geschafft.', function (c) { return [c.n(c.ids('ant')), 10]; }],
    ['antalle', '🏆', 'Antriebs-Meister', 'Alle Aufgaben im Antriebs-Lab geschafft.', function (c) { return [c.n(c.ids('ant')), c.ids('ant').length || 30]; }],
    ['antrun', '▶️', 'Motor läuft', 'Einen Prüfstand im Antriebs-Lab gestartet.', function (c) { return [c.st.antrun || 0, 1]; }],
    ['antrigs', '🎛️', 'Alle fünf Prüfstände', 'Gleichstrom, Servo, Schrittmotor, Drehstrom und Getriebe ausprobiert.', function (c) { return [c.st.antrigs || 0, 5]; }],
    ['antcurve', '📈', 'Kennlinien-Leser', 'Die Kennlinien eines Prüfstands angesehen.', function (c) { return [c.st.antcurve || 0, 1]; }],
    ['antseq', '⏱️', 'Ablauf-Programmierer', 'Ein Ablaufprogramm gestartet, zum Beispiel einen Stern-Dreieck-Anlauf.', function (c) { return [c.st.antseq || 0, 1]; }],
    ['antfault', '💥', 'Fehlerjäger', 'Fünf verschiedene Antriebsfehler erlebt: Kurzschluss, Überhitzung, Schrittverlust und mehr.', function (c) { return [c.st.antfault || 0, 5]; }],
    ['antcalc', '🧮', 'Typenschild-Rechner', 'Eine Übungsaufgabe im Rechner des Antriebs-Labs beantwortet.', function (c) { return [c.st.antcalc || 0, 1]; }],
    ['antdoktor', '🔍', 'Antriebs-Doktor', 'Alle vier Fehlersuchen an Motor und Getriebe gelöst.', function (c) { return [c.n(['an24', 'an25', 'an26', 'an27']), 4]; }],
    ['antpruef', '📋', 'Typenschild-Profi', 'Alle drei Aufgaben im Prüfungsstil gelöst.', function (c) { return [c.n(['an28', 'an29', 'an30']), 3]; }],
    ['senerste', '🌡️', 'Erste Sensorik-Aufgabe', 'Die erste Aufgabe im Sensorik-Lab geschafft.', function (c) { return [c.n(c.ids('sen')), 1]; }],
    ['senzehn', '📏', 'Messtechniker', 'Zehn Aufgaben im Sensorik-Lab geschafft.', function (c) { return [c.n(c.ids('sen')), 10]; }],
    ['senalle', '🏆', 'Sensorik-Meister', 'Alle Aufgaben im Sensorik-Lab geschafft.', function (c) { return [c.n(c.ids('sen')), c.ids('sen').length || 28]; }],
    ['senrun', '▶️', 'Messkette läuft', 'Einen Prüfstand im Sensorik-Lab gestartet.', function (c) { return [c.st.senrun || 0, 1]; }],
    ['senrigs', '🎛️', 'Alle sieben Prüfstände', 'Temperatur, Licht, Kraft, Beschleunigung, Normsignal, digitale Sensoren und ADU ausprobiert.', function (c) { return [c.st.senrigs || 0, 7]; }],
    ['sencurve', '📈', 'Kennlinien-Leser', 'Die Kennlinien eines Sensor-Prüfstands angesehen.', function (c) { return [c.st.sencurve || 0, 1]; }],
    ['senseq', '⏱️', 'Messfolgen-Programmierer', 'Ein Ablaufprogramm im Sensorik-Lab gestartet, zum Beispiel einen Temperatursprung.', function (c) { return [c.st.senseq || 0, 1]; }],
    ['senfault', '💥', 'Messfehler-Jäger', 'Fünf verschiedene Messfehler erlebt: Selbsterwärmung, Drahtbruch, Aliasing und mehr.', function (c) { return [c.st.senfault || 0, 5]; }],
    ['sencalc', '🧮', 'Messketten-Rechner', 'Eine Übungsaufgabe im Rechner des Sensorik-Labs beantwortet.', function (c) { return [c.st.sencalc || 0, 1]; }],
    ['sencalcok', '✅', 'Rechnen mit Gefühl', 'Fünf Übungsaufgaben im Sensorik-Rechner richtig gelöst.', function (c) { return [c.st.sencalcok || 0, 5]; }],
    ['sencal', '🎯', 'Kalibrierer', 'Einen Kraftaufnehmer mit Nullpunkt und Endwert kalibriert.', function (c) { return [c.st.sencal || 0, 1]; }],
    ['sendoktor', '🔍', 'Sensor-Doktor', 'Alle drei Fehlersuchen an der Messkette gelöst.', function (c) { return [c.n(['se24', 'se25', 'se26']), 3]; }],
    ['senpruef', '📋', 'Messketten-Profi', 'Beide Aufgaben im Prüfungsstil gelöst.', function (c) { return [c.n(['se27', 'se28']), 2]; }],
    ['dserste', '📄', 'Erste Datenblatt-Aufgabe', 'Die erste Aufgabe im Datenblatt-Lab geschafft.', function (c) { return [c.n(c.ids('ds')), 1]; }],
    ['dszehn', '🔎', 'Datenblatt-Leser', 'Zehn Aufgaben im Datenblatt-Lab geschafft.', function (c) { return [c.n(c.ids('ds')), 10]; }],
    ['dsalle', '🏆', 'Datenblatt-Meister', 'Alle Aufgaben im Datenblatt-Lab geschafft.', function (c) { return [c.n(c.ids('ds')), c.ids('ds').length || 34]; }],
    ['dsread', '📖', 'Vielleser', 'Zehnmal ein Übungsdatenblatt geöffnet.', function (c) { return [c.st.dsread || 0, 10]; }],
    ['dslibs', '📚', 'Bibliothekar', 'Alle 16 Übungsdatenblätter angesehen.', function (c) { return [c.st.dslibs || 0, 16]; }],
    ['dscurve', '📈', 'Kurvenleser', 'Fünf Kennlinien in Datenblättern abgelesen.', function (c) { return [c.st.dscurve || 0, 5]; }],
    ['dsengl', '🇬🇧', 'Fachenglisch-Fuchs', 'Zwanzig Fachenglisch-Begriffe sicher gelernt.', function (c) { return [c.st.dsengl || 0, 20]; }],
    ['dspick', '🧩', 'Bauteil-Auswähler', 'Drei Bauteilwahl-Aufgaben richtig gelöst.', function (c) { return [c.st.dspick || 0, 3]; }],
    ['dscalc', '🧮', 'Datenblatt-Rechner', 'Fünf verschiedene Rechner im Datenblatt-Lab benutzt.', function (c) { return [c.st.dscalc || 0, 5]; }],
    ['dsvokabel', '🔤', 'Vokabelprofi', 'Alle fünf Fachenglisch-Aufgaben gelöst.', function (c) { return [c.n(['ds26', 'ds27', 'ds28', 'ds29', 'ds30']), 5]; }],
    ['dsdoktor', '🔍', 'Grenzwert-Detektiv', 'Beide Fehlersuchen im Datenblatt gelöst.', function (c) { return [c.n(['ds31', 'ds32']), 2]; }],
    ['dspruef', '📋', 'Prüfungsleser', 'Beide Aufgaben im Prüfungsstil gelöst.', function (c) { return [c.n(['ds33', 'ds34']), 2]; }],
    ['regerste', '🎚️', 'Erste Regelungs-Aufgabe', 'Die erste Aufgabe im Regelungstechnik-Lab geschafft.', function (c) { return [c.n(c.ids('reg')), 1]; }],
    ['regzehn', '📈', 'Regelungstechniker', 'Zehn Aufgaben im Regelungstechnik-Lab geschafft.', function (c) { return [c.n(c.ids('reg')), 10]; }],
    ['regalle', '🏆', 'Regelungs-Meister', 'Alle Aufgaben im Regelungstechnik-Lab geschafft.', function (c) { return [c.n(c.ids('reg')), c.ids('reg').length || 30]; }],
    ['regrun', '▶️', 'Regelkreis läuft', 'Einen Prüfstand im Regelungstechnik-Lab gestartet.', function (c) { return [c.st.regrun || 0, 1]; }],
    ['regrigs', '🎛️', 'Alle sieben Prüfstände', 'Füllstand, Durchfluss, Raumtemperatur, Thermostat, Drehzahl, Lage und Baukasten ausprobiert.', function (c) { return [c.st.regrigs || 0, 7]; }],
    ['regsprung', '📐', 'Sprungantwort-Messer', 'Eine Sprungantwort einer Regelstrecke aufgezeichnet.', function (c) { return [c.st.regstep || 0, 1]; }],
    ['regschwing', '🌀', 'Kritische Verstärkung', 'Beim Schwingversuch Kkrit und Tkrit gefunden.', function (c) { return [c.st.regzn || 0, 1]; }],
    ['regosc', '〰️', 'Der Kreis schwingt', 'Eine Dauerschwingung im Regelkreis erlebt.', function (c) { return [c.st.regosc || 0, 1]; }],
    ['regwind', '💨', 'Windup erlebt', 'Die Meldung gesehen, dass der I-Anteil am Anschlag weggelaufen ist.', function (c) { return [c.st.regwind || 0, 1]; }],
    ['regzweip', '♨️', 'Zweipunkt-Beobachter', 'Einen Zweipunktregler eine Minute Prozesszeit lang schalten lassen.', function (c) { return [c.st.reg2p || 0, 1]; }],
    ['regtune', '🔧', 'Regler-Einsteller', 'Einen Vorschlag der Einstellhilfe in den Prüfstand übernommen.', function (c) { return [c.st.regtune || 0, 1]; }],
    ['regbode', '📊', 'Bode-Leser', 'Das Diagramm zur Stabilität (Amplitude und Phase) angesehen.', function (c) { return [c.st.regbode || 0, 1]; }],
    ['regcalc', '🧮', 'Regelungs-Rechner', 'Den Rechner im Regelungstechnik-Lab benutzt.', function (c) { return [c.st.regcalc || 0, 1]; }],
    ['regfault', '💥', 'Störungsjäger', 'Fünf verschiedene Meldungen oder Störungen an den Prüfständen erlebt.', function (c) { return [c.st.regfault || 0, 5]; }],
    ['regdoktor', '🔍', 'Regelungs-Doktor', 'Alle drei Fehlersuchen an Regelkreisen gelöst.', function (c) { return [c.n(['rg4', 'rg21', 'rg26']), 3]; }],
    ['regpruef', '📋', 'Prüfungs-Regler', 'Beide Aufgaben im Prüfungsstil gelöst.', function (c) { return [c.n(['rg29', 'rg30']), 2]; }],
    ['thmerste', '🌡️', 'Erste Thermik-Aufgabe', 'Die erste Aufgabe im Thermik-Lab geschafft.', function (c) { return [c.n(c.ids('thm')), 1]; }],
    ['thmzehn', '🔥', 'Wärme-Techniker', 'Zehn Aufgaben im Thermik-Lab geschafft.', function (c) { return [c.n(c.ids('thm')), 10]; }],
    ['thmalle', '🏆', 'Thermik-Meister', 'Alle Aufgaben im Thermik-Lab geschafft.', function (c) { return [c.n(c.ids('thm')), c.ids('thm').length || 30]; }],
    ['thmrun', '🕯️', 'Es wird warm', 'Einen Prüfstand im Thermik-Lab gestartet.', function (c) { return [c.st.thmrun || 0, 1]; }],
    ['thmrigs', '🧰', 'Alle fünf Prüfstände', 'Linearregler, Transistor, MOSFET, Bauteile und Vergleich ausprobiert.', function (c) { return [c.st.thmrigs || 0, 5]; }],
    ['thmpaste', '🧴', 'Paste macht den Unterschied', 'Eine Glimmerscheibe mit und ohne Wärmeleitpaste verglichen.', function (c) { return [c.st.thmpaste || 0, 1]; }],
    ['thmshut', '🚨', 'Thermische Abschaltung', 'Die Abschaltung eines Reglers erlebt und gewartet, bis er wieder anläuft.', function (c) { return [c.st.thmshut || 0, 1]; }],
    ['thmkuehl', '❄️', 'Kühlkörper bestätigt', 'Einen Kühlkörper berechnet und im Prüfstand bestätigt, dass die Sperrschicht unter der Grenze bleibt.', function (c) { return [c.st.thmkuehl || 0, 1]; }],
    ['thmzeit', '⏳', 'Zeitkonstante bestimmt', 'Die Zeitkonstante eines Kühlkörpers aus der Aufheizkurve oder im Rechner bestimmt.', function (c) { return [c.st.thmzeit || 0, 1]; }],
    ['thmcalc', '🧮', 'Thermik-Rechner', 'Den Rechner im Thermik-Lab benutzt.', function (c) { return [c.st.thmcalc || 0, 1]; }],
    ['thmvergl', '⚖️', 'Drei Aufbauten verglichen', 'Drei Aufbauten im Vergleich nebeneinander laufen lassen.', function (c) { return [c.st.thmvergl || 0, 1]; }],
    ['thmseq', '⏱️', 'Ablauf gespielt', 'Einen Ablauf im Thermik-Lab abgespielt.', function (c) { return [c.st.thmseq || 0, 1]; }],
    ['thmfault', '⚠️', 'Hitzeexperte', 'Fünf verschiedene Meldungen oder Störungen an den Thermik-Prüfständen erlebt.', function (c) { return [c.st.thmfault || 0, 5]; }],
    ['thmdoktor', '🔍', 'Thermik-Doktor', 'Alle drei Fehlersuchen zur Wärme gelöst.', function (c) { return [c.n(['th8', 'th25', 'th26']), 3]; }],
    ['thmpruef', '📋', 'Prüfungs-Kühler', 'Alle drei Aufgaben im Prüfungsstil gelöst.', function (c) { return [c.n(['th27', 'th28', 'th30']), 3]; }],
    ['emverste', '📡', 'Erste EMV-Aufgabe', 'Die erste Aufgabe im EMV-Lab geschafft.', function (c) { return [c.n(c.ids('emv')), 1]; }],
    ['emvzehn', '🔧', 'Entstörer', 'Zehn Aufgaben im EMV-Lab geschafft.', function (c) { return [c.n(c.ids('emv')), 10]; }],
    ['emvalle', '🏆', 'EMV-Meister', 'Alle Aufgaben im EMV-Lab geschafft.', function (c) { return [c.n(c.ids('emv')), c.ids('emv').length || 32]; }],
    ['emvrun', '▶️', 'Störung läuft', 'Einen Prüfstand im EMV-Lab gestartet.', function (c) { return [c.st.emvrun || 0, 1]; }],
    ['emvrigs', '🧰', 'Alle neun Prüfstände', 'Kopplung, Störquelle, Filter, Schirmung, Abstrahlung, Layout, Impulse, Tastkopf und Vorprüfung ausprobiert.', function (c) { return [c.st.emvrigs || 0, 9]; }],
    ['emvshots', '💥', 'Drei Impulsarten', 'ESD, Burst und Surge je einmal ausgelöst.', function (c) { return [c.st.emvshots || 0, 3]; }],
    ['emvspec', '📊', 'Spektrum-Leser', 'Im Spektrum fünfmal etwas bedient oder abgelesen.', function (c) { return [c.st.emvspec || 0, 5]; }],
    ['emvcases', '🧩', 'Layout-Detektiv', 'Sechs Layout-Fälle durch eine Maßnahme grün bekommen.', function (c) { return [c.st.emvcases || 0, 6]; }],
    ['emvcalc', '🧮', 'EMV-Rechner', 'Fünf Rechnungen oder Übungsprüfungen im Rechner gemacht.', function (c) { return [c.st.emvcalc || 0, 5]; }],
    ['emvref', '⚖️', 'Vorher und Nachher', 'Einen Aufbau gemerkt und mit dem geänderten verglichen.', function (c) { return [c.st.emvref || 0, 1]; }],
    ['emvseq', '⏱️', 'Ablauf gespielt', 'Einen Ablauf im EMV-Lab abgespielt.', function (c) { return [c.st.emvseq || 0, 1]; }],
    ['emvfault', '⚠️', 'Störungsexperte', 'Fünf verschiedene Meldungen oder Störungen an den EMV-Prüfständen erlebt.', function (c) { return [c.st.emvfault || 0, 5]; }],
    ['emvgruen', '🟢', 'Vorprüfung bestanden', 'Die Vorprüfung mit grüner Ampel abgeschlossen.', function (c) { return [c.st.emvgruen || 0, 1]; }],
    ['emvmeister', '🎖️', 'EMV-Meisterstücke', 'Die drei schwersten Aufgaben gelöst: Hot-Loop-Fläche, Reklamation und Steckernetzteil.', function (c) { return [c.n(['em24', 'em31', 'em32']), 3]; }],
    ['enrerste', '☀️', 'Erste Energie-Aufgabe', 'Die erste Aufgabe im Energie-Lab geschafft.', function (c) { return [c.n(c.ids('enr')), 1]; }],
    ['enrzehn', '🔆', 'Sonnenernter', 'Zehn Aufgaben im Energie-Lab geschafft.', function (c) { return [c.n(c.ids('enr')), 10]; }],
    ['enralle', '🏆', 'Energie-Meister', 'Alle Aufgaben im Energie-Lab geschafft.', function (c) { return [c.n(c.ids('enr')), c.ids('enr').length || 30]; }],
    ['enrrun', '▶️', 'Sonne scheint', 'Einen Prüfstand im Energie-Lab gestartet.', function (c) { return [c.st.enrrun || 0, 1]; }],
    ['enrrigs', '🧰', 'Alle fünf Prüfstände', 'Modul, Verschattung, Laderegler, Inselanlage und Netzeinspeisung ausprobiert.', function (c) { return [c.st.enrrigs || 0, 5]; }],
    ['enrkurve', '📈', 'Kennlinie aufgenommen', 'Mindestens sechs Messpunkte einer Modulkennlinie aufgenommen und mit dem Modell verglichen.', function (c) { return [c.st.enrkurve || 0, 1]; }],
    ['enrmpp', '🎯', 'Leistungsanpassung gefunden', 'Das Solarmodul im Prüfstand im MPP betrieben (Anpassung mindestens 99 Prozent).', function (c) { return [c.st.enrmpp || 0, 1]; }],
    ['enrschatten', '🌳', 'Bypassdiode im Einsatz', 'Erlebt, wie eine Bypassdiode bei Verschattung einen Zellstrang überbrückt.', function (c) { return [c.st.enrbypass || 0, 1]; }],
    ['enrglobal', '🔍', 'Globales Maximum', 'Bei Teilverschattung das globale Maximum der Leistung gefunden.', function (c) { return [c.st.enrglobal || 0, 1]; }],
    ['enrtag', '🌅', 'Ein ganzer Tag', 'Einen ganzen Sonnentag in der Simulation durchlaufen lassen.', function (c) { return [c.st.enrtag || 0, 1]; }],
    ['enrlvd', '🔋', 'Tiefentladeschutz erlebt', 'Erlebt, wie der Tiefentladeschutz den Akku abschaltet.', function (c) { return [c.st.enrlvd || 0, 1]; }],
    ['enrdesign', '📐', 'Anlage ausgelegt', 'Den Auslegungs-Assistenten im Energie-Lab benutzt.', function (c) { return [c.st.enrdesign || 0, 1]; }],
    ['enrcalc', '🧮', 'Energie-Rechner', 'Drei Rechenübungen im Rechner des Energie-Labs richtig gelöst.', function (c) { return [c.st.enrcalc || 0, 3]; }],
    ['enrfault', '⚠️', 'Anlagen-Experte', 'Fünf verschiedene Meldungen oder Störungen an den Energie-Prüfständen erlebt.', function (c) { return [c.st.enrfault || 0, 5]; }],
    ['enrdoktor', '🔧', 'Solar-Doktor', 'Alle vier Fehlersuchen im Energie-Lab gelöst: Bypassdiode, Akku gast, Kabel warm und keine Einspeisung.', function (c) { return [c.n(['en13', 'en18', 'en20', 'en28']), 4]; }],
    ['enrpruef', '📋', 'Prüfungs-Solarteur', 'Beide Aufgaben im Prüfungsstil gelöst: Autarkie und Teil-B-Aufgabe.', function (c) { return [c.n(['en29', 'en30']), 2]; }],
    ['elserste', '🦺', 'Erste Sicherheits-Aufgabe', 'Die erste Aufgabe im Sicherheits-Lab geschafft.', function (c) { return [c.n(c.ids('els')), 1]; }],
    ['elszehn', '🛡️', 'Schutzprofi', 'Zehn Aufgaben im Sicherheits-Lab geschafft.', function (c) { return [c.n(c.ids('els')), 10]; }],
    ['elsalle', '🏆', 'Sicherheits-Meister', 'Alle Aufgaben im Sicherheits-Lab geschafft.', function (c) { return [c.n(c.ids('els')), c.ids('els').length || 32]; }],
    ['elsrun', '▶️', 'Prüfstand unter Strom', 'Einen Prüfstand im Sicherheits-Lab gestartet (nur in der Simulation).', function (c) { return [c.st.elsrun || 0, 1]; }],
    ['elsrigs', '🧰', 'Alle acht Prüfstände', 'Körper, Netz, Sicherung, RCD, Schutzklassen, Isolation, Prüfplatz und Sicherheitsregeln je einmal gestartet.', function (c) { return [c.st.elsrigs || 0, 8]; }],
    ['elsebenen', '🧱', 'Drei Schutzebenen', 'Die Aufgabe el8 (Welche Netzform ist das?) gelöst und im Tab Lernen den Abschnitt 1 (Gefährdung und Schutzebenen) aufgerufen.', function (c) { return [c.n(['el8']) + (c.st.elslern1 ? 1 : 0), 2]; }],
    ['elszone', '❤️', 'Zonen im Griff', 'Die Aufgaben el1 (Welche Zone ist das?) und el3 (Strom unter die Zone Z2 bringen) gelöst.', function (c) { return [c.n(['el1', 'el3']), 2]; }],
    ['elsnetz', '🔌', 'Netzform-Kenner', 'Die Aufgaben el4 (Zs-Grenze für B16), el6 (Schleifenimpedanz) und el9 (TT: größter Erdungswiderstand) gelöst.', function (c) { return [c.n(['el4', 'el6', 'el9']), 3]; }],
    ['elsrcd', '🔘', 'RCD-Experte', 'Die Aufgaben el14 (RCD einsetzen und prüfen), el15 (Was prüft die Prüftaste?) und el16 (Fehlauslösung beheben) gelöst.', function (c) { return [c.n(['el14', 'el15', 'el16']), 3]; }],
    ['elsisolation', '📏', 'Isolationsprüfer', 'Die Aufgaben el21 (Isolationswiderstand bewerten) und el23 (Schutzleiterwiderstand richtig messen) gelöst.', function (c) { return [c.n(['el21', 'el23']), 2]; }],
    ['elsprotokoll', '📋', 'Protokollführer', 'Die Aufgaben el24, el25 und el26 (Geräte prüfen und protokollieren) gelöst.', function (c) { return [c.n(['el24', 'el25', 'el26']), 3]; }],
    ['elsregeln', '🚦', 'Fünf Regeln, Rettungskette', 'Die Aufgaben el28 (Fünf Sicherheitsregeln) und el29 (Rettungskette) gelöst.', function (c) { return [c.n(['el28', 'el29']), 2]; }],
    ['elsmeister', '🎖️', 'Prüfdienst-Meisterstück', 'Die schwerste Aufgabe el32 gelöst: ein Prüfling mit zwei Mängeln und ein Netz-Ausschnitt mit Fehler.', function (c) { return [c.n(['el32']), 1]; }],
    ['elscalc', '🧮', 'Sicherheits-Rechner', 'Zwanzigmal im Rechner des Sicherheits-Labs ein gültiges Ergebnis übernommen oder eine Übung geprüft.', function (c) { return [c.st.elscalc || 0, 20]; }],
    ['elsfehler', '🎲', 'Fehler-Würfler', 'Den Fehler-Würfel im Sicherheits-Lab fünfmal geworfen.', function (c) { return [c.st.elsfehler || 0, 5]; }],
    ['elspruefung', '📝', 'Prüfungsnah', 'Alle Aufgaben der Kategorie Prüfungsnah im Sicherheits-Lab gelöst.', function (c) { var l = c.R.filter(function (r) { return r[1] === 'els' && r[2] === 'Prüfungsnah'; }).map(function (r) { return r[0]; }); return [c.n(l), l.length || 9]; }],
    ['elsgruen', '🟢', 'Ampel auf Grün', 'An einem Prüfstand im Sicherheits-Lab stand die Ampel auf Grün (auch eine grüne Ausgangslage zählt). Grün heißt nur: innerhalb der Übungswerte, nicht gefahrlos.', function (c) { return [c.st.elsgruen || 0, 1]; }],
    ['elsref', '⚖️', 'Vorher und Nachher', 'Im Sicherheits-Lab einen Aufbau mit Merken festgehalten oder zwischen Vorher, Nachher und Wischer gewechselt.', function (c) { return [c.st.elsref || 0, 1]; }],
    ['elsdesign', '📐', 'Stromkreis ausgelegt', 'Im Tab Auslegen den vierten Schritt (Prüfen) mit Haken abgeschlossen.', function (c) { return [c.st.elsdesign || 0, 1]; }],
    ['elsablage', '🗂️', 'Stimmiges Protokoll', 'Drei Prüfprotokolle im Verlauf des Tabs Prüfprotokoll abgelegt, bei denen die Kontrolle keine Abweichung fand.', function (c) { return [c.st.elsproto || 0, 3]; }],
    ['ntserste', '🔋', 'Erste Netzteil-Aufgabe', 'Die erste Aufgabe im Netzteil-Lab geschafft.', function (c) { return [c.n(c.ids('nts')), 1]; }],
    ['ntszehn', '⚡', 'Netzteil-Profi', 'Zehn Aufgaben im Netzteil-Lab geschafft.', function (c) { return [c.n(c.ids('nts')), 10]; }],
    ['ntsalle', '🏆', 'Netzteil-Meister', 'Alle Aufgaben im Netzteil-Lab geschafft.', function (c) { return [c.n(c.ids('nts')), c.ids('nts').length || 32]; }],
    ['ntsrun', '▶️', 'Netzteil unter Last', 'Einen Prüfstand im Netzteil-Lab gestartet (nur in der Simulation).', function (c) { return [c.st.ntsrun || 0, 1]; }],
    ['ntsrigs', '🧰', 'Alle acht Prüfstände', 'Transformator, Gleichrichter und Siebung, Z-Diode und Linearregler, Tiefsetzsteller, Topologien, Gate und Schaltverluste, Regelkreis und Labornetzteil sowie Fehlersuche je einmal gestartet.', function (c) { return [c.st.ntsrigs || 0, 8]; }],
    ['ntsblock', '🧱', 'Blockschaltbild gelesen', 'Die Aufgabe nt1 (Reihenfolge der Funktionsblöcke) gelöst und im Tab Lernen den Abschnitt 1 (Blockschaltbild und Leistungsbilanz) aufgerufen.', function (c) { return [c.n(['nt1']) + (c.st.ntslern1 ? 1 : 0), 2]; }],
    ['ntsbrumm', '〰️', 'Brummspannung im Griff', 'Die Aufgaben nt6 (Brummspannung berechnen) und nt7 (Brummspannung unter 1 V bringen) gelöst.', function (c) { return [c.n(['nt6', 'nt7']), 2]; }],
    ['ntsz', '🔻', 'Z-Dioden-Kenner', 'Die Aufgaben nt9 (Z-Diode: Strom berechnen) und nt10 (Z-Diode: Vorwiderstand) gelöst.', function (c) { return [c.n(['nt9', 'nt10']), 2]; }],
    ['ntsregler', '🎚️', 'Linearregler-Experte', 'Die Aufgaben nt12 (Verlustleistung des Linearreglers), nt14 (LM317 auf 9 V einstellen) und nt15 (Ausgangsspannung des LM317) gelöst.', function (c) { return [c.n(['nt12', 'nt14', 'nt15']), 3]; }],
    ['ntsschalt', '🔀', 'Tiefsetzsteller-Kenner', 'Die Aufgaben nt20 (Tastverhältnis), nt21 (Drosselstrom-Welligkeit) und nt22 (Lückenden Betrieb vermeiden) gelöst.', function (c) { return [c.n(['nt20', 'nt21', 'nt22']), 3]; }],
    ['ntsverlust', '🔥', 'Verlustbilanz', 'Die Aufgaben nt18 (Linear oder getaktet?) und nt24 (Wirkungsgrad des Schaltreglers) gelöst.', function (c) { return [c.n(['nt18', 'nt24']), 2]; }],
    ['ntstopo', '🧭', 'Topologie-Wähler', 'Die Aufgaben nt19 (Welche Topologie?), nt25 (Hochsetzsteller auslegen) und nt26 (Inverswandler: negative Spannung) gelöst.', function (c) { return [c.n(['nt19', 'nt25', 'nt26']), 3]; }],
    ['ntsgate', '🚪', 'Gate-Ansteuerung', 'Die Aufgabe nt27 (Gate-Widerstand wählen) gelöst.', function (c) { return [c.n(['nt27']), 1]; }],
    ['ntslabor', '🎛️', 'Labornetzteil-Profi', 'Die Aufgaben nt29 (CV oder CC?) und nt30 (Labornetzteil einstellen) gelöst.', function (c) { return [c.n(['nt29', 'nt30']), 2]; }],
    ['ntsfehler', '🔧', 'Netzteil-Doktor', 'Die beiden Fehlersuchen nt31 (Netzteil repariert?) und nt32 (Das Netzteil des Kollegen) gelöst.', function (c) { return [c.n(['nt31', 'nt32']), 2]; }],
    ['ntscalc', '🧮', 'Netzteil-Rechner', 'Zwanzigmal im Rechner des Netzteil-Labs ein gültiges Ergebnis übernommen oder eine Übung geprüft.', function (c) { return [c.st.ntscalc || 0, 20]; }],
    ['ntsdesign', '📐', 'Netzteil ausgelegt', 'Im Tab Auslegen den vierten Schritt (Ergebnis) mit Haken abgeschlossen.', function (c) { return [c.st.ntsdesign || 0, 1]; }],
    ['ntsref', '⚖️', 'Vorher und Nachher', 'Im Netzteil-Lab einen Aufbau mit Vorher merken festgehalten.', function (c) { return [c.st.ntsref || 0, 1]; }],
    ['ntsstoer', '⚠️', 'Störungen erlebt', 'Fünf verschiedene rote Meldungen an den Netzteil-Prüfständen erlebt (nur in der Simulation).', function (c) { return [c.st.ntsfault || 0, 5]; }],
    ['ntspruefung', '📝', 'Prüfungsnah', 'Alle Aufgaben der Kategorie Prüfungsnah im Netzteil-Lab gelöst.', function (c) { var l = c.R.filter(function (r) { return r[1] === 'nts' && r[2] === 'Prüfungsnah'; }).map(function (r) { return r[0]; }); return [c.n(l), l.length || 15]; }],
    ['wslerste', '〰️', 'Erste Wechselstrom-Aufgabe', 'Die erste Aufgabe im Wechselstrom-Lab geschafft.', function (c) { return [c.n(c.ids('wsl')), 1]; }],
    ['wslzehn', '⚡', 'Wechselstrom-Profi', 'Zehn Aufgaben im Wechselstrom-Lab geschafft.', function (c) { return [c.n(c.ids('wsl')), 10]; }],
    ['wslalle', '🏆', 'Wechselstrom-Meister', 'Alle Aufgaben im Wechselstrom-Lab geschafft.', function (c) { return [c.n(c.ids('wsl')), c.ids('wsl').length || 32]; }],
    ['wslrun', '▶️', 'Wechselstrom unter Last', 'Einen Prüfstand im Wechselstrom-Lab gestartet (nur in der Simulation).', function (c) { return [c.st.wslrun || 0, 1]; }],
    ['wslrigs', '🧰', 'Alle acht Prüfstände', 'Sinus, R-L-C-Schaltung, Leistung, Kompensation, Schwingkreis, Filter, Transformator und Drehstrom je einmal gestartet.', function (c) { return [c.st.wslrigs || 0, 8]; }],
    ['wslzeiger', '🧭', 'Zeiger gelesen', 'Die Aufgaben ws3 (Phase einstellen) und ws9 (Eilt vor oder nach?) gelöst.', function (c) { return [c.n(['ws3', 'ws9']), 2]; }],
    ['wslimpedanz', '📏', 'Impedanz-Kenner', 'Die Aufgaben ws5 (X_L und X_C berechnen), ws6 (Spule an 230 V) und ws8 (Gesamtspannung) gelöst.', function (c) { return [c.n(['ws5', 'ws6', 'ws8']), 3]; }],
    ['wslleistung', '🔌', 'Blindleistung im Griff', 'Die Aufgaben ws10 (Blindleistung aus drei Messwerten), ws11 (Blindleistung aus P und cos φ) und ws13 (Strom aus Leistung und cos φ) gelöst.', function (c) { return [c.n(['ws10', 'ws11', 'ws13']), 3]; }],
    ['wslkomp', '🔋', 'Kompensations-Profi', 'Die Aufgaben ws14 (Kompensiere auf 0,95), ws15 (Kondensator berechnen) und ws16 (Was ändert die Kompensation?) gelöst.', function (c) { return [c.n(['ws14', 'ws15', 'ws16']), 3]; }],
    ['wslreso', '🔔', 'Resonanz getroffen', 'Die Aufgaben ws17 (Resonanzfrequenz berechnen), ws18 (Kapazität für Resonanz) und ws19 (Reihenkreis auf f₀ abstimmen) gelöst.', function (c) { return [c.n(['ws17', 'ws18', 'ws19']), 3]; }],
    ['wslguete', '🎯', 'Güte und Bandbreite', 'Die Aufgabe ws20 (Bandbreite einstellen) gelöst.', function (c) { return [c.n(['ws20']), 1]; }],
    ['wslfilter', '🎚️', 'Filter-Kenner', 'Die Aufgaben ws22 (Grenzfrequenz berechnen), ws25 (Was gilt bei f_g?) und ws26 (Siebglied berechnen) gelöst.', function (c) { return [c.n(['ws22', 'ws25', 'ws26']), 3]; }],
    ['wslbode', '📉', 'Bode-Vertiefung', 'Die Aufgabe ws25 (Was gilt bei f_g?) gelöst und die Bode-Vertiefung beim Filter insgesamt fünfmal aufgeklappt.', function (c) { return [c.n(['ws25']) + ((c.st.wslbode || 0) >= 5 ? 1 : 0), 2]; }],
    ['wsltrafo', '🧲', 'Trafo-Kenner', 'Die Aufgaben ws27 (Übersetzungsverhältnis), ws28 (Primärstrom) und ws29 (Trafo an Gleichspannung) gelöst.', function (c) { return [c.n(['ws27', 'ws28', 'ws29']), 3]; }],
    ['wslmeister', '🎓', 'Labortisch-Meister', 'Das Meisterstück ws32 (Der Labortisch-Wechselstrom) gelöst.', function (c) { return [c.n(['ws32']), 1]; }],
    ['wslcalc', '🧮', 'Wechselstrom-Rechner', 'Zwanzigmal im Rechner des Wechselstrom-Labs ein gültiges Ergebnis übernommen oder eine Übung geprüft.', function (c) { return [c.st.wslcalc || 0, 20]; }],
    ['wslfehler', '🎲', 'Fehler-Würfler', 'Den Fehler-Würfel im Wechselstrom-Lab fünfmal geworfen.', function (c) { return [c.st.wslfehler || 0, 5]; }],
    ['wslpruefung', '📝', 'Prüfungsnah', 'Alle Aufgaben der Kategorie Prüfungsnah im Wechselstrom-Lab gelöst.', function (c) { var l = c.R.filter(function (r) { return r[1] === 'wsl' && r[2] === 'Prüfungsnah'; }).map(function (r) { return r[0]; }); return [c.n(l), l.length || 19]; }],
    ['wsldesign', '📐', 'Schaltung ausgelegt', 'Im Tab Auslegen den vierten Schritt (Ergebnis) mit Haken abgeschlossen.', function (c) { return [c.st.wsldesign || 0, 1]; }],
    ['wslref', '⚖️', 'Vorher und Nachher', 'Im Wechselstrom-Lab einen Aufbau mit Merken festgehalten oder zwischen Vorher, Nachher und Wischer gewechselt.', function (c) { return [c.st.wslref || 0, 1]; }],
    ['wslbericht', '🗂️', 'Stimmiger Bericht', 'Drei Berichte im Verlauf des Tabs Messreihe abgelegt, bei denen die Kontrolle keine Abweichung fand.', function (c) { return [c.st.wslreport || 0, 3]; }],
    ['wslstoer', '⚠️', 'Störungen erlebt', 'Fünf verschiedene rote Meldungen an den Wechselstrom-Prüfständen erlebt (nur in der Simulation).', function (c) { return [c.st.wslfault || 0, 5]; }],
    ['wslgruen', '🟢', 'Ampel auf Grün', 'An einem Prüfstand im Wechselstrom-Lab stand die Ampel auf Grün (auch eine grüne Ausgangslage zählt). Grün heißt nur: innerhalb der Übungswerte, nicht gefahrlos.', function (c) { return [c.st.wslgruen || 0, 1]; }],
    ['vbstart', '🧩', 'Projekt gestartet', 'Die erste Station eines Verbundprojekts übergeben.', function (c) { return [c.st.vbstart || 0, 1]; }],
    ['vbuebergabe', '📤', 'Übergabe-Routine', 'Zehn Ergebnisse im Verbund an die nächste Station übergeben.', function (c) { return [c.st.vbuebergabe || 0, 10]; }],
    ['vbfertig', '🏁', 'Projekt abgeschlossen', 'Den Gesamttest eines Verbundprojekts bestanden.', function (c) { return [c.st.vbfertig || 0, 1]; }],
    ['vbgold', '🥇', 'Goldmedaille', 'Ein Verbundprojekt mit Gold abgeschlossen (mindestens 95 Prozent der Punkte).', function (c) { return [c.st.vbgold || 0, 1]; }],
    ['vbprofi', '🎖️', 'Projektprofi', 'Ein Verbundprojekt auf Stufe Profi abgeschlossen.', function (c) { return [c.st.vbprofi || 0, 1]; }],
    ['vbgarage', '🚪', 'Torbauer', 'Das Projekt Garagentor mit Funköffner abgeschlossen.', function (c) { return [c.st.vbgarage || 0, 1]; }],
    ['vbampel', '🚦', 'Verkehrsplaner', 'Das Projekt Ampelanlage abgeschlossen.', function (c) { return [c.st.vbampel || 0, 1]; }],
    ['vbuhr', '⏰', 'Uhrmacher', 'Das Projekt Digitale Uhr mit Wecker abgeschlossen.', function (c) { return [c.st.vbuhr || 0, 1]; }],
    ['vbgiess', '💧', 'Gartenmeister', 'Das Projekt Gartenbewässerung abgeschlossen.', function (c) { return [c.st.vbgiess || 0, 1]; }],
    ['vbfoerder', '📦', 'Anlagenbauer', 'Das Projekt Förder- und Sortieranlage abgeschlossen.', function (c) { return [c.st.vbfoerder || 0, 1]; }],
  ];
  DEFS.forEach(function (d) { d.id = d[0]; d.icon = d[1]; d.name = d[2]; d.desc = d[3]; d.prog = d[4]; });
  DEFS.find(function (d) { return d.id === 'wuerfel5'; }).icon = '👑';

  var queue = [], showing = false;
  function popup(def) {
    queue.push(def); if (showing) return; showing = true;
    (function next() {
      var d = queue.shift(); if (!d) { showing = false; return; }
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;top:calc(70px + env(safe-area-inset-top));transform:translateX(-50%);z-index:210;background:linear-gradient(135deg,#ffb300,#ff7a00);color:#1b1200;font:600 15px system-ui,sans-serif;padding:12px 18px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.45);text-align:center;max-width:86vw;pointer-events:none';
      el.innerHTML = '<div style="font-size:30px;line-height:1.1">' + d.icon + '</div>Neues Abzeichen: <b>' + esc(d.name) + '</b><br><span style="font-weight:500;font-size:13px">' + esc(d.desc) + '</span>';
      document.body.appendChild(el); setTimeout(function () { el.remove(); next(); }, 3600);
    })();
  }
  function confetti(big) {
    if (window.LochFX && window.LochFX.confetti) return window.LochFX.confetti(big);
    try {
      var c = document.createElement('canvas'); c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:200;pointer-events:none';
      c.width = window.innerWidth; c.height = window.innerHeight; document.body.appendChild(c);
      var x = c.getContext('2d'), N = big ? 200 : 80, cols = ['#ff4d4d', '#ffb300', '#3ddc84', '#3b9eff', '#c77dff', '#ffffff'], p = [], t0 = performance.now();
      for (var i = 0; i < N; i++) p.push({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 7, h: 10 + Math.random() * 8, c: cols[i % cols.length] });
      var kill = function () { if (c.parentNode) c.remove(); };
      setTimeout(kill, 4200);
      (function frame(now) {
        var el = now - t0; if (el > 3200 || !c.parentNode) { kill(); return; }
        x.clearRect(0, 0, c.width, c.height);
        p.forEach(function (q) { q.x += q.vx; q.y += q.vy; q.vy += 0.05; q.r += q.vr; x.save(); x.translate(q.x, q.y); x.rotate(q.r); x.fillStyle = q.c; x.globalAlpha = Math.max(0, 1 - el / 3400); x.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); x.restore(); });
        requestAnimationFrame(frame);
      })(performance.now());
    } catch (e) {}
  }
  function chime(big) {
    if (window.LochFX && window.LochFX.chime) return window.LochFX.chime(big);
    try {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var a = new A(), t = a.currentTime, notes = big ? [523, 659, 784, 1047] : [659, 880];
      notes.forEach(function (f, i) { var o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * .11); g.gain.exponentialRampToValueAtTime(0.18, t + i * .11 + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * .11 + .28); o.connect(g); g.connect(a.destination); o.start(t + i * .11); o.stop(t + i * .11 + .3); });
      setTimeout(function () { try { a.close(); } catch (e) {} }, 1500);
    } catch (e) {}
  }
  /* neue Abzeichen prüfen und anzeigen; liefert die neu erreichten */
  function check() {
    var c = ctx(), e = earned(), fresh = [];
    DEFS.forEach(function (d) { if (e[d.id]) return; var p = d.prog(c); if (p[0] >= p[1]) { e[d.id] = Date.now(); fresh.push(d); } });
    if (fresh.length) { set('lm4.badges', e); fresh.forEach(popup); }
    return fresh;
  }
  /* Ergebnis einer Aufgabe: Konfetti beim ersten vollständigen Treffer, dazu Abzeichen-Prüfung */
  function result(id, pct) {
    if (window.LochFX && window.LochFX.pass) window.LochFX.pass(pct);
    if (!(pct >= 100)) return;
    var seen = get('lm4.seen', {}), first = !seen[id]; if (first) { seen[id] = 1; set('lm4.seen', seen); }
    var fresh = check();
    if (first || fresh.length) { confetti(fresh.length > 0); chime(fresh.length > 0); }
  }
  /* Zähler erhöhen (oder Höchstwert merken) und prüfen */
  function stat(key, val, mode) {
    var s = stats();
    if (mode === 'max') s[key] = Math.max(s[key] || 0, val || 0); else s[key] = (s[key] || 0) + (val == null ? 1 : val);
    set('lm4.stats', s);
    var fresh = check(); if (fresh.length) { confetti(true); chime(true); }
  }
  function open() {
    var u = ui(), c = ctx(), e = earned(), n = DEFS.filter(function (d) { return e[d.id]; }).length;
    u.sheet('Abzeichen', function (b) {
      var h = '<p style="margin-top:0">Du hast <b>' + n + ' von ' + DEFS.length + '</b> Abzeichen. Sie entstehen von allein, wenn du Aufgaben löst und Funktionen ausprobierst.</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">';
      DEFS.forEach(function (d) {
        var p = d.prog(c), got = !!e[d.id], pr = Math.min(p[0], p[1]);
        h += '<div style="border:1px solid var(--line,#38424d);border-radius:14px;padding:10px;text-align:center;' + (got ? 'background:linear-gradient(135deg,rgba(255,179,0,.22),rgba(255,122,0,.12));' : 'opacity:.62;') + '"><div style="font-size:34px;line-height:1.1;' + (got ? '' : 'filter:grayscale(1);') + '">' + d.icon + '</div><b style="font-size:14px">' + esc(d.name) + '</b><div style="font-size:12px;color:var(--mute,#8d99a6);margin-top:3px">' + esc(d.desc) + '</div><div style="font-size:12px;margin-top:5px;font-weight:600">' + (got ? '✓ erreicht' : pr + ' / ' + p[1]) + '</div></div>';
      });
      b.innerHTML = h + '</div>';
    });
  }
  window.Badges = { result: result, stat: stat, open: open, check: check, confetti: confetti, chime: chime, earnedIds: function () { return Object.keys(earned()); }, DEFS: DEFS };
})();
