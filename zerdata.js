'use strict';
/* Tonfunk Zerspan-Lab: Aufgaben und Richtwerte.
   window.ZER_TASKS = [{ id, lab:'zer', cat, title, level }, ...]   (Schnittstelle für Startseite, Lernpfad, Auswertung)
   window.ZER_DEFS  = { id: Definition }   (Generator oder feste Aufgabe, siehe unten)
   window.ZER_BUILD(id, seed) -> fertige Aufgabe { id, type, text, unit, sol, tol, opts, ans, series, accept, steps, tips, ... }
   Typen: 'num' (Zahl mit Einheit, Toleranz tol Prozent), 'choice' (Auswahl), 'series' (Stufe der Drehzahlreihe wählen).
   Gleicher Startwert (seed) ergibt gleiche Zahlen; "Neue Zahlen" im Lab nimmt einen neuen Startwert.
   Alle Richtwerte (vc-Fenster, kc, fz) sind Richtwerte, Werkzeughersteller beachten. Unsichere Zahlen sind in zercore.js mit PRUEFEN markiert. */
(function (root) {
  var C = root.ZER_CORE || (typeof require !== 'undefined' ? require('./zercore.js') : null);
  var F = C.fmt, PI = Math.PI;
  var CATS = { vc: 'Drehzahl und vc', zeit: 'Vorschub und Zeit', fraes: 'Fräsen', bohr: 'Bohren', praxis: 'Praxisfälle' };
  var CAT_KEYS = ['vc', 'zeit', 'fraes', 'bohr', 'praxis'];
  var DEFS = {};
  var ORDER = [];
  function def(id, cat, level, title, type, gen, extra) {
    DEFS[id] = { id: id, cat: cat, level: level, title: title, type: type, gen: gen, extra: !!extra };
    ORDER.push(id);
  }
  /* kleine Hilfen für Texte */
  var N = function (v) { return F(v); };
  var tipps = function (a, b, c) { return [a, b, c].filter(Boolean); };

  /* ====================== Drehzahl und vc ====================== */
  def('zer1', 'vc', 1, 'Schnittgeschwindigkeit berechnen', 'num', function (r) {
    var d = r.pick([20, 25, 30, 40, 50, 60, 80]), n = r.pick([180, 250, 355, 500, 710, 1000]), s = C.vc(d, n);
    return {
      text: 'Ein Rundstab mit d = ' + d + ' mm wird bei n = ' + n + ' min⁻¹ abgedreht. Wie groß ist die Schnittgeschwindigkeit vc?', unit: 'm/min', sol: s,
      steps: ['vc = π · d · n / 1000', 'vc = π · ' + d + ' mm · ' + n + ' min⁻¹ / 1000 = ' + N(s) + ' m/min'],
      tips: tipps('Die Schnittgeschwindigkeit ist der Weg, den die Schneide am Umfang des Werkstücks in einer Minute zurücklegt.', 'Formel: vc = π · d · n / 1000. Der Durchmesser steht in mm, das Ergebnis kommt in m/min heraus.', 'Zwischenergebnis: π · ' + d + ' · ' + n + ' = ' + F(PI * d * n, 0) + '. Das noch durch 1000 teilen.')
    };
  });
  def('zer2', 'vc', 1, 'Drehzahl aus vc und Durchmesser', 'num', function (r) {
    var d = r.pick([16, 20, 25, 32, 40, 50, 63]), v = r.pick([20, 25, 30, 40, 80, 100]), s = C.nFromVc(v, d);
    return {
      text: 'Für den Durchmesser d = ' + d + ' mm ist die Schnittgeschwindigkeit vc = ' + v + ' m/min vorgesehen. Welche Drehzahl n ist einzustellen (rechnerisch)?', unit: 'min⁻¹', sol: s,
      steps: ['vc = π · d · n / 1000, umgestellt nach n:', 'n = vc · 1000 / (π · d)', 'n = ' + v + ' m/min · 1000 / (π · ' + d + ' mm) = ' + N(s) + ' min⁻¹'],
      tips: tipps('Die Formel für vc musst du nach n umstellen.', 'n = vc · 1000 / (π · d). Mit 1000 rechnest du Meter in Millimeter um.', 'Nenner: π · ' + d + ' = ' + F(PI * d) + '. Zähler: ' + v + ' · 1000 = ' + (v * 1000) + '.')
    };
  });
  def('zer3', 'vc', 1, 'Einheit der Schnittgeschwindigkeit', 'choice', function () {
    return {
      text: 'Welche Einheit hat die Schnittgeschwindigkeit vc im Tabellenbuch Metall?', opts: ['m/min', 'mm/min', 'min⁻¹', 'mm/U'], correct: 0,
      steps: ['vc wird in m/min angegeben (Meter Schnittweg je Minute).', 'mm/min ist die Einheit der Vorschubgeschwindigkeit vf, min⁻¹ die der Drehzahl n, mm/U die des Vorschubs f.'],
      tips: tipps('Überlege, welche Größe vc beschreibt: eine Geschwindigkeit am Umfang.', 'Im Tabellenbuch stehen die Richtwerte für vc als Zahlen wie 25 oder 150 für Stahl. Das sind Meter pro Minute.')
    };
  });
  def('zer4', 'vc', 2, 'Passende Stufe der Drehzahlreihe wählen', 'series', function (r) {
    var d = r.pick([20, 25, 30, 40, 50]), v = r.pick([25, 30]), ns = C.nFromVc(v, d), best = C.nearestSpeed(C.SERIES_STD, ns);
    return {
      text: 'Ein Stab S235 (Ø ' + d + ' mm) wird mit einem HSS-Drehmeißel gedreht, Richtwert vc = ' + v + ' m/min. Die Drehbank hat die Stufen der Reihe unten. Tippe die Stufe an, die der rechnerischen Drehzahl am nächsten liegt.',
      series: C.SERIES_STD, d: d, window: [v, v], accept: [best], sol: best, unit: 'min⁻¹',
      steps: ['n = vc · 1000 / (π · d) = ' + v + ' · 1000 / (π · ' + d + ') = ' + N(ns) + ' min⁻¹', 'Nächstliegende Stufe der Reihe: ' + best + ' min⁻¹.', 'Probe: vc = π · ' + d + ' · ' + best + ' / 1000 = ' + N(C.vc(d, best)) + ' m/min.'],
      tips: tipps('Rechne zuerst die Soll-Drehzahl aus.', 'n = vc · 1000 / (π · d). Dann in der Reihe die Stufe suchen, die am wenigsten abweicht.', 'Die rechnerische Drehzahl liegt bei etwa ' + F(ns, 0) + ' min⁻¹.')
    };
  });
  def('zer5', 'vc', 2, 'Durchmesser aus vc und Drehzahl', 'num', function (r) {
    var v = r.pick([60, 80, 100, 120, 150]), n = r.pick([500, 800, 1000, 1250, 1600]), s = C.dFromVcN(v, n);
    return {
      text: 'Eine Maschine läuft mit n = ' + n + ' min⁻¹. Dabei wird eine Schnittgeschwindigkeit von vc = ' + v + ' m/min erreicht. Welchen Durchmesser hat das Werkstück?', unit: 'mm', sol: s,
      steps: ['vc = π · d · n / 1000, umgestellt nach d:', 'd = vc · 1000 / (π · n)', 'd = ' + v + ' · 1000 / (π · ' + n + ') = ' + N(s) + ' mm'],
      tips: tipps('Diesmal ist der Durchmesser gesucht, stelle die Formel nach d um.', 'd = vc · 1000 / (π · n).', 'Nenner: π · ' + n + ' = ' + F(PI * n, 0) + '. Zähler: ' + (v * 1000) + '.')
    };
  });
  def('zer6', 'vc', 3, 'Drehzahl im Richtwert-Fenster (Hartmetall)', 'series', function (r) {
    var d = r.pick([30, 40, 50, 60, 80]), w = C.vcWindow('dreh', 'stahl', 'hm'), ok = C.speedsInWindow(C.SERIES_STD, d, w[0], w[1]);
    return {
      text: 'Stahl-Welle (Ø ' + d + ' mm), Drehen mit Hartmetall-Wendeplatte. Richtwert-Fenster für vc: ' + w[0] + ' bis ' + w[1] + ' m/min. Tippe eine Stufe der Reihe an, bei der vc im Fenster liegt.',
      series: C.SERIES_STD, d: d, window: w, accept: ok, sol: ok[0], unit: 'min⁻¹',
      steps: ['n_min = ' + w[0] + ' · 1000 / (π · ' + d + ') = ' + N(C.nFromVc(w[0], d)) + ' min⁻¹; n_max = ' + w[1] + ' · 1000 / (π · ' + d + ') = ' + N(C.nFromVc(w[1], d)) + ' min⁻¹', 'Stufen dazwischen: ' + ok.join(', ') + ' min⁻¹.', 'Mehrere Stufen können richtig sein; im Zweifel nimmt man für Schlichten die höhere, für Schruppen die niedrigere.'],
      tips: tipps('Rechne die Grenzdrehzahlen n_min und n_max für beide Rand-Werte des Fensters aus.', 'n = vc · 1000 / (π · d), einmal mit ' + w[0] + ' m/min und einmal mit ' + w[1] + ' m/min.', 'Das Fenster reicht ungefähr von ' + F(C.nFromVc(w[0], d), 0) + ' bis ' + F(C.nFromVc(w[1], d), 0) + ' min⁻¹.')
    };
  });
  def('zer7', 'vc', 3, 'Abdrehen: vc am kleinen Durchmesser', 'num', function (r) {
    var d1 = r.pick([60, 80, 100]), d2 = r.pick([20, 30, 40]), n = r.pick([355, 500, 710]), s = C.vc(d2, n), s1 = C.vc(d1, n);
    return {
      text: 'Ein Bolzen Ø ' + d1 + ' mm wird bei konstant n = ' + n + ' min⁻¹ bis auf Ø ' + d2 + ' mm abgesetzt. Wie groß ist die Schnittgeschwindigkeit am kleinen Durchmesser?', unit: 'm/min', sol: s,
      steps: ['Die Drehzahl bleibt gleich, nur der Durchmesser ändert sich.', 'vc = π · ' + d2 + ' · ' + n + ' / 1000 = ' + N(s) + ' m/min', 'Zum Vergleich: am großen Durchmesser waren es ' + N(s1) + ' m/min. Je kleiner d, desto kleiner vc.'],
      tips: tipps('Für die Rechnung zählt der Durchmesser, an dem die Schneide gerade arbeitet.', 'vc = π · d · n / 1000 mit dem kleinen Durchmesser d2.', 'π · ' + d2 + ' · ' + n + ' = ' + F(PI * d2 * n, 0) + ', dann durch 1000.')
    };
  });

  /* ====================== Vorschub und Zeit ====================== */
  def('zer8', 'zeit', 1, 'Vorschubgeschwindigkeit vf', 'num', function (r) {
    var f = r.pick([0.1, 0.15, 0.2, 0.25, 0.3]), n = r.pick([250, 355, 500, 710, 1000]), s = C.vf(f, n);
    return {
      text: 'Beim Längsdrehen ist der Vorschub f = ' + N(f) + ' mm/U bei n = ' + n + ' min⁻¹. Wie groß ist die Vorschubgeschwindigkeit vf?', unit: 'mm/min', sol: s,
      steps: ['vf = f · n', 'vf = ' + N(f) + ' mm/U · ' + n + ' min⁻¹ = ' + N(s) + ' mm/min'],
      tips: tipps('Der Vorschub je Umdrehung wird mit der Zahl der Umdrehungen je Minute malgenommen.', 'vf = f · n, das Ergebnis hat die Einheit mm/min.')
    };
  });
  def('zer9', 'zeit', 1, 'Hauptzeit beim Längsdrehen', 'num', function (r) {
    var l = r.pick([60, 80, 100, 120, 150]), f = r.pick([0.1, 0.2, 0.25, 0.3]), n = r.pick([250, 500, 710, 1000]), s = C.thDreh(l, 0, 0, 1, f, n);
    return {
      text: 'Eine Welle wird auf l = ' + l + ' mm Länge in einem Schnitt gedreht (An- und Überlauf werden hier nicht beachtet). f = ' + N(f) + ' mm/U, n = ' + n + ' min⁻¹. Wie groß ist die Hauptzeit th?', unit: 'min', sol: s,
      steps: ['vf = f · n = ' + N(f) + ' · ' + n + ' = ' + N(C.vf(f, n)) + ' mm/min', 'th = L / vf = ' + l + ' mm / ' + N(C.vf(f, n)) + ' mm/min = ' + N(s) + ' min (' + C.fmtZeit(s) + ')'],
      tips: tipps('Zeit = Weg geteilt durch Geschwindigkeit.', 'Berechne erst vf = f · n, dann th = L / vf.', 'vf beträgt ' + N(C.vf(f, n)) + ' mm/min.')
    };
  });
  def('zer10', 'zeit', 2, 'Hauptzeit mit Anlauf und Überlauf', 'num', function (r) {
    var l = r.pick([80, 100, 120, 150]), la = r.pick([2, 3, 4]), lu = r.pick([1, 2, 3]), f = r.pick([0.15, 0.2, 0.25]), n = r.pick([355, 500, 710]), s = C.thDreh(l, la, lu, 1, f, n);
    return {
      text: 'Längsdrehen einer Welle: Länge l = ' + l + ' mm, Anlaufweg ' + la + ' mm, Überlaufweg ' + lu + ' mm, f = ' + N(f) + ' mm/U, n = ' + n + ' min⁻¹, ein Schnitt. Wie groß ist die Hauptzeit?', unit: 'min', sol: s,
      steps: ['Gesamtweg L = l + la + lü = ' + l + ' + ' + la + ' + ' + lu + ' = ' + (l + la + lu) + ' mm', 'vf = f · n = ' + N(C.vf(f, n)) + ' mm/min', 'th = L / vf = ' + N(s) + ' min (' + C.fmtZeit(s) + ')'],
      tips: tipps('Der Meißel legt mehr Weg zurück als die Werkstücklänge.', 'L = l + la + lü, danach th = L / (f · n).', 'L = ' + (l + la + lu) + ' mm, vf = ' + N(C.vf(f, n)) + ' mm/min.')
    };
  });
  def('zer11', 'zeit', 2, 'Wie viele Schnitte sind nötig?', 'num', function (r) {
    var d1 = r.pick([40, 50, 60]), z = r.pick([5, 6, 7, 8, 9]), ap = r.pick([1.5, 2, 2.5]), d2 = d1 - 2 * z, i = C.schnitte(d1, d2, ap);
    return {
      text: 'Ein Rohling Ø ' + d1 + ' mm wird auf Ø ' + d2 + ' mm abgedreht. Die größte Zustellung je Schnitt ist ap = ' + N(ap) + ' mm. Wie viele Schnitte i sind mindestens nötig?', unit: 'Schnitte', sol: i, tol: 0,
      steps: ['Gesamte Zustellung (Radius) = (d1 − d2) / 2 = (' + d1 + ' − ' + d2 + ') / 2 = ' + z + ' mm', 'i = ' + z + ' mm / ' + N(ap) + ' mm = ' + N(z / ap) + ', aufgerundet auf ' + i + ' Schnitte.'],
      tips: tipps('ap wirkt am Radius, nicht am Durchmesser.', 'Gesamtzustellung = (d1 − d2) / 2, geteilt durch ap, dann aufrunden.', 'Die Gesamtzustellung beträgt ' + z + ' mm.')
    };
  });
  def('zer12', 'zeit', 3, 'Gesamte Hauptzeit mit mehreren Schnitten', 'num', function (r) {
    var d1 = r.pick([40, 50, 60]), z = r.pick([4, 5, 6]), ap = r.pick([2, 2.5]), d2 = d1 - 2 * z, i = C.schnitte(d1, d2, ap), l = r.pick([80, 100, 120]), la = 3, lu = 2, f = r.pick([0.2, 0.25]), n = r.pick([500, 710]), s = C.thDreh(l, la, lu, i, f, n);
    return {
      text: 'Eine Welle der Länge l = ' + l + ' mm wird von Ø ' + d1 + ' mm auf Ø ' + d2 + ' mm gedreht, ap = ' + N(ap) + ' mm je Schnitt. Anlauf ' + la + ' mm, Überlauf ' + lu + ' mm, f = ' + N(f) + ' mm/U, n = ' + n + ' min⁻¹. Wie lange dauert das Abdrehen insgesamt (Hauptzeit)?', unit: 'min', sol: s,
      steps: ['Schnitte: i = (d1 − d2) / (2 · ap) = ' + N((d1 - d2) / (2 * ap)) + ', aufgerundet ' + i, 'L = ' + l + ' + ' + la + ' + ' + lu + ' = ' + (l + la + lu) + ' mm; vf = ' + N(C.vf(f, n)) + ' mm/min', 'th = L · i / vf = ' + (l + la + lu) + ' · ' + i + ' / ' + N(C.vf(f, n)) + ' = ' + N(s) + ' min (' + C.fmtZeit(s) + ')'],
      tips: tipps('Erst die Zahl der Schnitte, dann den Gesamtweg, dann die Zeit.', 'th = L · i / (f · n) mit L = l + la + lü.', 'Es sind ' + i + ' Schnitte nötig, L = ' + (l + la + lu) + ' mm.')
    };
  });
  def('zer13', 'zeit', 2, 'Spanquerschnitt', 'num', function (r) {
    var ap = r.pick([1, 1.5, 2, 2.5, 3]), f = r.pick([0.1, 0.2, 0.25, 0.3, 0.4]), s = C.spanquerschnitt(ap, f);
    return {
      text: 'Beim Drehen ist die Zustellung ap = ' + N(ap) + ' mm und der Vorschub f = ' + N(f) + ' mm/U. Wie groß ist der Spanquerschnitt A?', unit: 'mm²', sol: s,
      steps: ['A = ap · f', 'A = ' + N(ap) + ' mm · ' + N(f) + ' mm = ' + N(s) + ' mm²'],
      tips: tipps('Der Span hat annähernd Rechteckform: Breite mal Dicke.', 'A = ap · f, beide in mm, ergibt mm².')
    };
  });
  def('zer14', 'zeit', 3, 'Schnittkraft Fc', 'num', function (r) {
    var m = r.pick(['s235', 'c45', 'alu', 'gg']), kc = C.kcOf(m), ap = r.pick([1, 2, 3]), f = r.pick([0.2, 0.25, 0.3]), A = C.spanquerschnitt(ap, f), s = C.schnittkraft(A, kc);
    return {
      text: 'Werkstoff ' + C.MATERIALS[m].name + ', Richtwert kc = ' + kc + ' N/mm². Zustellung ap = ' + N(ap) + ' mm, Vorschub f = ' + N(f) + ' mm/U. Wie groß ist die Schnittkraft Fc (vereinfacht Fc = A · kc)?', unit: 'N', sol: s,
      steps: ['A = ap · f = ' + N(ap) + ' · ' + N(f) + ' = ' + N(A) + ' mm²', 'Fc = A · kc = ' + N(A) + ' mm² · ' + kc + ' N/mm² = ' + N(s) + ' N', 'Hinweis: kc ist ein vereinfachter Richtwert; echte kc-Werte hängen von der Spanungsdicke ab.'],
      tips: tipps('Zuerst den Spanquerschnitt, dann mit der spezifischen Schnittkraft malnehmen.', 'A = ap · f, danach Fc = A · kc. Die Einheit N/mm² mal mm² ergibt N.', 'A = ' + N(A) + ' mm².')
    };
  });
  def('zer15', 'zeit', 3, 'Schnittleistung Pc', 'num', function (r) {
    var ap = r.pick([1.5, 2, 3]), f = r.pick([0.2, 0.25, 0.3]), kc = r.pick([1100, 2100, 2400]), v = r.pick([80, 100, 120]), A = C.spanquerschnitt(ap, f), Fc = C.schnittkraft(A, kc), s = C.schnittleistung(Fc, v);
    return {
      text: 'ap = ' + N(ap) + ' mm, f = ' + N(f) + ' mm/U, kc = ' + kc + ' N/mm², vc = ' + v + ' m/min. Wie groß ist die Schnittleistung Pc in kW (Pc = Fc · vc / 60 000)?', unit: 'kW', sol: s,
      steps: ['A = ' + N(ap) + ' · ' + N(f) + ' = ' + N(A) + ' mm²', 'Fc = A · kc = ' + N(Fc) + ' N', 'Pc = Fc · vc / 60 000 = ' + N(Fc) + ' · ' + v + ' / 60 000 = ' + N(s) + ' kW'],
      tips: tipps('Rechne in zwei Schritten: erst Fc, dann Pc.', 'Fc = ap · f · kc. Pc = Fc · vc / 60 000 (Fc in N, vc in m/min, Pc in kW).', 'Fc beträgt ' + N(Fc) + ' N.')
    };
  });
  def('zer16', 'zeit', 2, 'Vorschub aus der Hauptzeit', 'num', function (r) {
    var l = r.pick([100, 120, 150, 200]), n = r.pick([250, 500, 1000]), t = r.pick([0.5, 1, 1.5, 2, 2.5, 3]), s = C.fFromVf(l / t, n);
    return {
      text: 'Eine Welle (l = ' + l + ' mm, ohne An- und Überlauf, ein Schnitt) soll in th = ' + N(t) + ' min gedreht werden. Die Drehzahl ist n = ' + n + ' min⁻¹. Welcher Vorschub f ist dafür nötig?', unit: 'mm/U', sol: s,
      steps: ['vf = L / th = ' + l + ' mm / ' + N(t) + ' min = ' + N(l / t) + ' mm/min', 'f = vf / n = ' + N(l / t) + ' / ' + n + ' = ' + N(s) + ' mm/U'],
      tips: tipps('Stelle th = L / (f · n) nach f um.', 'f = L / (th · n).', 'Die nötige Vorschubgeschwindigkeit ist vf = ' + N(l / t) + ' mm/min.')
    };
  });

  /* ====================== Fräsen ====================== */
  def('zer17', 'fraes', 1, 'Fräserdrehzahl aus vc', 'num', function (r) {
    var d = r.pick([12, 16, 20, 25, 32, 40, 50, 63, 80]), hm = r.pick([false, true]), v = hm ? r.pick([100, 150, 200]) : r.pick([25, 30]), s = C.nFromVc(v, d);
    return {
      text: 'Ein ' + (hm ? 'Hartmetall' : 'HSS') + '-Fräser mit d = ' + d + ' mm soll mit vc = ' + v + ' m/min arbeiten. Welche Drehzahl n ist einzustellen?', unit: 'min⁻¹', sol: s,
      steps: ['Beim Fräsen zählt der Fräserdurchmesser: n = vc · 1000 / (π · d)', 'n = ' + v + ' · 1000 / (π · ' + d + ') = ' + N(s) + ' min⁻¹'],
      tips: tipps('Es dreht sich der Fräser, also gilt sein Durchmesser.', 'n = vc · 1000 / (π · d).', 'Nenner: π · ' + d + ' = ' + F(PI * d) + '.')
    };
  });
  def('zer18', 'fraes', 2, 'Vorschubgeschwindigkeit beim Fräsen', 'num', function (r) {
    var fz = r.pick([0.03, 0.05, 0.08, 0.1]), z = r.pick([2, 3, 4, 5, 6]), n = r.pick([500, 800, 1000, 1250, 1600]), s = C.vfFraes(fz, z, n);
    return {
      text: 'Ein Fräser mit z = ' + z + ' Schneiden läuft mit n = ' + n + ' min⁻¹, der Zahnvorschub ist fz = ' + N(fz) + ' mm. Wie groß ist die Vorschubgeschwindigkeit vf?', unit: 'mm/min', sol: s,
      steps: ['vf = fz · z · n', 'vf = ' + N(fz) + ' mm · ' + z + ' · ' + n + ' min⁻¹ = ' + N(s) + ' mm/min'],
      tips: tipps('Jede Schneide schneidet einen Span der Dicke fz, es gibt z Schneiden pro Umdrehung.', 'vf = fz · z · n.')
    };
  });
  def('zer19', 'fraes', 2, 'Vom vc zum Tischvorschub', 'num', function (r) {
    var d = r.pick([20, 25, 32, 40, 50]), v = r.pick([25, 30, 100, 150]), z = r.pick([3, 4, 5, 6]), fz = r.pick([0.05, 0.08, 0.1]), nn = C.nFromVc(v, d), s = C.vfFraes(fz, z, nn);
    return {
      text: 'Fräser d = ' + d + ' mm, z = ' + z + ', vc = ' + v + ' m/min, fz = ' + N(fz) + ' mm. Welche Vorschubgeschwindigkeit vf (Tischvorschub) ergibt sich?', unit: 'mm/min', sol: s,
      steps: ['n = vc · 1000 / (π · d) = ' + N(nn) + ' min⁻¹', 'vf = fz · z · n = ' + N(fz) + ' · ' + z + ' · ' + N(nn) + ' = ' + N(s) + ' mm/min'],
      tips: tipps('Zwei Schritte: erst die Drehzahl, dann der Vorschub.', 'n = vc · 1000 / (π · d), danach vf = fz · z · n.', 'Die Drehzahl liegt bei etwa ' + F(nn, 0) + ' min⁻¹.')
    };
  });
  def('zer20', 'fraes', 3, 'Hauptzeit beim Fräsen', 'num', function (r) {
    var l = r.pick([100, 120, 150, 200]), la = r.pick([4, 5, 6]), lu = r.pick([3, 4]), fz = r.pick([0.05, 0.1]), z = r.pick([4, 5]), n = r.pick([500, 800, 1000]), vf = C.vfFraes(fz, z, n), s = C.thFraes(l, la, lu, 1, vf);
    return {
      text: 'Eine Fläche von l = ' + l + ' mm Länge wird in einem Schnitt gefräst. Anlauf ' + la + ' mm, Überlauf ' + lu + ' mm. Fräser mit z = ' + z + ' Schneiden, fz = ' + N(fz) + ' mm, n = ' + n + ' min⁻¹. Wie groß ist die Hauptzeit?', unit: 'min', sol: s,
      steps: ['vf = fz · z · n = ' + N(fz) + ' · ' + z + ' · ' + n + ' = ' + N(vf) + ' mm/min', 'L = l + la + lü = ' + (l + la + lu) + ' mm', 'th = L / vf = ' + (l + la + lu) + ' / ' + N(vf) + ' = ' + N(s) + ' min (' + C.fmtZeit(s) + ')'],
      tips: tipps('Die Zeit hängt vom Tischvorschub vf ab.', 'vf = fz · z · n, dann th = (l + la + lü) / vf.', 'vf = ' + N(vf) + ' mm/min, L = ' + (l + la + lu) + ' mm.')
    };
  });
  def('zer21', 'fraes', 3, 'Zahnvorschub aus dem Tischvorschub', 'num', function (r) {
    var fz = r.pick([0.03, 0.05, 0.08, 0.1]), z = r.pick([2, 4, 5, 6]), n = r.pick([500, 800, 1000, 1250]), vf = C.vfFraes(fz, z, n), s = C.fzFromVf(vf, z, n);
    return {
      text: 'An der Fräsmaschine ist der Tischvorschub vf = ' + N(vf) + ' mm/min eingestellt. Der Fräser hat z = ' + z + ' Schneiden und läuft mit n = ' + n + ' min⁻¹. Wie groß ist der Zahnvorschub fz?', unit: 'mm', sol: s,
      steps: ['vf = fz · z · n, umgestellt: fz = vf / (z · n)', 'fz = ' + N(vf) + ' / (' + z + ' · ' + n + ') = ' + N(s) + ' mm'],
      tips: tipps('Stelle vf = fz · z · n nach fz um.', 'fz = vf / (z · n).', 'z · n = ' + (z * n) + '.')
    };
  });

  /* ====================== Bohren ====================== */
  def('zer22', 'bohr', 1, 'Bohrerdrehzahl aus vc', 'num', function (r) {
    var d = r.pick([5, 6, 8, 10, 12, 16, 20]), v = r.pick([20, 25, 30]), s = C.nFromVc(v, d);
    return {
      text: 'Mit einem HSS-Spiralbohrer d = ' + d + ' mm wird Stahl gebohrt, Richtwert vc = ' + v + ' m/min. Welche Drehzahl n ist einzustellen?', unit: 'min⁻¹', sol: s,
      steps: ['n = vc · 1000 / (π · d) = ' + v + ' · 1000 / (π · ' + d + ') = ' + N(s) + ' min⁻¹', 'Kleine Bohrer brauchen hohe Drehzahlen: je kleiner d, desto größer n.'],
      tips: tipps('Es gilt dieselbe Formel wie beim Drehen, mit dem Bohrerdurchmesser.', 'n = vc · 1000 / (π · d).', 'Nenner: π · ' + d + ' = ' + F(PI * d) + '.')
    };
  });
  def('zer23', 'bohr', 2, 'Anschnittlänge der Bohrerspitze', 'num', function (r) {
    var d = r.pick([6, 8, 10, 12, 16, 20, 25]), s = C.bohrAnschnitt(d, 118);
    return {
      text: 'Ein Spiralbohrer mit Spitzenwinkel 118° und d = ' + d + ' mm bohrt in Stahl. Wie lang ist der Anschnitt la der Bohrerspitze (la = (d/2) / tan(σ/2), Faustformel ca. 0,3 · d)?', unit: 'mm', sol: s,
      steps: ['la = (d / 2) / tan(118° / 2) = ' + N(d / 2) + ' mm / tan 59° = ' + N(s) + ' mm', 'Faustformel: la ≈ 0,3 · d = ' + N(0.3 * d) + ' mm.'],
      tips: tipps('Die Spitze ist ein Kegel mit dem Winkel 118°.', 'Die Faustformel für 118° lautet la ≈ 0,3 · d.', 'Für d = ' + d + ' mm ergibt 0,3 · d etwa ' + N(0.3 * d) + ' mm.')
    };
  });
  def('zer24', 'bohr', 2, 'Bohrzeit Durchgangsbohrung', 'num', function (r) {
    var d = r.pick([8, 10, 12]), l = r.pick([10, 15, 20, 25]), f = r.pick([0.1, 0.15, 0.2]), n = r.pick([800, 1000, 1200]), s = C.thBohr(l, d, f, n, { durchgang: true, lu: 1 }), la = C.bohrAnschnitt(d, 118);
    return {
      text: 'Durchgangsbohrung d = ' + d + ' mm in eine ' + l + ' mm dicke Platte (Spitzenwinkel 118°, Anschnitt la ≈ 0,3 · d, Überlauf lü = 1 mm). f = ' + N(f) + ' mm/U, n = ' + n + ' min⁻¹. Wie groß ist die Bohrzeit?', unit: 'min', sol: s,
      steps: ['la ≈ 0,3 · d = ' + N(la) + ' mm', 'L = l + la + lü = ' + l + ' + ' + N(la) + ' + 1 = ' + N(l + la + 1) + ' mm', 'vf = f · n = ' + N(C.vf(f, n)) + ' mm/min', 'th = L / vf = ' + N(s) + ' min (' + C.fmtZeit(s) + ')'],
      tips: tipps('Bohrweg = Plattendicke plus Anschnitt plus Überlauf.', 'L = l + 0,3 · d + lü, danach th = L / (f · n).', 'Der Gesamtweg beträgt etwa ' + N(l + la + 1) + ' mm.')
    };
  });
  def('zer25', 'bohr', 3, 'Bohrzeit Sacklochbohrung aus vc', 'num', function (r) {
    var d = r.pick([8, 10, 12, 16]), t = r.pick([15, 20, 30, 40]), v = r.pick([20, 25, 30]), f = r.pick([0.1, 0.15, 0.2]), n = C.nFromVc(v, d), s = C.thBohr(t, d, f, n), la = C.bohrAnschnitt(d, 118);
    return {
      text: 'Sackloch d = ' + d + ' mm, volle Bohrtiefe t = ' + t + ' mm (ohne Spitze gemessen), HSS in Stahl mit vc = ' + v + ' m/min, f = ' + N(f) + ' mm/U. Spitzenwinkel 118° (la ≈ 0,3 · d), kein Überlauf. Wie groß ist die Bohrzeit?', unit: 'min', sol: s,
      steps: ['n = vc · 1000 / (π · d) = ' + N(n) + ' min⁻¹', 'vf = f · n = ' + N(C.vf(f, n)) + ' mm/min', 'L = t + la = ' + t + ' + ' + N(la) + ' = ' + N(t + la) + ' mm', 'th = L / vf = ' + N(s) + ' min (' + C.fmtZeit(s) + ')'],
      tips: tipps('Drei Schritte: Drehzahl, Vorschubgeschwindigkeit, Zeit.', 'n = vc · 1000 / (π · d), vf = f · n, th = (t + 0,3 · d) / vf.', 'Die Drehzahl beträgt etwa ' + F(n, 0) + ' min⁻¹.')
    };
  });
  def('zer26', 'bohr', 1, 'Spitzenwinkel für Stahl', 'choice', function () {
    return {
      text: 'Welcher Spitzenwinkel ist bei einem Normal-Spiralbohrer (Typ N) für Stahl üblich?', opts: ['118°', '60°', '90°', '140°'], correct: 0,
      steps: ['Der übliche Spitzenwinkel für Stahl und Guss beim Typ N ist 118°.', 'Sehr weiche Werkstoffe und harte, spröde Werkstoffe brauchen andere Winkel.'],
      tips: tipps('Es ist der Standardwinkel der meisten Spiralbohrer aus der Werkstatt.', 'Die Zahl liegt zwischen 110° und 120°.')
    };
  });

  /* ====================== Praxisfälle und Fehlersuche ====================== */
  var FS = ['vc zu hoch', 'vc zu niedrig', 'Vorschub zu groß', 'Kühlung fehlt'];
  function fs(id, level, title, build, extra) {
    def(id, 'praxis', level, title, 'choice', function (r) { var o = build(r); o.opts = FS.slice(); o.keep = false; return o; }, extra);
  }
  fs('zer27', 2, 'Fehlersuche: Oberfläche rau', function (r) {
    var d = r.pick([30, 40, 50]), f = r.pick([0.5, 0.6, 0.8]), n = C.nearestSpeed(C.SERIES_STD, C.nFromVc(150, d)), v = C.vc(d, n);
    return {
      text: 'Fehlerkarte „Oberfläche rau“: Eine Stahl-Welle (Ø ' + d + ' mm) soll geschlichtet werden. Du siehst gleichmäßige Rillen auf dem Umfang, im Abstand von etwa ' + N(f) + ' mm. Eingestellt: Hartmetall-Wendeplatte, n = ' + n + ' min⁻¹ (vc ≈ ' + F(v, 0) + ' m/min), f = ' + N(f) + ' mm/U, ap = 0,3 mm, Kühlschmierstoff läuft. Was ist die wahrscheinlichste Ursache?',
      correct: 2,
      steps: ['Rillen im Abstand des Vorschubs sind der Abdruck der Schneidenspitze: Pro Umdrehung rückt der Meißel um f weiter.', 'vc = ' + N(v) + ' m/min liegt im Fenster für Hartmetall in Stahl (120 bis 220 m/min), die Kühlung läuft. Ein Vorschub von ' + N(f) + ' mm/U ist für Schlichten viel zu groß.', 'Abhilfe: Vorschub deutlich verkleinern (z. B. 0,1 bis 0,2 mm/U) oder Platte mit größerem Eckenradius nehmen.'],
      tips: tipps('Schau, welcher Wert in der Aufgabe auffällig zum Rillenabstand passt.', 'Der Abstand der Rillen entspricht der Strecke, die der Meißel pro Umdrehung zurücklegt.', 'Vergleiche vc mit dem Richtwert-Fenster der Tafel: vc passt, die Kühlung läuft.')
    };
  });
  fs('zer28', 2, 'Fehlersuche: Werkzeug glüht', function (r) {
    var d = r.pick([30, 40, 50]), n = r.pick([710, 1000, 1400]), v = C.vc(d, n);
    return {
      text: 'Fehlerkarte „Werkzeug glüht“: Beim Drehen von S235 mit einem HSS-Meißel (Ø ' + d + ' mm) färbt sich die Schneide blau, nach wenigen Minuten glüht sie dunkelrot, die Späne sind blau angelaufen. Eingestellt: n = ' + n + ' min⁻¹ (vc ≈ ' + F(v, 0) + ' m/min), f = 0,2 mm/U, ap = 1,5 mm, Kühlschmierstoff läuft reichlich. Was ist die wahrscheinlichste Ursache?',
      correct: 0,
      steps: ['vc = π · ' + d + ' · ' + n + ' / 1000 = ' + N(v) + ' m/min. Der Richtwert für HSS in Baustahl liegt etwa bei 20 bis 35 m/min.', 'Die Schnittgeschwindigkeit ist weit zu hoch, die Schneide überhitzt und verliert ihre Härte, trotz Kühlung.', 'Abhilfe: Drehzahl senken, bis vc im Fenster liegt (Stufe der Reihe wählen).'],
      tips: tipps('Rechne vc aus den angegebenen Werten.', 'Vergleiche dein vc mit dem Richtwert für HSS in Stahl (Tafel im Lab).', 'Die Kühlung läuft ja reichlich, also liegt es nicht daran.')
    };
  });
  fs('zer29', 2, 'Fehlersuche: Bohrer läuft blau an', function (r) {
    var d = r.pick([10, 12, 16]), n = Math.round(C.nFromVc(r.pick([90, 100, 110]), d) / 10) * 10, v = C.vc(d, n);
    return {
      text: 'Fehlerkarte „Bohrer läuft blau an“: Ein HSS-Spiralbohrer d = ' + d + ' mm kreischt beim Bohren in Stahl, die Spitze ist nach drei Löchern blau und stumpf. Eingestellt: n = ' + n + ' min⁻¹ (vc ≈ ' + F(v, 0) + ' m/min), f = 0,1 mm/U, Bohröl wird reichlich zugeführt. Was ist die wahrscheinlichste Ursache?',
      correct: 0,
      steps: ['vc = π · ' + d + ' · ' + n + ' / 1000 = ' + N(v) + ' m/min. Für HSS-Bohrer in Stahl sind etwa 20 bis 30 m/min üblich.', 'Die Drehzahl ist viel zu hoch gewählt: Die Spitze überhitzt und der Bohrer wird weich.', 'Abhilfe: Drehzahl aus vc = 20 bis 30 m/min berechnen, nicht „nach Gefühl“ einstellen.'],
      tips: tipps('Berechne die Schnittgeschwindigkeit des Bohrers.', 'Für HSS-Bohrer in Stahl liegt der Richtwert bei etwa 20 bis 30 m/min.', 'Bohröl wird zugeführt, die Kühlung kann es also nicht sein.')
    };
  });
  fs('zer30', 3, 'Fehlersuche: Aluminium schmiert', function (r) {
    var d = r.pick([30, 40, 50]), n = C.nearestSpeed([45, 63, 90, 125], C.nFromVc(12, d)), v = C.vc(d, n);
    return {
      text: 'Fehlerkarte „Aluminium schmiert“: Beim Drehen von Aluminium (Ø ' + d + ' mm, HSS-Meißel) verschweißt Material an der Schneide, die Oberfläche ist verschmiert und matt, die Späne sind kurz und klumpig. Eingestellt: n = ' + n + ' min⁻¹ (vc ≈ ' + F(v, 0) + ' m/min), f = 0,15 mm/U, Emulsion läuft reichlich. Was ist die wahrscheinlichste Ursache?',
      correct: 1,
      steps: ['vc = ' + N(v) + ' m/min. Der Richtwert für HSS in Aluminium liegt bei etwa 100 bis 180 m/min.', 'Bei zu niedriger Schnittgeschwindigkeit schweißt das weiche Material an der Schneide an (Aufbauschneide) und verschmiert die Fläche.', 'Abhilfe: Drehzahl deutlich erhöhen. Die Kühlung läuft schon, daran liegt es nicht.'],
      tips: tipps('Vergleiche die Schnittgeschwindigkeit mit dem Richtwert-Fenster für Aluminium.', 'Aluminium wird mit sehr hoher vc gedreht (Größenordnung 100 m/min und mehr bei HSS).', 'Die Emulsion läuft reichlich, die Kühlung ist es nicht.')
    };
  });
  fs('zer31', 2, 'Fehlersuche: Fräser bricht aus', function (r) {
    var fz = r.pick([0.3, 0.4, 0.5]), n = r.pick([3200, 3500]), v = C.vc(10, n);
    return {
      text: 'Fehlerkarte „Fräser bricht aus“: Ein HSS-Schaftfräser Ø 10 mm mit 3 Schneiden bricht beim Nuten in Aluminium die Schneiden aus, die Späne sind dick und gequetscht, die Maschine ruckelt. Eingestellt: n = ' + n + ' min⁻¹ (vc ≈ ' + F(v, 0) + ' m/min), Zahnvorschub fz = ' + N(fz) + ' mm, Emulsion läuft. Was ist die wahrscheinlichste Ursache?',
      correct: 2,
      steps: ['vc = ' + N(v) + ' m/min liegt im Fenster für HSS in Aluminium (etwa 100 bis 200 m/min), die Kühlung läuft.', 'Der Zahnvorschub fz = ' + N(fz) + ' mm ist für einen 10-mm-Fräser viel zu groß: Typische Werte liegen bei einigen Hundertstel bis wenigen Zehntel Millimeter, hier eher 0,05 bis 0,1 mm.', 'Jede Schneide muss einen zu dicken Span abnehmen, die Schneidkanten brechen aus. Abhilfe: vf verringern (fz kleiner wählen).'],
      tips: tipps('Rechne die Schnittgeschwindigkeit nach und prüfe die Kühlung.', 'vc passt zum Fenster. Welche Größe hängt dann noch an der einzelnen Schneide?', 'Der Zahnvorschub bestimmt die Dicke des Spans je Schneide. Hier sind es 0,3 mm und mehr bei einem kleinen Fräser.')
    };
  });
  def('zer32', 'praxis', 2, 'Serienfertigung: Zeit für den Auftrag', 'num', function (r) {
    var l = r.pick([80, 100, 120]), la = r.pick([2, 3]), lu = r.pick([1, 2]), f = r.pick([0.15, 0.2, 0.25]), n = r.pick([500, 710, 1000]), Z = r.pick([10, 20, 25, 30]), th = C.thDreh(l, la, lu, 1, f, n), s = th * Z;
    return {
      text: 'Von einer Welle (l = ' + l + ' mm) werden ' + Z + ' Stück in einem Schnitt gedreht. Anlauf ' + la + ' mm, Überlauf ' + lu + ' mm, f = ' + N(f) + ' mm/U, n = ' + n + ' min⁻¹. Wie groß ist die gesamte Hauptzeit für den Auftrag (ohne Rüst- und Nebenzeiten)?', unit: 'min', sol: s,
      steps: ['th je Stück = (l + la + lü) / (f · n) = ' + (l + la + lu) + ' / ' + N(C.vf(f, n)) + ' = ' + N(th) + ' min', 'Auftrag: ' + Z + ' · ' + N(th) + ' min = ' + N(s) + ' min (' + C.fmtZeit(s) + ')'],
      tips: tipps('Erst die Zeit für ein Teil, dann mal Stückzahl.', 'th = (l + la + lü) / (f · n), danach mal ' + Z + '.', 'Ein Teil braucht ' + N(th) + ' min.')
    };
  });
  def('zer33', 'praxis', 3, 'Tatsächliche vc nach der Stufenwahl', 'num', function (r) {
    var d = r.pick([30, 40, 50, 60]), v = r.pick([25, 30, 35]), ns = C.nFromVc(v, d), st = C.lowerSpeed(C.SERIES_STD, ns), s = C.vc(d, st);
    return {
      text: 'Ø ' + d + ' mm, HSS in Stahl, Richtwert vc = ' + v + ' m/min. Die Drehbank hat die Stufen ' + C.SERIES_STD.join(', ') + ' min⁻¹. Du wählst die nächstniedrigere Stufe unter der rechnerischen Drehzahl, damit der Richtwert nicht überschritten wird. Welche Schnittgeschwindigkeit liegt dann tatsächlich an?', unit: 'm/min', sol: s,
      steps: ['Soll-Drehzahl: n = ' + v + ' · 1000 / (π · ' + d + ') = ' + N(ns) + ' min⁻¹', 'Nächstniedrigere Stufe: ' + st + ' min⁻¹', 'vc = π · ' + d + ' · ' + st + ' / 1000 = ' + N(s) + ' m/min (Richtwert ' + v + ' m/min nicht überschritten)'],
      tips: tipps('Rechne zuerst die Soll-Drehzahl und suche dann die Stufe darunter.', 'n = vc · 1000 / (π · d), dann die Stufe wählen, die nicht größer ist. Mit dieser Stufe vc neu berechnen.', 'Die Soll-Drehzahl liegt bei etwa ' + F(ns, 0) + ' min⁻¹, die gewählte Stufe ist ' + st + ' min⁻¹.')
    };
  });
  def('zer34', 'praxis', 3, 'Reicht die Motorleistung?', 'num', function (r) {
    var ap = r.pick([2, 3, 4]), f = r.pick([0.2, 0.3]), m = r.pick(['s235', 'c45']), kc = C.kcOf(m), v = r.pick([100, 120, 150]), eta = r.pick([0.7, 0.8]), A = C.spanquerschnitt(ap, f), Fc = C.schnittkraft(A, kc), Pc = C.schnittleistung(Fc, v), s = C.motorleistung(Pc, eta);
    return {
      text: 'Schruppen von ' + C.MATERIALS[m].name + ' (kc = ' + kc + ' N/mm²): ap = ' + N(ap) + ' mm, f = ' + N(f) + ' mm/U, vc = ' + v + ' m/min. Der Gesamtwirkungsgrad der Maschine ist η = ' + N(eta) + '. Welche Motorleistung wird mindestens benötigt?', unit: 'kW', sol: s,
      steps: ['A = ap · f = ' + N(A) + ' mm²; Fc = A · kc = ' + N(Fc) + ' N', 'Pc = Fc · vc / 60 000 = ' + N(Pc) + ' kW (an der Schneide)', 'P_Motor = Pc / η = ' + N(Pc) + ' / ' + N(eta) + ' = ' + N(s) + ' kW'],
      tips: tipps('Erst die Leistung an der Schneide, dann die Verluste der Maschine einrechnen.', 'Pc = ap · f · kc · vc / 60 000. Der Motor muss mehr liefern: P = Pc / η.', 'Pc an der Schneide beträgt ' + N(Pc) + ' kW.')
    };
  });

  /* zusätzliche Fehlersuche-Karten, nur im Tab Fehlersuche (keine Aufgabe in der Liste) */
  fs('zerx1', 2, 'Fehlersuche: Platte verschleißt sofort', function (r) {
    var d = r.pick([40, 50]), n = r.pick([2800, 3200]), v = C.vc(d, n);
    return {
      text: 'Fehlerkarte „Platte verschleißt sofort“: Bei Ø ' + d + ' mm in C45 mit Hartmetall-Wendeplatte zeigt die Schneide schon nach zwei Minuten starken Freiflächenverschleiß und blaue Verfärbung, die Späne glühen. Eingestellt: n = ' + n + ' min⁻¹ (vc ≈ ' + F(v, 0) + ' m/min), f = 0,25 mm/U, ap = 2 mm, Kühlschmierstoff läuft. Was ist die wahrscheinlichste Ursache?',
      correct: 0,
      steps: ['vc = ' + N(v) + ' m/min. Für Hartmetall in Stahl liegt der Richtwert bei etwa 120 bis 220 m/min.', 'Die Schnittgeschwindigkeit ist weit über dem Fenster, die Schneide überhitzt und verschleißt in Minuten.', 'Abhilfe: Drehzahl senken, bis vc im Fenster liegt.'],
      tips: tipps('Rechne vc nach und vergleiche mit dem Richtwert-Fenster für Hartmetall in Stahl.', 'Das Fenster liegt bei 120 bis 220 m/min.')
    };
  }, true);
  fs('zerx2', 3, 'Fehlersuche: Aufbauschneide in Stahl', function (r) {
    var d = r.pick([30, 40]), n = r.pick([63, 90]), v = C.vc(d, n);
    return {
      text: 'Fehlerkarte „Aufbauschneide in Stahl“: Beim Drehen von S235 mit Hartmetall (Ø ' + d + ' mm) setzen sich Werkstoffreste an der Schneide fest, die Oberfläche ist schuppig und unrein. Eingestellt: n = ' + n + ' min⁻¹ (vc ≈ ' + F(v, 0) + ' m/min), f = 0,2 mm/U, ap = 1 mm, Emulsion läuft reichlich. Was ist die wahrscheinlichste Ursache?',
      correct: 1,
      steps: ['vc = ' + N(v) + ' m/min. Für Hartmetall in Stahl wären etwa 120 bis 220 m/min üblich.', 'Bei zu niedriger Schnittgeschwindigkeit verschweißt der Span mit der Schneide: Aufbauschneide, schuppige Fläche.', 'Abhilfe: Drehzahl erhöhen. Kühlung und Vorschub sind hier nicht das Problem.'],
      tips: tipps('Ist die Schnittgeschwindigkeit für Hartmetall hoch genug?', 'Hartmetall braucht deutlich mehr vc als HSS, Richtwert in Stahl etwa 120 bis 220 m/min.')
    };
  }, true);

  /* ====================== Aufbau, Schnittstelle ====================== */
  function build(id, seed) {
    var d = DEFS[id]; if (!d) return null;
    var key = id + '|' + (seed == null ? 0 : seed), r = C.rng(key), g = d.gen(r), o = { id: id, cat: d.cat, catName: CATS[d.cat], level: d.level, title: d.title, type: d.type, seed: seed == null ? 0 : seed };
    Object.keys(g).forEach(function (k) { o[k] = g[k]; });
    o.tol = g.tol == null ? 2 : g.tol;
    if (d.type === 'choice') {
      var idx = o.opts.map(function (_, i) { return i; }), order = g.keep ? idx : C.rng(key + '|opt').shuffle(idx);
      o.optsShown = order.map(function (i) { return o.opts[i]; });
      o.ans = order.indexOf(g.correct);
      o.sol = o.opts[g.correct];
    }
    return o;
  }
  var TASKS = ORDER.filter(function (id) { return !DEFS[id].extra; }).map(function (id) { var d = DEFS[id]; return { id: id, lab: 'zer', cat: CATS[d.cat], title: d.title, level: d.level }; });

  /* Beispiele (Reiter "Beispiele", Aufruf ?bsp): Parameter-Voreinstellungen für Drehen, Fräsen, Bohren.
     vc liegt jeweils im Richtwert-Fenster von zercore.js (VC_TAB). Vorschub, Zustellung und Zahnvorschub sind übliche Startwerte, Hersteller beachten. PRUEFEN */
  var BEISPIELE = [
    { id: 'zb1', sim: 'dreh', titel: 'Schruppen: Stahl S235, Hartmetall, Ø60', text: 'Hartmetall im Stahl-Fenster (120 bis 220 m/min), hier vc ≈ 151 m/min bei n = 800 min⁻¹. Schruppen: große Zustellung (3 mm) und kräftiger Vorschub.', set: { d: 60, l: 100, n: 800, f: 0.4, ap: 3, i: 3, la: 3, lu: 2, mat: 's235', cut: 'hm', fc: true } }, /* PRUEFEN: f und ap */
    { id: 'zb2', sim: 'dreh', titel: 'Schlichten: Aluminium, Hartmetall, Ø60', text: 'Aluminium verträgt hohe Schnittgeschwindigkeit (Fenster 250 bis 500 m/min): bei n = 2120 min⁻¹ ist vc ≈ 400 m/min. Schlichten: kleine Zustellung (0,3 mm) und feiner Vorschub (0,1 mm/U).', set: { d: 60, l: 100, n: 2120, f: 0.1, ap: 0.3, i: 1, la: 3, lu: 2, mat: 'alu', cut: 'hm', fc: true } }, /* PRUEFEN: f und ap */
    { id: 'zb3', sim: 'bohr', titel: 'Bohren: Ø10 mm HSS in Stahl', text: 'HSS-Bohrer im Stahl-Fenster (20 bis 30 m/min): vc = 25 m/min ergibt n ≈ 796 min⁻¹. Durchgangsbohrung 20 mm tief mit f = 0,15 mm/U.', set: { d: 10, vc: 25, f: 0.15, t: 20, durch: true, lu: 1, sigma: 118, gr: 'stahl', cut: 'hss' } },
    { id: 'zb4', sim: 'fraes', titel: 'Planfräsen: Stahl, Messerkopf Ø63, Hartmetall', text: 'Fräser Ø63 mm mit 5 Schneiden, vc = 150 m/min (Fenster 100 bis 200). Mit fz = 0,1 mm folgt der Vorschub vf = fz · z · n über die Drehzahl.', set: { d: 63, z: 5, vc: 150, fz: 0.1, l: 150, la: 5, lu: 5, gr: 'stahl', cut: 'hm' } }, /* PRUEFEN: fz */
    { id: 'zb5', sim: 'bohr', titel: 'Bohren: Ø8 mm HSS in Aluminium', text: 'Aluminium erlaubt mit HSS deutlich mehr als Stahl (Fenster 60 bis 100 m/min): vc = 80 m/min. Der kleinere Durchmesser braucht eine höhere Drehzahl.', set: { d: 8, vc: 80, f: 0.15, t: 16, durch: true, lu: 1, sigma: 118, gr: 'alu', cut: 'hss' } } /* PRUEFEN: f */
  ];
  root.ZER_BEISPIELE = BEISPIELE;
  root.ZER_DEFS = DEFS; root.ZER_ORDER = ORDER; root.ZER_CATS = CATS; root.ZER_CAT_KEYS = CAT_KEYS;
  root.ZER_BUILD = build;
  root.ZER_TASKS = TASKS;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ZER_BEISPIELE: BEISPIELE, ZER_TASKS: TASKS, ZER_DEFS: DEFS, ZER_ORDER: ORDER, ZER_CATS: CATS, ZER_CAT_KEYS: CAT_KEYS, ZER_BUILD: build };
})(typeof window !== 'undefined' ? window : globalThis);
