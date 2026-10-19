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
    ['allround', '🌍', 'Allrounder', 'In jedem Lab mindestens eine Aufgabe geschafft.', function (c) { var labs = Object.keys(window.AUFGABEN_LABS || { loch: 1, sch: 1, sim: 1, code: 1, pi: 1 }); return [labs.filter(function (l) { return c.n(c.ids(l)) > 0; }).length, labs.length]; }],
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
    ['trainer5', '🧭', 'Alle Labs erkundet', 'Den Trainer in allen Labs durchgespielt.', function (c) { return [c.st.trainer || 0, Object.keys(window.AUFGABEN_LABS || { a: 1, b: 1, c: 1, d: 1, e: 1 }).length]; }],
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
