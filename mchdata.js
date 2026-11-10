'use strict';
/* Tonfunk Mechanik-Lab: Daten (Aufgaben-Generatoren, Beispiele).
   ALLE Werkstoffkennwerte, Reibungszahlen, E-Module, Sicherheiten und Tabellenwerte sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Bauteile.
   window.MCH_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, evaluate, solAns, wrongAns, solText, pools }
   window.MCH_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'mch', Status in localStorage 'lm4.mch.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Frageformen (q.ask.type): 'choice' (Auswahl) und 'num' (Zahl mit Toleranz, Einheiten im Feld).
   Optionales q.fig: Skizze der GEGEBENEN Größen (Lasten, Winkel), nie der Ergebnisse (Verdeckte-Fehler-Prinzip).
   Aufgabentitel und -texte verraten weder das Ergebnis noch die Fehlerursache (neutrale Titel, die Fehlersuchen heißen "Fehlerbild A" bis "C").
   Die richtige Antwort steht nie im Seitentext: Sie entsteht erst beim Erzeugen der Aufgabe, Auswahlantworten werden gemischt, die Auswertung geschieht im Skript. */
(function (root) {
  const C = () => root.MCH_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Kräfte als Vektor', 'Hebel und Drehmoment', 'Träger und Auflager', 'Schwerpunkt', 'Reibung', 'Spannung und Dehnung', 'Pressung und Abscheren', 'Biegung und Sicherheit', 'Arbeit und Leistung', 'Fehlersuche'];
  const REL = 0.01;

  /* ---------- Frageformen ---------- */
  /* Zahl: dec = Nachkommastellen, auf die ein Mensch sinnvoll rundet; erlaubt sind 1 % Abweichung oder eine halbe letzte Stelle (der größere Wert) */
  const numQ = (text, value, unit, label, dec, expl, tips, tol) => ({ text, ask: { type: 'num', unit, label }, value, tol: tol != null ? tol : Math.max(REL * Math.abs(value), 0.5 * Math.pow(10, -dec) + 1e-9), expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const bmOf = (L, loads, a, b) => ({ L, a: a == null ? 0 : a, b: b == null ? L : b, loads });
  const KG = n => f(n, 0) + ' kg';

  /* ---------- Generatoren ---------- */
  const G = {
    /* Kraft als Vektor */
    gew: R => {
      const c = C();
      if (R() < 0.6) {
        const m = c.pick(R, [5, 8, 12, 20, 25, 40, 50, 75, 120, 250, 400]), v = c.weight(m);
        return numQ('Ein Bauteil hat eine Masse von ' + KG(m) + '. Wie groß ist seine Gewichtskraft?', v, 'N', 'Gewichtskraft G', 0,
          'G = m · g = ' + f(m, 0) + ' kg · 9,81 m/s² = ' + f(v, 1) + ' N.', ['Gewichtskraft ist Masse mal Fallbeschleunigung.', 'Rechne mit g = 9,81 m/s². Kilogramm sind keine Kraft.']);
      }
      const Gk = c.pick(R, [500, 1000, 1500, 2000, 3000, 5000]), v = Gk / c.G;
      return numQ('Ein Hebezeug trägt eine Last mit der Gewichtskraft ' + f(Gk, 0) + ' N. Welche Masse hat die Last?', v, 'kg', 'Masse m', 0,
        'm = G / g = ' + f(Gk, 0) + ' N / 9,81 m/s² = ' + f(v, 1) + ' kg.', ['Stelle G = m · g nach der Masse um.', 'Teile die Kraft durch 9,81.']);
    },
    zerl: R => {
      const c = C(), F = c.pick(R, [120, 150, 200, 250, 300, 400, 500, 600]), a = c.pick(R, [20, 25, 30, 35, 40, 50, 55, 60, 65]), hor = R() < 0.5, v = hor ? F * Math.cos(a * c.RAD) : F * Math.sin(a * c.RAD);
      return numQ('Eine Kraft von ' + f(F, 0) + ' N wirkt unter einem Winkel von ' + a + '° gegen die Waagerechte (nach rechts oben). Wie groß ist ihre ' + (hor ? 'waagerechte' : 'senkrechte') + ' Komponente?', v, 'N', hor ? 'Komponente Fx (waagerecht)' : 'Komponente Fy (senkrecht)', 0,
        (hor ? 'Fx = F · cos α = ' : 'Fy = F · sin α = ') + f(F, 0) + ' N · ' + (hor ? 'cos ' : 'sin ') + a + '° = ' + f(v, 1) + ' N.', ['Zeichne ein rechtwinkliges Kräftedreieck: F ist die Hypotenuse.', hor ? 'Die Komponente neben dem Winkel ist die Ankathete (Kosinus).' : 'Die Komponente gegenüber dem Winkel ist die Gegenkathete (Sinus).']);
    },
    resr: R => {
      const c = C();
      if (R() < 0.6) {
        const F1 = c.ri(R, 2, 15) * 10, F2 = c.ri(R, 2, 15) * 10, v = Math.hypot(F1, F2);
        return numQ('Zwei Kräfte greifen im selben Punkt an und stehen senkrecht aufeinander: F1 = ' + f(F1, 0) + ' N und F2 = ' + f(F2, 0) + ' N. Wie groß ist die Resultierende?', v, 'N', 'Resultierende R', 0,
          'R = √(F1² + F2²) = √(' + f(F1, 0) + '² + ' + f(F2, 0) + '²) N = ' + f(v, 1) + ' N.', ['Bei einem rechten Winkel bilden die Kräfte die Katheten eines Dreiecks.', 'Die Resultierende ist die Hypotenuse (Satz des Pythagoras).']);
      }
      const T = c.pick(R, [[3, 4, 5], [5, 12, 13], [8, 15, 17]]), k = c.pick(R, [10, 20, 30]), F1 = T[0] * k, Rv = T[2] * k, v = T[1] * k;
      return numQ('Die Resultierende zweier senkrecht aufeinander stehender Kräfte beträgt ' + f(Rv, 0) + ' N, die eine Kraft ist F1 = ' + f(F1, 0) + ' N. Wie groß ist die andere Kraft F2?', v, 'N', 'Kraft F2', 0,
        'F2 = √(R² − F1²) = √(' + f(Rv, 0) + '² − ' + f(F1, 0) + '²) N = ' + f(v, 1) + ' N.', ['Die Resultierende ist die Hypotenuse, F1 und F2 sind die Katheten.', 'Stelle den Satz des Pythagoras nach F2 um.']);
    },
    resg: R => {
      const c = C(), F1 = c.ri(R, 3, 12) * 10, F2 = c.ri(R, 3, 12) * 10, g = c.pick(R, [45, 60, 120, 135]), v = c.resMag(F1, F2, g);
      return numQ('Zwei Kräfte F1 = ' + f(F1, 0) + ' N und F2 = ' + f(F2, 0) + ' N greifen im selben Punkt an. Ihre Richtungen schließen einen Winkel von ' + g + '° ein. Wie groß ist die Resultierende?', v, 'N', 'Resultierende R', 0,
        'R = √(F1² + F2² + 2 · F1 · F2 · cos γ) = √(' + f(F1, 0) + '² + ' + f(F2, 0) + '² + 2 · ' + f(F1, 0) + ' · ' + f(F2, 0) + ' · cos ' + g + '°) N = ' + f(v, 1) + ' N. Je kleiner der Winkel zwischen den Kräften, desto größer die Resultierende.', ['Zeichne das Kräfteparallelogramm und nutze den Kosinussatz.', 'Der Winkel γ liegt zwischen den beiden Kraftrichtungen (nicht zwischen den Pfeilspitzen).']);
    },
    seil: R => {
      const c = C(), m = c.pick(R, [20, 40, 50, 80, 100, 150]), Gk = c.weight(m);
      if (R() < 0.5) {
        const a = c.pick(R, [30, 45, 60]), v = c.ropes(Gk, a, a).S1;
        return numQ('Eine Last von ' + KG(m) + ' hängt an zwei gleich langen Seilen, die symmetrisch jeweils ' + a + '° gegen die Waagerechte geneigt sind. Welche Kraft wirkt in einem Seil?', v, 'N', 'Seilkraft S', 0,
          'Die senkrechten Komponenten beider Seile tragen die Last: 2 · S · sin ' + a + '° = G = ' + f(Gk, 1) + ' N, also S = G / (2 · sin ' + a + '°) = ' + f(v, 1) + ' N. Je flacher die Seile hängen, desto größer wird die Seilkraft.', ['Die Last ist im Gleichgewicht mit den senkrechten Anteilen der Seilkräfte.', 'Beide Seile liefern denselben senkrechten Anteil S · sin α.']);
      }
      const a1 = c.pick(R, [30, 40, 50, 60]); let a2 = c.pick(R, [30, 40, 50, 60]); if (a2 === a1) a2 = a1 === 60 ? 30 : a1 + 10;
      const v = c.ropes(Gk, a1, a2).S1;
      return numQ('Eine Last von ' + KG(m) + ' hängt an zwei Seilen. Das linke Seil ist ' + a1 + ', das rechte ' + a2 + '° gegen die Waagerechte geneigt. Welche Kraft wirkt im linken Seil?', v, 'N', 'Seilkraft S1 (links)', 0,
        'Gleichgewicht waagerecht: S1 · cos ' + a1 + '° = S2 · cos ' + a2 + '°; senkrecht: S1 · sin ' + a1 + '° + S2 · sin ' + a2 + '° = G = ' + f(Gk, 1) + ' N. Daraus S1 = G · cos ' + a2 + '° / sin(' + a1 + '° + ' + a2 + '°) = ' + f(v, 1) + ' N.', ['Stelle zwei Gleichungen auf: Summe der waagerechten und Summe der senkrechten Kräfte gleich 0.', 'Die waagerechten Anteile beider Seile heben sich auf.']);
    },
    /* Hebel und Drehmoment */
    mom: R => {
      const c = C(), F = c.pick(R, [80, 120, 150, 200, 250, 300, 400]), l = c.pick(R, [150, 200, 250, 300, 400, 500, 600, 800]), v = F * l / 1000;
      return numQ('Ein Schraubenschlüssel wird am Ende mit ' + f(F, 0) + ' N senkrecht belastet. Der Abstand zwischen der Schraubenachse und dem Angriffspunkt der Kraft beträgt ' + f(l, 0) + ' mm. Welches Drehmoment entsteht?', v, 'Nm', 'Drehmoment M', 1,
        'M = F · l = ' + f(F, 0) + ' N · ' + f(l / 1000, 3) + ' m = ' + f(v, 1) + ' Nm. Millimeter werden vorher in Meter umgerechnet.', ['Drehmoment ist Kraft mal Hebelarm.', 'Der Hebelarm muss in Metern stehen, wenn das Ergebnis in Nm sein soll.']);
    },
    hebel: R => {
      const c = C(), F1 = c.pick(R, [100, 150, 200, 300, 400, 600]), l1 = c.pick(R, [100, 150, 200, 300, 400]), l2 = c.pick(R, [50, 100, 250, 400, 500, 600, 800]);
      if (R() < 0.55) {
        const v = F1 * l1 / l2, q = numQ('An einem zweiseitigen Hebel wirkt links im Abstand ' + f(l1, 0) + ' mm vom Drehpunkt eine Last von ' + f(F1, 0) + ' N. Rechts, im Abstand ' + f(l2, 0) + ' mm, greift die Haltekraft F2 an. Wie groß muss F2 für das Gleichgewicht sein?', v, 'N', 'Kraft F2', 0,
          'Momentengleichgewicht um den Drehpunkt: F1 · l1 = F2 · l2, also F2 = F1 · l1 / l2 = ' + f(F1, 0) + ' N · ' + f(l1, 0) + ' mm / ' + f(l2, 0) + ' mm = ' + f(v, 1) + ' N. Ein langer Hebelarm braucht weniger Kraft.', ['Linksdrehendes Moment = rechtsdrehendes Moment.', 'Die Einheiten der Hebelarme kürzen sich, beide in mm.']);
        q.fig = { type: 'lever', unit: 'mm', l: { F: F1, x: l1 }, r: { F: null, x: l2 } }; return q;
      }
      const F2 = c.pick(R, [50, 100, 120, 150, 200, 250]), v = F1 * l1 / F2, q = numQ('An einem zweiseitigen Hebel wirkt links im Abstand ' + f(l1, 0) + ' mm vom Drehpunkt eine Last von ' + f(F1, 0) + ' N. Rechts wirkt eine Kraft von ' + f(F2, 0) + ' N. In welchem Abstand vom Drehpunkt muss sie angreifen, damit der Hebel im Gleichgewicht ist?', v, 'mm', 'Hebelarm l2', 0,
        'F1 · l1 = F2 · l2, also l2 = F1 · l1 / F2 = ' + f(F1, 0) + ' N · ' + f(l1, 0) + ' mm / ' + f(F2, 0) + ' N = ' + f(v, 1) + ' mm.', ['Linksdrehendes Moment = rechtsdrehendes Moment.', 'Stelle F1 · l1 = F2 · l2 nach l2 um.']);
      q.fig = { type: 'lever', unit: 'mm', l: { F: F1, x: l1 }, r: { F: F2, x: null } }; return q;
    },
    /* PRUEFEN P21: Anzugsmomente von 60 bis 150 Nm, Hebelarme von 150 bis 750 mm und Handkräfte von etwa 120 bis 600 N sind Übungswerte. Passen die Größenordnungen zu euren Schraubenverbindungen und zur Werkstatt, und sollen bestimmte Schraubengrößen mit ihren Anzugsmomenten aus dem Tabellenbuch genannt werden? */
    schl: R => {
      const c = C();
      if (R() < 0.5) {
        const M = c.pick(R, [60, 80, 100, 120, 150]), l = c.pick(R, [250, 300, 400, 500]), v = M / l * 1000;
        return numQ('Eine Schraube soll mit ' + f(M, 0) + ' Nm angezogen werden. Der Schlüssel hat vom Schraubenkopf bis zum Griffpunkt einen Hebelarm von ' + f(l, 0) + ' mm. Mit welcher Handkraft muss gezogen werden?', v, 'N', 'Handkraft F', 0,
          'F = M / l = ' + f(M, 0) + ' Nm / ' + f(l / 1000, 3) + ' m = ' + f(v, 1) + ' N.', ['Stelle M = F · l nach der Kraft um.', 'Hebelarm in Meter umrechnen.']);
      }
      const M = c.pick(R, [60, 90, 120, 150]), F = c.pick(R, [200, 250, 300, 400]), v = M / F * 1000;
      return numQ('Eine Mutter braucht ein Anzugsmoment von ' + f(M, 0) + ' Nm. Du willst mit höchstens ' + f(F, 0) + ' N Handkraft ziehen. Wie lang muss der Hebelarm des Schlüssels mindestens sein?', v, 'mm', 'Hebelarm l', 0,
        'l = M / F = ' + f(M, 0) + ' Nm / ' + f(F, 0) + ' N = ' + f(M / F, 3) + ' m = ' + f(v, 0) + ' mm.', ['Stelle M = F · l nach l um.', 'Das Ergebnis kommt in Metern heraus; die Aufgabe will Millimeter.']);
    },
    wippe: R => {
      const c = C(); let it = 0, F1, l1, F2, l2, F3, l3;
      do {
        F3 = c.pick(R, [100, 150, 200]); l3 = c.pick(R, [60, 80, 100, 120]); F2 = c.pick(R, [100, 200, 300]); l2 = c.pick(R, [20, 30, 40]); l1 = c.pick(R, [40, 50, 60, 80, 100]);
        const MR = F2 * l2 + F3 * l3; F1 = MR / l1; it++;
      } while (it < 200 && (F1 !== Math.round(F1) || F1 > 800));
      const q = numQ('Ein gewichtsloser Balken ist in der Mitte gelagert. Links sitzt eine Last von ' + f(F1, 0) + ' N im Abstand ' + f(l1, 0) + ' cm vom Drehpunkt. Rechts liegen eine Last von ' + f(F2, 0) + ' N im Abstand ' + f(l2, 0) + ' cm und eine Last von ' + f(F3, 0) + ' N, deren Abstand gesucht ist. In welchem Abstand vom Drehpunkt muss die zweite Last liegen, damit der Balken waagerecht im Gleichgewicht ist?', l3, 'cm', 'Abstand der zweiten Last', 0,
        'Linksdrehend: ' + f(F1, 0) + ' · ' + f(l1, 0) + ' = ' + f(F1 * l1, 0) + ' Ncm. Rechtsdrehend: ' + f(F2, 0) + ' · ' + f(l2, 0) + ' + ' + f(F3, 0) + ' · x. Gleichsetzen: x = (' + f(F1 * l1, 0) + ' − ' + f(F2 * l2, 0) + ') / ' + f(F3, 0) + ' = ' + f(l3, 1) + ' cm.', ['Summe aller Momente um den Drehpunkt gleich 0.', 'Die rechte Seite hat zwei Momente; das gesuchte kommt von der zweiten Last.']);
      q.fig = { type: 'lever', unit: 'cm', l: { F: F1, x: l1 }, r: { F: F2, x: l2 }, r2: { F: F3, x: null } }; return q;
    },
    hebelL: R => {
      const c = C(); let F1, F2, l1, l2, it = 0;
      do { F2 = c.pick(R, [100, 150, 200, 250, 300, 400]); l2 = c.pick(R, [40, 60, 80, 100, 120]); l1 = c.pick(R, [10, 20, 25, 30, 40]); F1 = F2 * l2 / l1; it++; } while (it < 200 && (F1 !== Math.round(F1) || F1 > 2500));
      const v = F1 + F2, q = numQ('Ein gewichtsloser Hebel ist an einem Drehpunkt gelagert und im Gleichgewicht. Links wirkt im Abstand ' + f(l1, 0) + ' cm die Last ' + f(F1, 0) + ' N, rechts im Abstand ' + f(l2, 0) + ' cm eine Haltekraft (beide nach unten). Welche Kraft muss das Lager am Drehpunkt aufnehmen?', v, 'N', 'Lagerkraft', 0,
        'Zuerst die Haltekraft: F2 = F1 · l1 / l2 = ' + f(F1, 0) + ' · ' + f(l1, 0) + ' / ' + f(l2, 0) + ' = ' + f(F2, 1) + ' N. Das Lager hält beide Kräfte: F1 + F2 = ' + f(v, 1) + ' N (Summe der Kräfte gleich 0).', ['Das Lager muss mehr tragen als die Last allein.', 'Erst F2 aus dem Momentengleichgewicht, dann die Kräfte senkrecht addieren.']);
      q.fig = { type: 'lever', unit: 'cm', l: { F: F1, x: l1 }, r: { F: null, x: l2 } }; return q;
    },
    /* Träger und Auflager */
    tr1: R => {
      const c = C(), L = c.pick(R, [2, 3, 4, 5, 6]), F = c.pick(R, [800, 1000, 2000, 3000, 4000, 6000]), bm = bmOf(L, [{ t: 'F', F, x: L / 2 }]);
      const q = numQ('Ein Träger liegt auf zwei Stützen mit ' + f(L, 0) + ' m Abstand. In der Mitte wirkt eine Einzellast von ' + f(F, 0) + ' N (Eigengewicht des Trägers wird nicht beachtet). Wie groß ist die Kraft an der linken Stütze?', F / 2, 'N', 'Auflagerkraft FA', 0,
        'Die Last steht mittig, beide Stützen teilen sie sich: FA = FB = F / 2 = ' + f(F / 2, 1) + ' N.', ['Wo steht die Last? Dann ist die Aufteilung leicht.', 'Die Summe beider Auflagerkräfte ist gleich der Last.']);
      q.fig = { type: 'beam', bm }; return q;
    },
    tr2: R => {
      const c = C(), L = c.pick(R, [4, 5, 6, 8]); let a; do { a = c.ri(R, 1, L - 1); } while (a * 2 === L);
      const F = c.pick(R, [1000, 1500, 2000, 3000]), bm = bmOf(L, [{ t: 'F', F, x: a }]), r = c.reactions(bm), left = R() < 0.5, v = left ? r.FA : r.FB;
      const q = numQ('Ein Träger liegt auf zwei Stützen A (links) und B (rechts) mit ' + f(L, 0) + ' m Abstand. Eine Einzellast von ' + f(F, 0) + ' N steht ' + f(a, 0) + ' m rechts von Stütze A. Wie groß ist die Kraft an Stütze ' + (left ? 'A' : 'B') + '?', v, 'N', 'Auflagerkraft ' + (left ? 'FA' : 'FB'), 0,
        'Momentengleichgewicht um A: FB · ' + f(L, 0) + ' m = ' + f(F, 0) + ' N · ' + f(a, 0) + ' m, also FB = ' + f(r.FB, 1) + ' N. Dann FA = F − FB = ' + f(r.FA, 1) + ' N. Die näher stehende Stütze trägt mehr.', ['Lege den Drehpunkt in eine Stütze, dann fällt deren Kraft aus der Rechnung.', 'Probe: FA + FB muss gleich F sein.']);
      q.fig = { type: 'beam', bm }; return q;
    },
    tr3: R => {
      const c = C(), L = c.pick(R, [3, 4, 5, 6]), qq = c.pick(R, [200, 300, 400, 500, 800]), bm = bmOf(L, [{ t: 'q', q: qq, x1: 0, x2: L }]);
      const t = numQ('Auf einen Träger mit ' + f(L, 0) + ' m Stützweite wirkt über die ganze Länge eine gleichmäßige Streckenlast von ' + f(qq, 0) + ' N/m. Wie groß ist die Kraft an einer der beiden Stützen?', qq * L / 2, 'N', 'Auflagerkraft', 0,
        'Gesamtlast Q = q · L = ' + f(qq, 0) + ' N/m · ' + f(L, 0) + ' m = ' + f(qq * L, 0) + ' N. Sie wirkt in der Mitte, die Stützen teilen sich die Last: ' + f(qq * L, 0) + ' N / 2 = ' + f(qq * L / 2, 1) + ' N.', ['Ersetze die Streckenlast durch eine Einzellast in ihrer Mitte.', 'Gesamtlast = Streckenlast mal belastete Länge.']);
      t.fig = { type: 'beam', bm }; return t;
    },
    tr4: R => {
      const c = C(), L = c.pick(R, [4, 5, 6, 8]); let x1 = c.ri(R, 1, L - 2), x2 = c.ri(R, x1 + 1, L - 1);
      const F1 = c.pick(R, [500, 1000, 1500, 2000]), F2 = c.pick(R, [500, 1000, 1500, 2000]), bm = bmOf(L, [{ t: 'F', F: F1, x: x1 }, { t: 'F', F: F2, x: x2 }]), r = c.reactions(bm), left = R() < 0.5;
      const q = numQ('Ein Träger liegt auf zwei Stützen A und B im Abstand ' + f(L, 0) + ' m. Von A aus wirken ' + f(F1, 0) + ' N im Abstand ' + f(x1, 0) + ' m und ' + f(F2, 0) + ' N im Abstand ' + f(x2, 0) + ' m. Wie groß ist die Kraft an Stütze ' + (left ? 'A' : 'B') + '?', left ? r.FA : r.FB, 'N', 'Auflagerkraft ' + (left ? 'FA' : 'FB'), 0,
        'Moment um A: FB · ' + f(L, 0) + ' = ' + f(F1, 0) + ' · ' + f(x1, 0) + ' + ' + f(F2, 0) + ' · ' + f(x2, 0) + ' = ' + f(F1 * x1 + F2 * x2, 0) + ' Nm, also FB = ' + f(r.FB, 1) + ' N. FA = ' + f(F1 + F2, 0) + ' N − FB = ' + f(r.FA, 1) + ' N.', ['Summe der Momente um eine Stütze gleich 0.', 'Jede Last liefert ein Moment: Kraft mal Abstand von dieser Stütze.']);
      q.fig = { type: 'beam', bm }; return q;
    },
    /* PRUEFEN P22: Die Trägeraufgaben verwenden ganze Meter, runde Lasten und Lager an den Trägerenden (tr1 bis tr5); Überstände (Kragarm) und mehrere Streckenlasten kommen nicht vor. Soll der Träger mit Überstand geübt werden, und genügt die Beschränkung auf senkrechte Lasten? */
    tr5: R => {
      const c = C(), L = c.pick(R, [4, 5, 6]), x1 = c.ri(R, 0, L - 3), x2 = c.ri(R, x1 + 2, L), qq = c.pick(R, [300, 400, 500, 800]), xf = c.ri(R, 1, L - 1), F = c.pick(R, [500, 1000, 1500, 2000]);
      const bm = bmOf(L, [{ t: 'q', q: qq, x1, x2 }, { t: 'F', F, x: xf }]), r = c.reactions(bm), Q = qq * (x2 - x1);
      const t = numQ('Ein Träger liegt auf zwei Stützen A (links) und B (rechts) im Abstand ' + f(L, 0) + ' m. Eine Streckenlast von ' + f(qq, 0) + ' N/m wirkt zwischen ' + f(x1, 0) + ' m und ' + f(x2, 0) + ' m (von A gemessen), außerdem steht bei ' + f(xf, 0) + ' m eine Einzellast von ' + f(F, 0) + ' N. Wie groß ist die Kraft an Stütze B?', r.FB, 'N', 'Auflagerkraft FB', 0,
        'Streckenlast als Einzelkraft: Q = ' + f(qq, 0) + ' · ' + f(x2 - x1, 0) + ' = ' + f(Q, 0) + ' N bei ' + f((x1 + x2) / 2, 1) + ' m. Moment um A: FB · ' + f(L, 0) + ' = ' + f(Q, 0) + ' · ' + f((x1 + x2) / 2, 1) + ' + ' + f(F, 0) + ' · ' + f(xf, 0) + ' = ' + f(Q * (x1 + x2) / 2 + F * xf, 1) + ' Nm, also FB = ' + f(r.FB, 1) + ' N. Probe: FA = ' + f(r.FA, 1) + ' N, zusammen ' + f(r.sum, 0) + ' N.', ['Die Streckenlast wird zu einer Kraft in der Mitte ihres belasteten Stücks.', 'Moment um Stütze A aufstellen, dann FB ausrechnen.']);
      t.fig = { type: 'beam', bm }; return t;
    },
    /* Schwerpunkt */
    sp0: R => {
      const c = C(), b = c.pick(R, [60, 80, 90, 120]), h = c.pick(R, [30, 45, 60, 90, 120]);
      return numQ('Ein dreieckiges Blech hat die Grundlinie ' + f(b, 0) + ' mm und die Höhe ' + f(h, 0) + ' mm. Wie weit liegt sein Schwerpunkt von der Grundlinie entfernt?', h / 3, 'mm', 'Abstand von der Grundlinie', 0,
        'Der Schwerpunkt eines Dreiecks liegt im Drittel der Höhe, von der Grundlinie aus gemessen: h / 3 = ' + f(h, 0) + ' mm / 3 = ' + f(h / 3, 1) + ' mm. Die Breite spielt dafür keine Rolle.', ['Der Schwerpunkt liegt auf einer Schwerlinie, im Dreieck bei einem festen Bruchteil der Höhe.', 'Es ist weniger als die halbe Höhe.']);
    },
    sp1: R => {
      const c = C(), B = c.pick(R, [60, 80, 100]), t1 = c.pick(R, [10, 12, 15, 20]), t2 = c.pick(R, [10, 12, 15, 20]), H = c.pick(R, [40, 50, 60, 80]);
      const p1 = c.rectPart(B, t1, 0, 0), p2 = c.rectPart(t2, H, 0, t1), s = c.centroid([p1, p2]);
      return numQ('Ein L-Profil entsteht aus zwei Rechtecken: Die Grundplatte ist ' + f(B, 0) + ' mm breit und ' + f(t1, 0) + ' mm hoch. Darauf steht bündig am linken Rand ein Steg von ' + f(t2, 0) + ' mm Breite und ' + f(H, 0) + ' mm Höhe. Wie weit liegt der Schwerpunkt der gesamten Fläche über der Unterkante der Grundplatte?', s.y, 'mm', 'Schwerpunktabstand ys', 0,
        'Teilflächen: A1 = ' + f(p1.A, 0) + ' mm² mit y1 = ' + f(p1.y, 1) + ' mm, A2 = ' + f(p2.A, 0) + ' mm² mit y2 = ' + f(p2.y, 1) + ' mm. ys = (A1 · y1 + A2 · y2) / (A1 + A2) = ' + f(p1.A * p1.y + p2.A * p2.y, 0) + ' / ' + f(s.A, 0) + ' = ' + f(s.y, 1) + ' mm.', ['Zerlege die Fläche in zwei Rechtecke und bestimme für jedes den Abstand seines Mittelpunkts zur Unterkante.', 'Gewichte die Abstände mit den Flächen.']);
    },
    sp2: R => {
      const c = C(), Lp = c.pick(R, [200, 240, 300]), h = c.pick(R, [100, 120]), d = c.pick(R, [30, 40, 50]), e = c.pick(R, [50, 60, 80]), A = Lp * h, Ah = c.areaCirc(d), v = Ah * e / (A - Ah);
      return numQ('Eine Rechteckplatte (' + f(Lp, 0) + ' mm × ' + f(h, 0) + ' mm) hat eine Bohrung mit ' + f(d, 0) + ' mm Durchmesser. Der Bohrungsmittelpunkt liegt ' + f(e, 0) + ' mm neben dem Plattenmittelpunkt auf der Längsachse. Um wie viel mm liegt der Schwerpunkt der gelochten Platte neben dem Plattenmittelpunkt (auf der anderen Seite der Bohrung)?', v, 'mm', 'Verschiebung des Schwerpunkts', 1,
        'Die Bohrung zählt als negative Fläche: x_s = (A_Platte · 0 − A_Loch · e) / (A_Platte − A_Loch). A_Platte = ' + f(A, 0) + ' mm², A_Loch = ' + f(Ah, 1) + ' mm². Betrag: ' + f(Ah, 1) + ' · ' + f(e, 0) + ' / ' + f(A - Ah, 1) + ' = ' + f(v, 2) + ' mm. Der Schwerpunkt wandert vom Loch weg.', ['Behandle die Bohrung wie eine Fläche mit negativem Vorzeichen.', 'Bezugspunkt ist der Plattenmittelpunkt, dort liegt der Schwerpunkt der vollen Platte.']);
    },
    /* Reibung */
    rb1: R => {
      const c = C(), mt = c.pick(R, c.MU), m = c.pick(R, [20, 50, 80, 120, 200]), v = mt.mu0 * c.weight(m);
      return numQ('Ein Werkstück (' + KG(m) + ') liegt waagerecht auf einer Unterlage. Material: ' + mt.n + ', Haftreibungszahl μ0 = ' + f(mt.mu0, 2) + '. Wie groß ist die größte Kraft, die es parallel zur Unterlage aushält, ohne in Bewegung zu kommen?', v, 'N', 'Größte Haftreibungskraft', 0,
        'Normalkraft = Gewichtskraft = ' + f(m, 0) + ' kg · 9,81 m/s² = ' + f(c.weight(m), 1) + ' N. FR0 = μ0 · FN = ' + f(mt.mu0, 2) + ' · ' + f(c.weight(m), 1) + ' N = ' + f(v, 1) + ' N.', ['Reibkraft = Reibungszahl mal Normalkraft.', 'Auf einer waagerechten Fläche ist die Normalkraft gleich der Gewichtskraft.']);
    },
    rb2: R => {
      const c = C(), mt = c.pick(R, c.MU), m = c.pick(R, [30, 50, 80, 150, 250]), v = mt.mu * c.weight(m);
      return numQ('Ein Wagen mit ' + KG(m) + ' Gesamtmasse wird auf einer waagerechten Bahn mit gleichbleibender Geschwindigkeit geschoben (' + mt.n + ', Gleitreibungszahl μ = ' + f(mt.mu, 2) + '). Welche waagerechte Kraft ist dafür nötig?', v, 'N', 'Schubkraft', 0,
        'Bei konstanter Geschwindigkeit ist die Schubkraft gleich der Gleitreibungskraft: F = μ · m · g = ' + f(mt.mu, 2) + ' · ' + f(m, 0) + ' kg · 9,81 m/s² = ' + f(v, 1) + ' N.', ['Gleichförmige Bewegung bedeutet: Kräfte im Gleichgewicht.', 'Hier gilt die Gleitreibungszahl, nicht die Haftreibungszahl.']);
    },
    rb3: R => {
      const c = C(), m = c.pick(R, [20, 40, 60, 100, 150]), a = c.pick(R, [10, 15, 20, 25, 30, 35]), Gk = c.weight(m), hang = R() < 0.55, v = hang ? c.incFH(Gk, a) : c.incFN(Gk, a);
      const q = numQ('Ein Körper von ' + KG(m) + ' liegt auf einer schiefen Ebene mit ' + a + '° Neigung. Wie groß ist die ' + (hang ? 'Hangabtriebskraft (Kraftanteil parallel zur Ebene)' : 'Normalkraft (Kraftanteil senkrecht zur Ebene)') + '?', v, 'N', hang ? 'Hangabtrieb FH' : 'Normalkraft FN', 0,
        'G = ' + f(m, 0) + ' kg · 9,81 m/s² = ' + f(Gk, 1) + ' N. ' + (hang ? 'FH = G · sin α = ' + f(Gk, 1) + ' N · sin ' + a + '° = ' + f(v, 1) + ' N.' : 'FN = G · cos α = ' + f(Gk, 1) + ' N · cos ' + a + '° = ' + f(v, 1) + ' N.'), ['Zerlege die Gewichtskraft in einen Anteil entlang der Ebene und einen senkrecht dazu.', hang ? 'Der Anteil entlang der Ebene wächst mit dem Winkel (Sinus).' : 'Der Anteil senkrecht zur Ebene wird mit steilerem Winkel kleiner (Kosinus).']);
      q.fig = { type: 'ramp', alpha: a }; return q;
    },
    rb4: R => {
      const c = C(), mt = c.pick(R, c.MU), m = c.pick(R, [10, 20, 40]), Gk = c.weight(m), cr = c.critAngle(mt.mu0);
      for (let tries = 0; tries < 60; tries++) {
        const a = c.ri(R, 4, 55); if (Math.abs(a - cr) < 4) continue;
        const o = (fh, fr) => (fh > fr ? 'Er rutscht' : 'Er bleibt liegen') + ': Hangabtrieb ' + f(fh, 0) + ' N, größte Haftreibung ' + f(fr, 0) + ' N';
        const right = o(c.incFH(Gk, a), mt.mu0 * c.incFN(Gk, a)), wrong = [o(c.incFN(Gk, a), mt.mu0 * c.incFH(Gk, a)), o(c.incFH(Gk, a), mt.mu0 * Gk), o(m * Math.sin(a * c.RAD), mt.mu0 * m * Math.cos(a * c.RAD))];
        if (new Set([right].concat(wrong)).size !== 4) continue;
        const q = choiceQ(R, 'Ein Werkstück von ' + KG(m) + ' liegt auf einer schiefen Ebene mit ' + a + '° Neigung (' + mt.n + ', Haftreibungszahl μ0 = ' + f(mt.mu0, 2) + '). Welche Aussage mit der richtigen Rechnung trifft zu?', right, wrong,
          'Hangabtrieb FH = G · sin α = ' + f(c.incFH(Gk, a), 1) + ' N. Größte Haftreibung FR0 = μ0 · G · cos α = ' + f(mt.mu0 * c.incFN(Gk, a), 1) + ' N. ' + (c.incFH(Gk, a) > mt.mu0 * c.incFN(Gk, a) ? 'Der Hangabtrieb ist größer, das Werkstück rutscht (tan ' + a + '° = ' + f(Math.tan(a * c.RAD), 2) + ' > μ0).' : 'Die Haftreibung reicht, das Werkstück bleibt liegen (tan ' + a + '° = ' + f(Math.tan(a * c.RAD), 2) + ' ≤ μ0).'),
          ['Vergleiche Hangabtrieb (G · sin α) mit der größten Haftreibung (μ0 · G · cos α).', 'Für die Normalkraft auf der Ebene gilt der Kosinus, nicht die ganze Gewichtskraft.']);
        q.fig = { type: 'ramp', alpha: a }; return q;
      }
      const q = choiceQ(R, 'Ein Werkstück liegt auf einer Ebene mit 30° Neigung (μ0 = 0,15).', 'Er rutscht: Hangabtrieb 49 N, größte Haftreibung 13 N', ['Er bleibt liegen: Hangabtrieb 49 N, größte Haftreibung 130 N', 'Er rutscht: Hangabtrieb 13 N, größte Haftreibung 49 N', 'Er bleibt liegen: Hangabtrieb 13 N, größte Haftreibung 49 N'], 'Hangabtrieb G · sin α, größte Haftreibung μ0 · G · cos α.', ['Vergleiche beide Kräfte.', 'Sinus und Kosinus nicht verwechseln.']); return q;
    },
    rb5: R => {
      const c = C(), mt = c.pick(R, c.MU), v = c.critAngle(mt.mu0);
      return numQ('Ein Körper liegt auf einer schiefen Ebene (' + mt.n + ', Haftreibungszahl μ0 = ' + f(mt.mu0, 2) + '). Die Ebene wird langsam steiler gestellt. Bei welchem Neigungswinkel beginnt der Körper zu rutschen?', v, '°', 'Grenzwinkel', 0,
        'Im Grenzfall ist der Hangabtrieb gleich der größten Haftreibung: G · sin α = μ0 · G · cos α, also tan α = μ0 und α = arctan ' + f(mt.mu0, 2) + ' = ' + f(v, 1) + '°. Die Masse spielt keine Rolle.', ['Im Grenzfall sind Hangabtrieb und größte Haftreibung gleich groß.', 'G kürzt sich heraus; es bleibt ein Zusammenhang zwischen dem Winkel und μ0.'], 0.5);
    },
    rb6: R => {
      const c = C(), m = c.pick(R, [50, 80, 100, 150, 200]), a = c.pick(R, [10, 15, 20, 25, 30]), mt = c.pick(R, c.MU.filter(x => x.id !== 'gb' && x.id !== 'bs')), Gk = c.weight(m), v = c.rampUp(Gk, a, mt.mu);
      const q = numQ('Ein Wagen von ' + KG(m) + ' soll mit gleichbleibender Geschwindigkeit eine Rampe mit ' + a + '° Neigung hinaufgezogen werden (' + mt.n + ', Gleitreibungszahl μ = ' + f(mt.mu, 2) + '). Die Zugkraft wirkt parallel zur Rampe. Wie groß ist sie?', v, 'N', 'Zugkraft F', 0,
        'Die Zugkraft muss den Hangabtrieb und die Gleitreibung überwinden: F = G · sin α + μ · G · cos α = ' + f(Gk, 1) + ' N · (sin ' + a + '° + ' + f(mt.mu, 2) + ' · cos ' + a + '°) = ' + f(c.incFH(Gk, a), 1) + ' N + ' + f(mt.mu * c.incFN(Gk, a), 1) + ' N = ' + f(v, 1) + ' N.', ['Nach oben wirken Hangabtrieb und Reibung beide gegen die Bewegung.', 'Die Reibkraft nutzt die Normalkraft G · cos α.']);
      q.fig = { type: 'ramp', alpha: a }; return q;
    },
    /* Spannung und Dehnung */
    zs1: R => {
      const c = C(), F = c.pick(R, [5000, 8000, 10000, 15000, 20000, 30000]);
      if (R() < 0.6) {
        const d = c.pick(R, [8, 10, 12, 16, 20]), A = c.areaCirc(d), v = F / A;
        return numQ('Ein Rundstab mit ' + f(d, 0) + ' mm Durchmesser wird mit ' + f(F, 0) + ' N auf Zug belastet. Wie groß ist die Zugspannung im Stab?', v, 'N/mm²', 'Zugspannung σ', 0,
          'A = π · d² / 4 = π · ' + f(d, 0) + '² / 4 mm² = ' + f(A, 1) + ' mm². σ = F / A = ' + f(F, 0) + ' N / ' + f(A, 1) + ' mm² = ' + f(v, 1) + ' N/mm².', ['Spannung ist Kraft durch Fläche.', 'Die Fläche eines Kreises ist π mal Durchmesser zum Quadrat durch 4.']);
      }
      const b = c.pick(R, [10, 15, 20, 30]), h = c.pick(R, [5, 8, 10, 12]), A = b * h, v = F / A;
      return numQ('Ein Flachstab (' + f(b, 0) + ' mm breit, ' + f(h, 0) + ' mm dick) wird mit ' + f(F, 0) + ' N auf Zug belastet. Wie groß ist die Zugspannung im Stab?', v, 'N/mm²', 'Zugspannung σ', 0,
        'A = b · h = ' + f(b, 0) + ' mm · ' + f(h, 0) + ' mm = ' + f(A, 0) + ' mm². σ = F / A = ' + f(F, 0) + ' N / ' + f(A, 0) + ' mm² = ' + f(v, 1) + ' N/mm².', ['Spannung ist Kraft durch Fläche.', 'Die Querschnittsfläche eines Rechtecks ist Breite mal Dicke.']);
    },
    zs2: R => {
      const c = C(), F = c.pick(R, [10000, 20000, 30000, 40000, 60000]), sz = c.pick(R, [60, 80, 100, 120, 140, 160]), d = c.diaOfArea(F / sz);
      return numQ('Eine Zugstange soll ' + f(F, 0) + ' N tragen. Als zulässige Spannung sind ' + f(sz, 0) + ' N/mm² vorgegeben. Welchen Durchmesser muss ein Rundstab mindestens haben?', d, 'mm', 'Mindestdurchmesser d', 1,
        'Erforderliche Fläche A = F / σzul = ' + f(F, 0) + ' N / ' + f(sz, 0) + ' N/mm² = ' + f(F / sz, 1) + ' mm². Aus A = π · d² / 4 folgt d = √(4 · A / π) = ' + f(d, 2) + ' mm. Im Alltag wird auf die nächste Normgröße aufgerundet.', ['Berechne zuerst die Fläche, die gebraucht wird.', 'Stelle die Kreisformel nach d um.']);
    },
    zs3: R => {
      const c = C();
      if (R() < 0.5) {
        const L = c.pick(R, [100, 200, 250, 400, 500]), dl = c.pick(R, [0.05, 0.1, 0.15, 0.2, 0.25, 0.4]), v = dl / L * 100;
        return numQ('Ein Messstab mit ' + f(L, 0) + ' mm Ausgangslänge verlängert sich unter Last um ' + f(dl, 2) + ' mm. Wie groß ist die Dehnung in Prozent?', v, '%', 'Dehnung ε', 3,
          'ε = ΔL / L0 = ' + f(dl, 2) + ' mm / ' + f(L, 0) + ' mm = ' + f(dl / L, 5) + ', das sind ' + f(v, 3) + ' %.', ['Dehnung ist die Verlängerung im Verhältnis zur Ausgangslänge.', 'Für Prozent mit 100 malnehmen.']);
      }
      const mt = c.pick(R, c.MAT.filter(m => m.id === 's235' || m.id === 'alu')), sg = c.pick(R, [60, 80, 100, 120, 140]), v = sg / mt.E * 100;
      return numQ('In einem Stab aus ' + mt.n + ' (E = ' + f(mt.E, 0) + ' N/mm²) herrscht eine Zugspannung von ' + f(sg, 0) + ' N/mm², weit unterhalb der Streckgrenze. Wie groß ist die Dehnung in Prozent?', v, '%', 'Dehnung ε', 3,
        'Nach Hooke: ε = σ / E = ' + f(sg, 0) + ' N/mm² / ' + f(mt.E, 0) + ' N/mm² = ' + f(sg / mt.E, 6) + ' = ' + f(v, 3) + ' %.', ['Im elastischen Bereich gilt σ = E · ε.', 'Stelle das Hookesche Gesetz nach ε um.']);
    },
    zs4: R => {
      const c = C(); let F, d, L, mt, dl, it = 0;
      do { F = c.pick(R, [10000, 20000, 30000, 50000]); d = c.pick(R, [10, 12, 16, 20]); L = c.pick(R, [500, 800, 1000, 1500, 2000]); mt = c.pick(R, c.MAT.filter(m => m.id === 's235' || m.id === 'alu')); dl = c.dLen(F, L, mt.E, c.areaCirc(d)); it++; } while (it < 200 && (dl < 0.2 || c.sigma(F, c.areaCirc(d)) > mt.Re * 0.6));
      const A = c.areaCirc(d), sg = F / A, q = numQ('Ein Zugstab aus ' + mt.n + ' (E = ' + f(mt.E, 0) + ' N/mm²) hat ' + f(d, 0) + ' mm Durchmesser und ' + f(L, 0) + ' mm Länge. Er wird mit ' + f(F, 0) + ' N auf Zug belastet (elastischer Bereich). Um wie viel mm verlängert er sich?', dl, 'mm', 'Verlängerung ΔL', 2,
        'A = ' + f(A, 1) + ' mm², σ = F / A = ' + f(sg, 1) + ' N/mm², ε = σ / E = ' + f(sg / mt.E, 6) + '. ΔL = ε · L = ' + f(sg / mt.E, 6) + ' · ' + f(L, 0) + ' mm = ' + f(dl, 3) + ' mm. Kurz: ΔL = F · L / (E · A).', ['Berechne zuerst die Spannung, dann die Dehnung nach Hooke.', 'Die Verlängerung ist Dehnung mal Ausgangslänge.']);
      return q;
    },
    /* Pressung und Abscheren */
    fp1: R => {
      const c = C(), F = c.pick(R, [2000, 3000, 5000, 8000, 10000]), d = c.pick(R, [8, 10, 12, 16]), t = c.pick(R, [4, 5, 6, 8, 10]), v = c.pressure(F, d, t);
      return numQ('Ein Bolzen mit ' + f(d, 0) + ' mm Durchmesser überträgt ' + f(F, 0) + ' N auf ein Blech mit ' + f(t, 0) + ' mm Dicke (Kraft quer zum Bolzen, Pressung im Loch). Wie groß ist die Flächenpressung zwischen Bolzen und Lochwand?', v, 'N/mm²', 'Flächenpressung p', 0,
        'Die tragende (projizierte) Fläche ist Durchmesser mal Blechdicke: A = d · t = ' + f(d, 0) + ' · ' + f(t, 0) + ' = ' + f(d * t, 0) + ' mm². p = F / A = ' + f(F, 0) + ' / ' + f(d * t, 0) + ' = ' + f(v, 1) + ' N/mm².', ['Welche Fläche drückt der Bolzen an die Lochwand? Ein Rechteck aus zwei Maßen.', 'Pressung ist wieder Kraft durch Fläche.']);
    },
    ab1: R => {
      const c = C(), F = c.pick(R, [4000, 6000, 10000, 15000, 20000]), d = c.pick(R, [6, 8, 10, 12]), n = c.pick(R, [1, 2]), v = c.shearTau(F, d, n);
      return numQ('Ein Bolzen mit ' + f(d, 0) + ' mm Durchmesser verbindet Teile und wird mit ' + f(F, 0) + ' N auf Abscheren belastet. Er ist ' + (n === 1 ? 'einschnittig (eine Scherfläche)' : 'zweischnittig (zwei Scherflächen)') + ' beansprucht. Wie groß ist die Scherspannung?', v, 'N/mm²', 'Scherspannung τ', 0,
        'A = π · d² / 4 = ' + f(c.areaCirc(d), 1) + ' mm². τ = F / (n · A) = ' + f(F, 0) + ' N / (' + n + ' · ' + f(c.areaCirc(d), 1) + ' mm²) = ' + f(v, 1) + ' N/mm².', ['Scheren belastet den Bolzenquerschnitt.', 'Bei zwei Scherflächen verteilt sich die Kraft auf zwei Querschnitte.']);
    },
    ab2: R => {
      const c = C(), Rm = c.pick(R, [360, 400, 510]), tau = c.tauAB(Rm), d = c.pick(R, [8, 10, 12, 16, 20]), s = c.pick(R, [2, 3, 4, 5]), v = c.punchF(tau, d, s) / 1000;
      return numQ('In ein Stahlblech mit ' + f(s, 0) + ' mm Dicke soll ein rundes Loch mit ' + f(d, 0) + ' mm Durchmesser gelocht werden. Der Werkstoff hat Rm = ' + f(Rm, 0) + ' N/mm²; als Abscherfestigkeit gilt τaB = 0,8 · Rm. Welche Stempelkraft ist mindestens nötig?', v, 'kN', 'Stempelkraft F', 1,
        'τaB = 0,8 · ' + f(Rm, 0) + ' = ' + f(tau, 0) + ' N/mm². Die Scherfläche ist der Lochumfang mal Blechdicke: A = π · d · s = π · ' + f(d, 0) + ' · ' + f(s, 0) + ' = ' + f(Math.PI * d * s, 1) + ' mm². F = τaB · A = ' + f(tau, 0) + ' · ' + f(Math.PI * d * s, 1) + ' N = ' + f(v * 1000, 0) + ' N = ' + f(v, 2) + ' kN.', ['Beim Lochen wird eine Zylinderfläche abgeschert: Umfang mal Dicke.', 'Kraft = Scherfestigkeit mal Scherfläche.']);
    },
    /* Biegung und Sicherheit */
    bg1: R => {
      const c = C();
      if (R() < 0.6) {
        const b = c.pick(R, [20, 30, 40, 50]), h = c.pick(R, [30, 40, 60, 80]), v = c.Wrect(b, h);
        return numQ('Ein Rechteckprofil (Breite b = ' + f(b, 0) + ' mm, Höhe h = ' + f(h, 0) + ' mm) wird in Richtung der Höhe auf Biegung belastet. Wie groß ist sein Widerstandsmoment?', v, 'mm³', 'Widerstandsmoment W', 0,
          'W = b · h² / 6 = ' + f(b, 0) + ' · ' + f(h, 0) + '² / 6 mm³ = ' + f(v, 0) + ' mm³. Die Höhe geht quadratisch ein: Hochkant ist das Profil viel steifer als flach.', ['Die Höhe in Lastrichtung wirkt quadratisch.', 'Nicht verwechseln: Flächeninhalt und Widerstandsmoment sind verschiedene Größen.']);
      }
      const d = c.pick(R, [20, 30, 40, 50]), v = c.Wcirc(d);
      return numQ('Eine Welle mit ' + f(d, 0) + ' mm Durchmesser wird auf Biegung belastet. Wie groß ist das Widerstandsmoment ihres Vollkreis-Querschnitts?', v, 'mm³', 'Widerstandsmoment W', 0,
        'W = π · d³ / 32 = π · ' + f(d, 0) + '³ / 32 mm³ = ' + f(v, 0) + ' mm³. Der Durchmesser geht in der dritten Potenz ein.', ['Beim Kreis steht der Durchmesser hoch drei in der Formel.', 'Faktor π durch 32.']);
    },
    bg2: R => {
      const c = C(), F = c.pick(R, [2000, 3000, 4000, 6000]), L = c.pick(R, [400, 500, 600, 800]), Mb = F * L / 4;
      if (R() < 0.6) {
        const b = c.pick(R, [20, 30, 40]), h = c.pick(R, [30, 40, 50]), W = c.Wrect(b, h), v = Mb / W, q = numQ('Ein Rechteckträger (b = ' + f(b, 0) + ' mm, h = ' + f(h, 0) + ' mm, hochkant belastet) liegt auf zwei Stützen mit ' + f(L, 0) + ' mm Abstand und trägt in der Mitte eine Einzellast von ' + f(F, 0) + ' N. Wie groß ist die größte Biegespannung?', v, 'N/mm²', 'Biegespannung σb', 0,
          'Größtes Biegemoment in der Mitte: Mb = F · L / 4 = ' + f(F, 0) + ' N · ' + f(L, 0) + ' mm / 4 = ' + f(Mb, 0) + ' Nmm. W = b · h² / 6 = ' + f(W, 0) + ' mm³. σb = Mb / W = ' + f(v, 1) + ' N/mm².', ['Zuerst das größte Biegemoment, dann das Widerstandsmoment.', 'Mb in Nmm, W in mm³: Das Ergebnis kommt dann in N/mm².']);
        q.fig = { type: 'beam', bm: bmOf(L, [{ t: 'F', F, x: L / 2 }]), unit: 'mm' }; return q;
      }
      const d = c.pick(R, [20, 25, 30, 40]), W = c.Wcirc(d), v = Mb / W, q = numQ('Eine Welle (d = ' + f(d, 0) + ' mm) liegt auf zwei Lagern mit ' + f(L, 0) + ' mm Abstand und trägt in der Mitte eine Einzellast von ' + f(F, 0) + ' N. Wie groß ist die größte Biegespannung?', v, 'N/mm²', 'Biegespannung σb', 0,
        'Mb = F · L / 4 = ' + f(Mb, 0) + ' Nmm. W = π · d³ / 32 = ' + f(W, 0) + ' mm³. σb = Mb / W = ' + f(v, 1) + ' N/mm².', ['Zuerst das größte Biegemoment, dann das Widerstandsmoment.', 'Mb in Nmm, W in mm³: Das Ergebnis kommt dann in N/mm².']);
      q.fig = { type: 'beam', bm: bmOf(L, [{ t: 'F', F, x: L / 2 }]), unit: 'mm' }; return q;
    },
    sf1: R => {
      const c = C();
      if (R() < 0.3) {
        const mt = c.pick(R, c.MAT), lim = mt.zaeh ? 'Die Streckgrenze Re' : 'Die Zugfestigkeit Rm';
        return choiceQ(R, 'Du rechnest die Sicherheit eines Bauteils aus ' + mt.n + '. Welche Kenngröße ist die Grenzspannung, durch die du die vorhandene Spannung teilst?', lim, ['Die Streckgrenze Re', 'Die Zugfestigkeit Rm', 'Der Elastizitätsmodul E', 'Die Bruchdehnung A'].filter(x => x !== lim),
          mt.zaeh ? 'Zähe Werkstoffe werden bleibend verformt, sobald die Streckgrenze überschritten ist. Deshalb ist Re die Grenze, die nicht überschritten werden soll.' : 'Gusseisen ist spröde, es hat keine ausgeprägte Streckgrenze und bricht fast ohne Verformung. Hier gilt die Zugfestigkeit Rm.', ['Zäh heißt: Der Werkstoff verformt sich vor dem Bruch. Spröde heißt: Er bricht ohne Vorwarnung.', 'Die Grenze ist dort, wo das Bauteil unbrauchbar wird.']);
      }
      const mt = c.pick(R, c.MAT), sg = c.pick(R, [40, 60, 80, 100, 120, 150]), lim = c.limOf(mt), v = lim / sg;
      return numQ('Ein Bauteil aus ' + mt.n + ' (' + (mt.zaeh ? 'Re = ' + f(mt.Re, 0) + ' N/mm², ' : '') + 'Rm = ' + f(mt.Rm, 0) + ' N/mm²) hat eine vorhandene Spannung von ' + f(sg, 0) + ' N/mm². Wie groß ist die Sicherheit gegen das Versagen?', v, '', 'Sicherheit S', 1,
        (mt.zaeh ? 'Der Werkstoff ist zäh: Grenzspannung ist die Streckgrenze Re = ' + f(mt.Re, 0) + ' N/mm². ' : 'Der Werkstoff ist spröde: Grenzspannung ist die Zugfestigkeit Rm = ' + f(mt.Rm, 0) + ' N/mm². ') + 'S = ' + (mt.zaeh ? 'Re' : 'Rm') + ' / σ = ' + f(lim, 0) + ' / ' + f(sg, 0) + ' = ' + f(v, 2) + '.', ['Welche Grenze gilt für diesen Werkstoff: Streckgrenze oder Zugfestigkeit?', 'Sicherheit = Grenzspannung geteilt durch vorhandene Spannung.']);
    },
    sf2: R => {
      const c = C(), mt = c.pick(R, c.MAT.filter(m => m.zaeh)), d = c.pick(R, [10, 12, 16, 20, 24]), lf = c.pick(R, ['ruhig', 'wechselnd', 'stoss']), S = c.S_REQ[lf], A = c.areaCirc(d), sz = mt.Re / S, v = sz * A / 1000;
      return numQ('Ein Zugbolzen aus ' + mt.n + ' (Re = ' + f(mt.Re, 0) + ' N/mm², Rm = ' + f(mt.Rm, 0) + ' N/mm²) hat ' + f(d, 0) + ' mm Durchmesser. Die Last ist ' + (lf === 'ruhig' ? 'ruhend' : lf === 'wechselnd' ? 'wechselnd' : 'stoßartig') + ', gefordert ist deshalb eine Sicherheit von S = ' + f(S, 1) + ' gegen die Streckgrenze. Welche Zugkraft darf er höchstens tragen?', v, 'kN', 'Zulässige Kraft', 1,
        'σzul = Re / S = ' + f(mt.Re, 0) + ' / ' + f(S, 1) + ' = ' + f(sz, 1) + ' N/mm². A = π · d² / 4 = ' + f(A, 1) + ' mm². Fzul = σzul · A = ' + f(sz, 1) + ' · ' + f(A, 1) + ' N = ' + f(v * 1000, 0) + ' N = ' + f(v, 2) + ' kN.', ['Erst die zulässige Spannung, dann mal Fläche.', 'Die zulässige Spannung ist die Grenzspannung durch die geforderte Sicherheit.']);
    },
    /* Arbeit und Leistung */
    ar1: R => {
      const c = C(), k = c.ri(R, 0, 2);
      if (k === 0) {
        const F = c.pick(R, [200, 400, 500, 800, 1200]), s = c.pick(R, [2, 3, 5, 8, 10]), v = F * s;
        return numQ('Ein Wagen wird mit einer gleichbleibenden Kraft von ' + f(F, 0) + ' N über ' + f(s, 0) + ' m in Bewegungsrichtung geschoben. Welche Arbeit wird verrichtet?', v, 'J', 'Arbeit W', 0, 'W = F · s = ' + f(F, 0) + ' N · ' + f(s, 0) + ' m = ' + f(v, 0) + ' J (1 J = 1 Nm).', ['Arbeit ist Kraft mal Weg in Kraftrichtung.', 'Newton mal Meter ergibt Joule.']);
      }
      if (k === 1) {
        const m = c.pick(R, [50, 80, 100, 200, 500]), h = c.pick(R, [2, 3, 4, 6]), v = c.workLift(m, h);
        return numQ('Ein Kran hebt eine Last von ' + KG(m) + ' um ' + f(h, 0) + ' m an (ohne Reibungsverluste). Welche Hubarbeit wird dabei verrichtet?', v, 'J', 'Hubarbeit W', 0, 'W = m · g · h = ' + f(m, 0) + ' kg · 9,81 m/s² · ' + f(h, 0) + ' m = ' + f(v, 0) + ' J.', ['Die zu hebende Kraft ist die Gewichtskraft der Last.', 'Arbeit = Gewichtskraft mal Hubhöhe.']);
      }
      const W = c.pick(R, [1200, 3600, 6000, 9000, 24000]), t = c.pick(R, [4, 6, 10, 12, 20]), v = W / t;
      return numQ('Eine Winde verrichtet in ' + f(t, 0) + ' s eine Arbeit von ' + f(W, 0) + ' J. Welche mittlere Leistung hat sie?', v, 'W', 'Leistung P', 0, 'P = W / t = ' + f(W, 0) + ' J / ' + f(t, 0) + ' s = ' + f(v, 0) + ' W.', ['Leistung ist Arbeit pro Zeit.', 'Joule durch Sekunden ergibt Watt.']);
    },
    ar2: R => {
      const c = C(), k = c.ri(R, 0, 2);
      if (k === 0) {
        const Pz = c.pick(R, [1.5, 2, 3, 5.5]), Pa = c.rd(Pz * c.pick(R, [0.6, 0.7, 0.8, 0.85, 0.9]), 2), e = Pa / Pz;
        return numQ('Ein Getriebemotor nimmt ' + f(Pz, 1) + ' kW elektrische Leistung auf und gibt ' + f(Pa, 2) + ' kW an der Welle ab. Wie groß ist sein Wirkungsgrad?', e * 100, '%', 'Wirkungsgrad η', 0, 'η = P_ab / P_zu = ' + f(Pa, 2) + ' kW / ' + f(Pz, 1) + ' kW = ' + f(e, 2) + ' = ' + f(e * 100, 0) + ' %. Der Rest sind Verluste (Wärme).', ['Wirkungsgrad ist abgegebene durch zugeführte Leistung.', 'Er ist nie größer als 100 %.']);
      }
      if (k === 1) {
        const Pa = c.pick(R, [1, 2, 3, 4]), e = c.pick(R, [0.5, 0.6, 0.75, 0.8, 0.9]), v = Pa / e;
        return numQ('Eine Pumpe soll ' + f(Pa, 1) + ' kW nutzbare Leistung abgeben. Ihr Wirkungsgrad beträgt ' + f(e * 100, 0) + ' %. Welche Leistung muss ihr zugeführt werden?', v, 'kW', 'Zugeführte Leistung', 2, 'P_zu = P_ab / η = ' + f(Pa, 1) + ' kW / ' + f(e, 2) + ' = ' + f(v, 2) + ' kW. Die zugeführte Leistung ist immer größer als die abgegebene.', ['Stelle η = P_ab / P_zu nach P_zu um.', 'Das Ergebnis muss größer sein als die Nutzleistung.']);
      }
      const e1 = c.pick(R, [0.9, 0.95, 0.8]), e2 = c.pick(R, [0.7, 0.8, 0.85, 0.9]), v = e1 * e2 * 100;
      return numQ('Ein Antrieb besteht aus einem Motor (η = ' + f(e1 * 100, 0) + ' %) und einem nachgeschalteten Getriebe (η = ' + f(e2 * 100, 0) + ' %). Wie groß ist der Gesamtwirkungsgrad?', v, '%', 'Gesamtwirkungsgrad', 0, 'Die Wirkungsgrade hintereinander geschalteter Stufen werden multipliziert: ηges = ' + f(e1, 2) + ' · ' + f(e2, 2) + ' = ' + f(e1 * e2, 3) + ' = ' + f(v, 1) + ' %.', ['Verluste summieren sich nicht, die Wirkungsgrade multiplizieren sich.', 'Das Ergebnis ist kleiner als jeder Einzelwirkungsgrad.']);
    },
    /* Fehlersuche */
    /* PRUEFEN P15: Fehlerbild A (Rechenzettel mit vier Zeilen, eine ist falsch: g vergessen, Millimeter nicht in Meter, Fläche ohne /4, Leistung mit Zeit multipliziert statt geteilt, Auflager doppelt gezählt, Wirkungsgrad über 100 %). Sind das die Fehler, die bei euch am häufigsten vorkommen, und fehlt eine typische Fehlerquelle? */
    fsa: R => {
      const c = C(), kinds = c.shuffle(R, ['g', 'mm', 'fl', 'pw', 'au', 'et']).slice(0, 4), bad = c.ri(R, 0, 3), lines = [], names = [];
      kinds.forEach((k, i) => {
        const w = i === bad; let t, nm;
        if (k === 'g') { const m = c.pick(R, [20, 40, 60, 80]), Gk = c.weight(m); nm = 'Gewichtskraft'; t = 'm = ' + m + ' kg → G = ' + (w ? 'm = ' + f(m, 0) + ' N' : 'm · g = ' + f(m, 0) + ' · 9,81 = ' + f(Gk, 0) + ' N'); }
        if (k === 'mm') { const F = c.pick(R, [150, 200, 250, 300]), l = c.pick(R, [200, 300, 400]), M = F * l / 1000; nm = 'Drehmoment'; t = 'F = ' + F + ' N, l = ' + l + ' mm → M = F · l = ' + f(F, 0) + ' · ' + (w ? f(l, 0) + ' = ' + f(F * l, 0) : f(l / 1000, 1) + ' = ' + f(M, 0)) + ' Nm'; }
        if (k === 'fl') { const d = c.pick(R, [10, 12, 16]), F = c.pick(R, [10000, 15000, 20000]), A = c.areaCirc(d), Af = Math.PI * d * d, s = F / (w ? Af : A); nm = 'Spannung'; t = 'F = ' + F + ' N, d = ' + d + ' mm → A = ' + (w ? 'π · d² = ' + f(Af, 0) : 'π · d² / 4 = ' + f(A, 0)) + ' mm², σ = F / A = ' + f(s, 0) + ' N/mm²'; }
        if (k === 'pw') { const W = c.pick(R, [3600, 6000, 9000]), tt = c.pick(R, [10, 12, 20]), P = w ? W * tt : W / tt; nm = 'Leistung'; t = 'W = ' + W + ' J in t = ' + tt + ' s → P = ' + (w ? 'W · t' : 'W / t') + ' = ' + f(P, 0) + ' W'; }
        if (k === 'au') { const L = c.pick(R, [4, 6]), F = c.pick(R, [800, 1200, 2000]); nm = 'Träger'; t = 'Träger, ' + L + ' m, Einzellast ' + F + ' N in der Mitte → ' + (w ? 'FA = ' + F + ' N und FB = ' + F + ' N' : 'FA = FB = ' + f(F / 2, 0) + ' N'); }
        if (k === 'et') { const Pz = c.pick(R, [2, 3, 4]), e = c.pick(R, [0.75, 0.8, 0.9]), Pa = Pz * e; nm = 'Wirkungsgrad'; t = 'P_zu = ' + Pz + ' kW, P_ab = ' + f(Pa, 2) + ' kW → η = ' + (w ? 'P_zu / P_ab = ' + f(Pz / Pa * 100, 0) + ' %' : 'P_ab / P_zu = ' + f(e * 100, 0) + ' %'); }
        lines.push('Zeile ' + (i + 1) + ': ' + t); names.push(nm);
      });
      const expl = { g: 'Die Masse in kg ist keine Kraft: Es fehlt der Faktor g = 9,81 m/s².', mm: 'Millimeter wurden nicht in Meter umgerechnet: M in Nm braucht den Hebelarm in m (Ergebnis um den Faktor 1000 zu groß).', fl: 'Die Kreisfläche ist π · d² / 4. Ohne den Faktor 1/4 wird die Fläche vierfach zu groß und die Spannung viermal zu klein.', pw: 'Leistung ist Arbeit durch Zeit. Mit der Zeit multipliziert ergäbe sich keine Leistung (Einheit J · s).', au: 'Die Auflagerkräfte müssen zusammen die Last tragen: FA + FB = F. Hier wäre die Summe doppelt so groß wie die Last.', et: 'Der Wirkungsgrad ist P_ab / P_zu und nie über 100 %. Ein Ergebnis über 100 % ist ein sicherer Hinweis auf einen Dreher.' };
      const right = 'Zeile ' + (bad + 1) + ' (' + names[bad] + ')', wrong = names.map((n, i) => 'Zeile ' + (i + 1) + ' (' + n + ')').filter((_, i) => i !== bad);
      return choiceQ(R, 'Auf einem Rechenzettel stehen vier Zeilen. In genau einer steckt ein Fehler.\n' + lines.join('\n') + '\nWelche Zeile ist fehlerhaft?', right, wrong, 'Zeile ' + (bad + 1) + ' (' + names[bad] + '): ' + expl[kinds[bad]], ['Prüfe bei jeder Zeile die Einheit und die Größenordnung des Ergebnisses.', 'Frage dich: Passt das Ergebnis zu dem, was du erwartest? Zehnerpotenzen und 100 % sind Warnsignale.']);
    },
    /* PRUEFEN P16: Fehlerbild B (Plausibilität von Auflagerkräften): Prüfkriterien Summe = Last, näher liegende Stütze trägt mehr, Kräfte nicht negativ. Falsche Ergebnisse: vertauscht, hälftig geteilt, beide gleich der größeren Kraft. Reicht das als Plausibilitätsprüfung? */
    fsb: R => {
      const c = C(), L = c.pick(R, [4, 6, 8]), a = c.pick(R, [1, 2, 3].map(k => k * L / 8)), F = c.pick(R, [800, 1200, 1600, 2400]), bm = bmOf(L, [{ t: 'F', F, x: a }]), r = c.reactions(bm);
      const o = (A, B) => 'FA = ' + f(A, 0) + ' N, FB = ' + f(B, 0) + ' N';
      const right = o(r.FA, r.FB), wrong = [o(r.FB, r.FA), o(F / 2, F / 2), o(r.FA, r.FA)];
      const q = choiceQ(R, 'Ein Träger liegt auf zwei Stützen A (links) und B (rechts) mit ' + f(L, 0) + ' m Abstand. Eine Einzellast von ' + f(F, 0) + ' N steht ' + f(a, 2) + ' m von Stütze A entfernt. Vier Rechnungen liefern verschiedene Ergebnisse. Welches ist plausibel (und richtig)?', right, wrong,
        'Prüfung 1: FA + FB muss die Last ' + f(F, 0) + ' N ergeben. Prüfung 2: Die näher stehende Stütze A trägt mehr als B. Richtig: FB = F · a / L = ' + f(r.FB, 0) + ' N, FA = ' + f(r.FA, 0) + ' N. Die anderen Angaben verletzen eine der beiden Prüfungen (vertauscht, gleich geteilt trotz außermittiger Last oder Summe größer als die Last).', ['Addiere FA und FB: Was muss herauskommen?', 'Welche Stütze steht näher an der Last, welche trägt dann mehr?']);
      q.fig = { type: 'beam', bm }; return q;
    },
    /* PRUEFEN P17: Fehlerbild C (Rechenweg Zugstab mit vier Schritten): Fehler in Schritt 1 (Fläche ohne /4), Schritt 2 (Kraft in kN statt N), Schritt 3 (Rm statt Re) oder Schritt 4 (Bewertung gegen die geforderte Sicherheit 1,5 falsch herum). Passt die Auswahl der typischen Rechenfehler? */
    fsc: R => {
      const c = C(), mt = c.pick(R, c.MAT.filter(m => m.zaeh)), d = c.pick(R, [12, 16, 20]), F = c.pick(R, [20000, 30000, 40000, 60000]), bad = c.ri(R, 0, 3), Sreq = 1.5;
      const A = c.areaCirc(d), Af = Math.PI * d * d, sg = F / A, S = mt.Re / sg;
      let A1 = A, s2 = sg, S3 = S, concl = S >= Sreq;
      let l1 = 'A = π · d² / 4 = ' + f(A, 0) + ' mm²', l2 = 'σ = F / A = ' + f(F, 0) + ' N / ' + f(A, 0) + ' mm² = ' + f(sg, 0) + ' N/mm²', l3 = 'S = Re / σ = ' + f(mt.Re, 0) + ' / ' + f(sg, 0) + ' = ' + f(S, 2), c4;
      if (bad === 0) { A1 = Af; l1 = 'A = π · d² = ' + f(Af, 0) + ' mm²'; s2 = F / Af; l2 = 'σ = F / A = ' + f(F, 0) + ' N / ' + f(Af, 0) + ' mm² = ' + f(s2, 0) + ' N/mm²'; S3 = mt.Re / s2; l3 = 'S = Re / σ = ' + f(mt.Re, 0) + ' / ' + f(s2, 0) + ' = ' + f(S3, 2); concl = S3 >= Sreq; }
      if (bad === 1) { s2 = F / 1000 / A; l2 = 'σ = F / A = ' + f(F / 1000, 0) + ' kN / ' + f(A, 0) + ' mm² = ' + f(s2, 2) + ' N/mm²'; S3 = mt.Re / s2; l3 = 'S = Re / σ = ' + f(mt.Re, 0) + ' / ' + f(s2, 2) + ' = ' + f(S3, 0); concl = S3 >= Sreq; }
      if (bad === 2) { S3 = mt.Rm / sg; l3 = 'S = Rm / σ = ' + f(mt.Rm, 0) + ' / ' + f(sg, 0) + ' = ' + f(S3, 2); concl = S3 >= Sreq; }
      c4 = 'Bewertung: S ' + (bad === 3 ? (S >= Sreq ? '<' : '≥') : (concl ? '≥' : '<')) + ' 1,5, ' + (bad === 3 ? (S >= Sreq ? 'nicht ausreichend' : 'ausreichend') : (concl ? 'ausreichend' : 'nicht ausreichend'));
      const steps = ['Schritt 1 (Fläche): ' + l1, 'Schritt 2 (Spannung): ' + l2, 'Schritt 3 (Sicherheit): ' + l3, 'Schritt 4: ' + c4];
      const nm = ['Schritt 1 (Fläche)', 'Schritt 2 (Spannung)', 'Schritt 3 (Sicherheit)', 'Schritt 4 (Bewertung)'], ex = [
        'Die Kreisfläche ist π · d² / 4, nicht π · d². Ohne den Faktor 1/4 ist die Fläche viermal zu groß.',
        'Die Kraft wurde in kN eingesetzt, die Fläche steht in mm²: Für N/mm² muss die Kraft in N stehen. Das Ergebnis ist um den Faktor 1000 zu klein.',
        'Bei zähen Werkstoffen gilt als Grenzspannung die Streckgrenze Re, nicht die Zugfestigkeit Rm. Mit Rm wird die Sicherheit zu hoch angegeben.',
        'Die Bewertung ist verdreht: Ist S größer oder gleich der geforderten Sicherheit 1,5, ist der Stab ausreichend; ist S kleiner, ist er es nicht.'];
      return choiceQ(R, 'Ein Rundstab aus ' + mt.n + ' (Re = ' + f(mt.Re, 0) + ' N/mm², Rm = ' + f(mt.Rm, 0) + ' N/mm²), d = ' + f(d, 0) + ' mm, wird mit ' + f(F, 0) + ' N auf Zug belastet. Gefordert ist S ≥ 1,5. Der Rechenweg enthält einen Fehler:\n' + steps.join('\n') + '\nIn welchem Schritt steckt der Fehler?', nm[bad], nm.filter((_, i) => i !== bad), nm[bad] + ': ' + ex[bad] + ' Richtig gerechnet: A = ' + f(A, 0) + ' mm², σ = ' + f(sg, 0) + ' N/mm², S = ' + f(S, 2) + (S >= Sreq ? ' (ausreichend).' : ' (nicht ausreichend).'), ['Prüfe jeden Schritt einzeln, beginne bei den Einheiten.', 'Welche Größe gilt als Grenze bei einem zähen Werkstoff, und wann ist S ausreichend?']);
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator */
  const defs = [
    [CATS[0], 1, 'Masse und Gewicht', 'gew'], [CATS[0], 1, 'Kraft in Komponenten', 'zerl'], [CATS[0], 2, 'Zwei Kräfte, ein rechter Winkel', 'resr'], [CATS[0], 2, 'Zwei Kräfte im Winkel', 'resg'], [CATS[0], 3, 'Last an zwei Seilen', 'seil'],
    [CATS[1], 1, 'Schlüssel und Schraube', 'mom'], [CATS[1], 1, 'Der Hebel im Gleichgewicht', 'hebel'], [CATS[1], 2, 'Anzugsmoment erreichen', 'schl'], [CATS[1], 2, 'Balken mit mehreren Lasten', 'wippe'], [CATS[1], 3, 'Was trägt das Lager?', 'hebelL'],
    [CATS[2], 1, 'Last in der Mitte', 'tr1'], [CATS[2], 2, 'Last außermittig', 'tr2'], [CATS[2], 2, 'Gleichmäßig belastet', 'tr3'], [CATS[2], 2, 'Zwei Einzellasten', 'tr4'], [CATS[2], 3, 'Gemischte Belastung', 'tr5'],
    [CATS[3], 1, 'Blechdreieck', 'sp0'], [CATS[3], 2, 'Profil aus zwei Rechtecken', 'sp1'], [CATS[3], 3, 'Platte mit Bohrung', 'sp2'],
    [CATS[4], 1, 'Klotz auf der Bahn', 'rb1'], [CATS[4], 2, 'Wagen schieben', 'rb2'], [CATS[4], 2, 'Auf der Schräge', 'rb3'], [CATS[4], 2, 'Liegt es oder geht es?', 'rb4'], [CATS[4], 3, 'Der Neigungswinkel', 'rb5'], [CATS[4], 3, 'Die Rampe hinauf', 'rb6'],
    [CATS[5], 1, 'Zugspannung', 'zs1'], [CATS[5], 2, 'Stange dimensionieren', 'zs2'], [CATS[5], 2, 'Dehnung', 'zs3'], [CATS[5], 3, 'Länger unter Last', 'zs4'],
    [CATS[6], 1, 'Bolzen im Blech', 'fp1'], [CATS[6], 2, 'Bolzen auf Abscheren', 'ab1'], [CATS[6], 2, 'Lochen im Blech', 'ab2'],
    [CATS[7], 2, 'Profile vergleichen', 'bg1'], [CATS[7], 3, 'Biegespannung im Träger', 'bg2'], [CATS[7], 2, 'Wie sicher ist das Bauteil?', 'sf1'], [CATS[7], 2, 'Wie viel darf er tragen?', 'sf2'],
    [CATS[8], 1, 'Arbeit und Leistung', 'ar1'], [CATS[8], 2, 'Was kommt an?', 'ar2'],
    [CATS[9], 2, 'Fehlerbild A', 'fsa'], [CATS[9], 3, 'Fehlerbild B', 'fsb'], [CATS[9], 3, 'Fehlerbild C', 'fsc']
  ];
  const tasks = defs.map((d, i) => ({ id: 'mch' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  const makeTask = t => make(t, C().rng('mch-' + t.id));
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Auswertung (rein, ohne DOM) ---------- */
  /* Antwortformen a: { c } Auswahl, { v } Zahl (Text). Ergebnis: { err } bei unvollständiger Antwort, sonst { ok, given } */
  function evaluate(q, a) {
    const c = C(), as = q.ask; a = a || {};
    if (as.type === 'choice') { if (a.c == null) return { err: 'Wähle zuerst eine Antwort.' }; return { ok: a.c === as.correct, given: as.choices[a.c] }; }
    if (as.type === 'num') { const v = c.parseDe(a.v); if (!Number.isFinite(v)) return { err: 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' }; return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 3) + (as.unit ? ' ' + as.unit : '') }; }
    return { err: 'Unbekannte Frageform.' };
  }
  function solAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: as.correct };
    return { v: String(+q.value.toFixed(6)).replace('.', ',') };
  }
  function wrongAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: (as.correct + 1) % as.choices.length };
    return { v: '-12345' };
  }
  function solText(q) {
    const as = q.ask;
    if (as.type === 'choice') return as.choices[as.correct];
    return f(q.value, q.value >= 100 ? 1 : 2) + (as.unit ? ' ' + as.unit : '');
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus MCH_CORE; p = Zustand des Reiters) ---------- */
  const examples = [
    { id: 'kr1', tab: 'kr', title: 'Zwei Kräfte zusammensetzen', text: 'Zwei Kräfte (80 N und 60 N) stehen senkrecht aufeinander. Das Kräfteparallelogramm zeigt die Resultierende; ziehe die Pfeilspitzen, um zu sehen, wie sich R verändert.', p: { mode: 'comp', F1: '80', a1: '0', F2: '60', a2: '90', show: 'para' } },
    { id: 'kr2', tab: 'kr', title: 'Eine Kraft zerlegen', text: 'Eine Zugkraft von 100 N wirkt unter 30° gegen die Waagerechte. Welcher Anteil zieht waagerecht, welcher hebt?', p: { mode: 'zerl', F: '100', a: '30' } },
    { id: 'he1', tab: 'he', title: 'Hebel im Gleichgewicht', text: 'Links 200 N im Abstand 30 cm, rechts 100 N: Wo muss die rechte Last sitzen, damit der Balken waagerecht bleibt? Verschiebe die Gewichte und beobachte die Momente.', p: { F1: '200', x1: '30', F2: '100', x2: '60' } },
    { id: 'he2', tab: 'he', title: 'Aus dem Gleichgewicht', text: 'Die rechte Last sitzt zu weit außen: Das rechtsdrehende Moment überwiegt, der Balken neigt sich nach rechts.', p: { F1: '200', x1: '30', F2: '100', x2: '85' } },
    { id: 'tr1', tab: 'tr', title: 'Träger mit mittiger Einzellast', text: 'Träger über 4 m, in der Mitte 2000 N. Beide Stützen tragen gleich viel; das Biegemoment ist in der Mitte am größten.', p: { L: '4', a: '0', b: '4', F1: '2000', x1: '2', F2: '0', x2: '3', q: '0', q1: '0', q2: '4' } },
    { id: 'tr2', tab: 'tr', title: 'Streckenlast und Einzellast', text: 'Träger über 6 m: Streckenlast 500 N/m auf den rechten 3 m und eine Einzellast von 1500 N bei 1 m. Auflagerkräfte, Querkraft und Moment im Überblick.', p: { L: '6', a: '0', b: '6', F1: '1500', x1: '1', F2: '0', x2: '3', q: '500', q1: '3', q2: '6' } },
    { id: 'rb1', tab: 'rb', title: 'Stahl auf Holz bleibt liegen', text: 'Eine schiefe Ebene mit 20° Neigung und Stahl auf Holz (μ0 = 0,5): Der Reibwinkel ist etwa 27°, der Klotz bleibt liegen.', p: { mat: 'sh', m: '50', alpha: '20' } },
    { id: 'rb2', tab: 'rb', title: 'Stahl auf Stahl rutscht früh', text: 'Bei trockenem Stahl auf Stahl (μ0 = 0,15) reichen schon gut 8° Neigung, damit der Körper zu rutschen beginnt. Bei 20° rutscht er.', p: { mat: 'ss', m: '50', alpha: '20' } },
    { id: 'sp1', tab: 'sp', title: 'Zugstab aus S235JR', text: 'Rundstab 16 mm Durchmesser, 1 m lang, 30 kN Zugkraft: Spannung, Dehnung, Verlängerung und Sicherheit. Die Verlängerung wird in der Zeichnung stark übertrieben gezeigt.', p: { sub: 'zug', prof: 'kreis', d: '16', b: '20', h: '10', F: '30000', L: '1000', mat: 's235', lf: 'ruhig' } },
    { id: 'sp2', tab: 'sp', title: 'Biegung: hochkant oder flach', text: 'Ein Rechteckprofil 20 × 40 mm auf zwei Stützen mit 600 mm Abstand und 3000 N in der Mitte. Dreh das Profil im Rechner: Hochkant ist die Spannung viel kleiner.', p: { sub: 'bieg', bprof: 'rechteck', bb: '20', bh: '40', bd: '30', bF: '3000', bL: '600', mat: 's235', lf: 'ruhig' } },
    { id: 'fp1', tab: 'fp', title: 'Bolzen: Pressung und Abscheren', text: 'Ein 12-mm-Bolzen überträgt 10 kN in ein 6 mm dickes Blech. Die Pressung im Loch und die Scherspannung im Bolzen im Vergleich.', p: { sub: 'press', F: '10000', d: '12', t: '6', n: '1', Rm: '360', s: '3' } },
    { id: 'wt1', tab: 'wt', title: 'Schwerpunkt eines L-Profils', text: 'Grundplatte 80 × 12 mm, darauf ein Steg 12 × 60 mm: Der Schwerpunkt liegt deutlich über der Mitte der Platte, aber unter der halben Gesamthöhe.', p: { sub: 'sw', B: '80', t1: '12', t2: '12', H: '60' } },
    { id: 'wt2', tab: 'wt', title: 'Antrieb mit zwei Stufen', text: 'Ein Motor mit 85 % und ein Getriebe mit 90 % ergeben zusammen nur etwa 77 %. Bei 3 kW Zufuhr kommen 2,3 kW an.', p: { sub: 'ar', Pzu: '3', e1: '85', e2: '90', F: '500', s: '4', t: '8' } }
  ];

  root.MCH_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, evaluate, solAns, wrongAns, solText, pools: {} };
  root.MCH_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.MCH_DATA, TASKS: root.MCH_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
