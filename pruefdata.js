'use strict';
/* Tonfunk Prüfungs-Lab: Aufgaben (Format für mkaufg.py: { id: 'x', lab: 'pr', cat: '…', title: '…', level: n …).
   pruefwerk.js ruft PR_DATA(W) auf (W = Zustand S und Hilfen). Jede Aufgabe hat check() und sol(); sol() setzt den Zustand so, dass die Prüfung 100 % ergibt (selftest.html). */
(function (root) {
  root.PR_DATA = function (W) {
    const RES = W.RES, T = root.PR_BANK.TOPICS;
    const best = k => (W.S.best && W.S.best[k]) || 0;
    const exams = () => (W.S.hist || []).filter(h => h.kind === 'exam');
    const topTask = (i, hint) => {
      const t = T[i];
      return { kind: 'pruef', go: 'training',
        text: 'Übe das Thema „' + t.t + '“ im Tab „Training“: zehn Fragen (Rechnen und Mehrfachwahl) mit sofortiger Erklärung. Die Aufgabe ist geschafft, wenn du in einem Durchgang mindestens 80 % richtig hast.',
        hint, topic: t.k,
        check: async () => [RES(best(t.k) >= 80, 'Bestes Ergebnis im Thema ' + t.t + ': ' + best(t.k) + ' % (verlangt: 80 %)', 'Gehe in den Tab „Training“, wähle das Thema und lies bei falschen Antworten die Erklärung. Rechenaufgaben: Einheit beachten.')],
        sol: () => { W.S.best = W.S.best || {}; W.S.best[t.k] = 90; } };
    };
    const TASKS = [
      { id: 'pr1', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Grundlagen Gleichstrom', level: 1, ...topTask(0, 'Formeln: U = R · I, P = U · I, Reihen- und Parallelschaltung. Bei Rechenaufgaben die Einheit aus der Aufgabe übernehmen (kΩ mal mA ergibt V).') },
      { id: 'pr2', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Bauelemente', level: 1, ...topTask(1, 'Denke an LED-Vorwiderstand, Farbcode, Kondensator- und Transistorrechnungen. Die Formeln stehen im Tab „Formeln“.') },
      { id: 'pr3', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Wechselstrom und Filter', level: 2, ...topTask(2, 'XC und XL hängen von der Frequenz ab, die Grenzfrequenz des RC-Gliedes ist fg = 1 / (2π · R · C). Der Effektivwert ist Û / √2.') },
      { id: 'pr4', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Digitaltechnik', level: 2, ...topTask(3, 'Binär, Hex, Gatter und Zähler. Eine Zweierpotenz-Tabelle (1, 2, 4, 8, 16, 32, 64, 128) hilft beim Umrechnen.') },
      { id: 'pr5', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Messtechnik', level: 2, ...topTask(4, 'Spannung wird parallel, Strom in Reihe gemessen. Beim Oszilloskop: Zeitbasis und Spannungsteilung mal Teilstriche.') },
      { id: 'pr6', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Stromversorgung', level: 2, ...topTask(5, 'Gleichrichter, Siebung, Linearregler (Verlustleistung = Spannungsdifferenz mal Strom) und Wirkungsgrad.') },
      { id: 'pr7', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Mikrocontroller', level: 2, ...topTask(6, 'PWM, Pull-up und Pull-down, Pegel und Baudrate. Bei 8N1 sind es 10 Bit je Zeichen.') },
      { id: 'pr8', lab: 'pr', cat: 'Stufe 1: Themen üben', title: 'Thema: Sicherheit und Normen', level: 1, ...topTask(7, 'Fünf Sicherheitsregeln in der richtigen Reihenfolge, ESD, Schutzklassen, FI und Erste Hilfe.') },
      { id: 'pr9', lab: 'pr', cat: 'Stufe 2: Rechnen', title: 'Rechenserie: zehn Aufgaben in Folge', level: 2, kind: 'pruef', go: 'training',
        text: 'Starte im Tab „Training“ die Rechenserie. Du bekommst immer neue Rechenaufgaben aus allen Themen. Die Aufgabe ist geschafft, wenn du zehn Aufgaben hintereinander richtig löst.',
        hint: 'Rechne mit der Einheit, die in der Frage steht. Rundungsabweichungen bis 2 % werden akzeptiert. Bei einer falschen Antwort beginnt die Serie von vorn.',
        check: async () => { const b = (W.S.streak && W.S.streak.best) || 0; return [RES(b >= 10, 'Längste Serie: ' + b + ' (verlangt: 10)', 'Lies bei falschen Antworten den Lösungsweg und merke dir die Formel. Im Tab „Formeln“ findest du alle wichtigen Formeln.')]; },
        sol: () => { W.S.streak = { cur: 10, best: 10 }; } },
      { id: 'pr10', lab: 'pr', cat: 'Stufe 3: Probeprüfung', title: 'Probeprüfung bestehen', level: 2, kind: 'pruef', go: 'pruefung',
        text: 'Mache eine Probeprüfung (20 Aufgaben, 60 Minuten) und erreiche mindestens 50 % der Punkte. Das ist die Bestehensgrenze bei den meisten Prüfungsteilen der Kammer (Note 4).',
        hint: 'Beginne mit den Aufgaben, die du sicher kannst, und gehe zum Schluss zu den schwierigen. Rechenaufgaben bringen mehr Punkte als Mehrfachwahl. Übe vorher die Themen.',
        check: async () => { const e = exams(), b = e.reduce((m, h) => Math.max(m, h.pct), 0); return [RES(e.length >= 1, e.length >= 1 ? 'Probeprüfung abgegeben' : 'Gib eine Probeprüfung ab'), RES(b >= 50, 'Bestes Ergebnis: ' + b + ' % (verlangt: 50 %)', 'Übe die schwächsten Themen im Tab „Auswertung“.')]; },
        sol: () => { W.S.hist = [{ kind: 'exam', t: 1, pct: 62, pts: 35, max: 56, note: 4, secs: 1800, topics: {} }]; } },
      { id: 'pr11', lab: 'pr', cat: 'Stufe 3: Probeprüfung', title: 'Probeprüfung: Note 2', level: 3, kind: 'pruef', go: 'pruefung',
        text: 'Erreiche in einer Probeprüfung mindestens 81 % der Punkte (Note 2, gut).',
        hint: 'Gehe nach der Auswertung in die schwächsten Themen und mache dort das Training mit 80 %. Wiederhole dann die Probeprüfung.',
        check: async () => { const b = exams().reduce((m, h) => Math.max(m, h.pct), 0); return [RES(b >= 81, 'Bestes Ergebnis: ' + b + ' % (verlangt: 81 %)', 'Schaue in der Auswertung, welche Themen noch schwächeln, und übe sie gezielt.')]; },
        sol: () => { W.S.hist = [{ kind: 'exam', t: 1, pct: 85, pts: 48, max: 56, note: 2, secs: 1800, topics: {} }]; } },
      { id: 'pr12', lab: 'pr', cat: 'Stufe 3: Probeprüfung', title: 'Probeprüfung: Note 1', level: 3, kind: 'pruef', go: 'pruefung',
        text: 'Erreiche in einer Probeprüfung mindestens 92 % der Punkte (Note 1, sehr gut).',
        hint: 'Rechenaufgaben sicher lösen und Einheiten prüfen. Lies jede Frage zweimal.',
        check: async () => { const b = exams().reduce((m, h) => Math.max(m, h.pct), 0); return [RES(b >= 92, 'Bestes Ergebnis: ' + b + ' % (verlangt: 92 %)', 'Übe die Rechenserie und die Themen mit den meisten Fehlern.')]; },
        sol: () => { W.S.hist = [{ kind: 'exam', t: 1, pct: 96, pts: 54, max: 56, note: 1, secs: 1800, topics: {} }]; } },
      { id: 'pr13', lab: 'pr', cat: 'Stufe 3: Probeprüfung', title: 'Besser werden: zwei Probeprüfungen im Vergleich', level: 2, kind: 'pruef', go: 'auswertung',
        text: 'Mache mindestens zwei Probeprüfungen. Die jüngste muss besser sein als die erste. Dazwischen übst du die Themen, in denen die erste Prüfung schwach war.',
        hint: 'Im Tab „Auswertung“ siehst du, welches Thema am schwächsten war. Übe es im Training und starte dann die nächste Probeprüfung.',
        check: async () => { const e = exams(), a = e[0], z = e[e.length - 1]; return [RES(e.length >= 2, e.length >= 2 ? 'Mindestens zwei Probeprüfungen abgegeben' : 'Bisher ' + e.length + ' Probeprüfung(en)'), RES(e.length >= 2 && z.pct > a.pct, e.length >= 2 ? 'Erste: ' + a.pct + ' %, letzte: ' + z.pct + ' %' : 'Vergleich fehlt noch', 'Die letzte Prüfung muss besser sein als die erste.')]; },
        sol: () => { W.S.hist = [{ kind: 'exam', t: 1, pct: 50, pts: 28, max: 56, note: 4, secs: 1800, topics: {} }, { kind: 'exam', t: 2, pct: 70, pts: 39, max: 56, note: 3, secs: 1800, topics: {} }]; } }
      ,
      { id: 'pr14', lab: 'pr', cat: 'Stufe 4: Prüfungsaufbau Teil 1 und Teil 2', title: 'Teil 1 nach Prüfungsaufbau bestehen', level: 3, kind: 'pruef', go: 'pruefung',
        text: 'Wähle in der Probeprüfung die Variante „Teil 1“: 23 gebundene Aufgaben (davon 3 abwählbar) und 8 Rechenaufgaben, 90 Minuten, Teil A und B je 50 %. Erreiche mindestens 50 %.',
        hint: 'Wähle in Teil A die drei Aufgaben ab, die dir am schwersten fallen (nicht abwählbare sind markiert). In Teil B gibt es nur Punkte für das richtige Endergebnis: rechne mit Einheiten.',
        check: async () => { const e = (W.S.hist || []).filter(h => h.v === 'teil1'), b = e.reduce((m, h) => Math.max(m, h.pct), 0); return [RES(e.length >= 1, e.length >= 1 ? 'Teil 1 abgegeben' : 'Gib eine Probeprüfung „Teil 1“ ab'), RES(b >= 50, 'Bestes Ergebnis Teil 1: ' + b + ' % (verlangt: 50 %)', 'Übe die Themen im Training und im Prüfungs-Pool.')]; },
        sol: () => { W.S.hist = [{ kind: 'exam', v: 'teil1', t: 1, pct: 62, pts: 100, max: 100, note: 4, secs: 3000, topics: {} }]; } },
      { id: 'pr15', lab: 'pr', cat: 'Stufe 4: Prüfungsaufbau Teil 1 und Teil 2', title: 'Teil 2 Systementwurf bestehen', level: 3, kind: 'pruef', go: 'pruefung',
        text: 'Wähle die Variante „Teil 2: Systementwurf“: 28 gebundene Aufgaben (davon 3 abwählbar) und 8 Rechenaufgaben, 105 Minuten. Erreiche mindestens 50 %.',
        hint: 'Typische Themen: Stromversorgung und Verlustleistung, Operationsverstärker, Bauteilersatz mit Datenblatt, SPS und GRAFCET, A/D-Wandlung. Übe sie im Prüfungs-Pool.',
        check: async () => { const e = (W.S.hist || []).filter(h => h.v === 'syse'), b = e.reduce((m, h) => Math.max(m, h.pct), 0); return [RES(e.length >= 1, e.length >= 1 ? 'Systementwurf abgegeben' : 'Gib eine Probeprüfung „Systementwurf“ ab'), RES(b >= 50, 'Bestes Ergebnis Systementwurf: ' + b + ' % (verlangt: 50 %)', 'Übe die schwächsten Themen im Prüfungs-Pool.')]; },
        sol: () => { W.S.hist = [{ kind: 'exam', v: 'syse', t: 1, pct: 60, pts: 100, max: 100, note: 4, secs: 3000, topics: {} }]; } },
      { id: 'pr16', lab: 'pr', cat: 'Stufe 4: Prüfungsaufbau Teil 1 und Teil 2', title: 'Teil 2 Funktions- und Systemanalyse bestehen', level: 3, kind: 'pruef', go: 'pruefung',
        text: 'Wähle die Variante „Teil 2: Funktions- und Systemanalyse“: 28 gebundene Aufgaben (davon 3 abwählbar) und 8 Rechenaufgaben, 105 Minuten. Erreiche mindestens 50 %.',
        hint: 'Typische Themen: Schaltungsanalyse, Operationsverstärker, Messtechnik, Bussysteme, Sensorik, Schutzbeschaltung. Übe sie im Prüfungs-Pool.',
        check: async () => { const e = (W.S.hist || []).filter(h => h.v === 'fusa'), b = e.reduce((m, h) => Math.max(m, h.pct), 0); return [RES(e.length >= 1, e.length >= 1 ? 'Funktions- und Systemanalyse abgegeben' : 'Gib eine Probeprüfung „Funktions- und Systemanalyse“ ab'), RES(b >= 50, 'Bestes Ergebnis: ' + b + ' % (verlangt: 50 %)', 'Übe die schwächsten Themen im Prüfungs-Pool.')]; },
        sol: () => { W.S.hist = [{ kind: 'exam', v: 'fusa', t: 1, pct: 58, pts: 100, max: 100, note: 4, secs: 3000, topics: {} }]; } }
    ];

    /* ---------- Formelsammlung ---------- */
    const FORMELN = [
      ['grund', [['Ohmsches Gesetz', 'U = R · I', 'Spannung, Widerstand, Strom'], ['Leistung', 'P = U · I = I² · R = U² / R', 'in Watt'], ['Reihenschaltung', 'Rges = R1 + R2 + …', 'Strom überall gleich'], ['Parallelschaltung', '1/Rges = 1/R1 + 1/R2 (zwei: R1 · R2 / (R1 + R2))', 'Spannung überall gleich'], ['Spannungsteiler', 'Ua = Ue · R2 / (R1 + R2)', 'unbelastet'], ['Energie', 'W = P · t', 'kWh = kW · h'], ['Widerstand eines Leiters', 'R = ρ · l / A', 'Kupfer: ρ ≈ 0,0178 Ω·mm²/m']]],
      ['bauteile', [['LED-Vorwiderstand', 'R = (Ub − Uf) / I', 'Uf rot ≈ 2 V, blau/weiß ≈ 3 V'], ['Ladung', 'Q = C · U', 'in Coulomb'], ['Zeitkonstante', 'τ = R · C', 'nach 5 τ ist ein Kondensator fast voll'], ['Energie im Kondensator', 'W = ½ · C · U²', ''], ['Basisstrom', 'IB = IC / B', 'zum Sättigen mehr nehmen'], ['OPV nichtinvertierend', 'V = 1 + Rf / Rg', ''], ['OPV invertierend', 'V = − Rf / Rg', '']]],
      ['wechsel', [['Frequenz und Periode', 'f = 1 / T', ''], ['Effektivwert (Sinus)', 'Ueff = Û / √2', '230 V → Û ≈ 325 V'], ['Kapazitiver Widerstand', 'XC = 1 / (2π · f · C)', 'sinkt mit f'], ['Induktiver Widerstand', 'XL = 2π · f · L', 'steigt mit f'], ['Grenzfrequenz RC', 'fg = 1 / (2π · R · C)', 'bei fg: −3 dB'], ['Resonanzfrequenz', 'f0 = 1 / (2π · √(L · C))', ''], ['Transformator', 'U1 / U2 = N1 / N2', 'ideal'], ['Leistungsfaktor', 'cos φ = P / S', 'Wirk- zu Scheinleistung']]],
      ['digital', [['Stellenwerte', '128, 64, 32, 16, 8, 4, 2, 1', 'binär'], ['Hexadezimal', '0 bis 9, A = 10 … F = 15', '0xFF = 255'], ['Zustände', '2ⁿ bei n Bit', ''], ['Auflösung ADC', 'LSB = Uref / 2ⁿ', ''], ['Zähler', 'fout = f / 2ⁿ', 'je Flipflop halbe Frequenz']]],
      ['messen', [['Abweichung', 'F = (Anzeige − Soll) / Soll', 'in Prozent'], ['Multimeter-Genauigkeit', '± (x % v. Mw + n Digit)', 'Digit = kleinste Stelle'], ['Oszilloskop Zeit', 'T = Teilungen · Zeitbasis; f = 1 / T', ''], ['Oszilloskop Spannung', 'U = Teilungen · V/Teilung · Tastkopffaktor', ''], ['Strom über Shunt', 'I = U / R', '']]],
      ['strom', [['Gleichrichtung Brücke', 'Û = Ueff · √2 − 2 · 0,7 V', ''], ['Brummspannung', 'ΔU = I / (f · C)', 'f = 100 Hz bei Brücke'], ['Verlustleistung Linearregler', 'PV = (Ue − Ua) · I', ''], ['Wirkungsgrad', 'η = Pab / Pzu', ''], ['Z-Diode Vorwiderstand', 'R = (Ub − Uz) / Iz', '']]],
      ['mcu', [['Tastgrad', 'Mittelwert = Tastgrad · Pegel', ''], ['Frequenz', 'f = 1 / (Einzeit + Auszeit)', ''], ['Baudrate', 'Zeichen/s = Baud / 10', '8N1'], ['Speicher', 'Bytes = Anzahl · Größe', 'int = 2 Byte (Uno)']]],
      ['sicher', [['Kurzschlussstrom', 'Ik = U / Z', 'Schleifenimpedanz'], ['Strom aus Leistung', 'I = P / U', ''], ['Sicherheitsregeln', '1 Freischalten, 2 gegen Wiedereinschalten sichern, 3 Spannungsfreiheit feststellen, 4 Erden und Kurzschließen, 5 Nachbarteile abdecken', ''], ['Kleinspannung', 'bis 50 V AC, 120 V DC', '']]]
    ];
    return { TASKS, FORMELN };
  };
})(window);
