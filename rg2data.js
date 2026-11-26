/* rg2data.js - Regelungstechnik Aufbau (Studium): Blöcke, Erklärtexte und Aufgaben (60 Stück, 6 Blöcke).
 * Regel: Vorgaben (Parameter p) stehen im Aufgabentext; Ergebnis, Tipps mit Zwischenwerten und Rechenweg kommen ausschließlich aus dem Kern (rg2core.js) über calc().
 * Der Test (quelle/rg2/test_rg2data.js) rechnet jede Antwort mit einem zweiten, unabhängigen Weg nach (Formel gegen Simulation, Wurzeln gegen Probe usw.).
 * Aufgabenformat: { id, block, level 1..3, title, kind 'num'|'choice', unit, tol {rel, abs}, p, options?, text(p), calc(R, p) -> {answer, v}, tips(p, v) -> [3], steps(p, v) -> [..] }
 * build(id) liefert die fertige Aufgabe: { ..., text, answer, tips[3], steps[], result }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rg2core.js')); else root.RG2DATA = factory(root.RG2);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  const DEG = 180 / Math.PI;
  /* Zahlen im deutschen Format, Minus als echtes Minuszeichen */
  const f = (x, d) => { if (x == null || !isFinite(x)) return '–'; let s = Number(x).toFixed(d == null ? 2 : d).replace('.', ','); if (/^-0(,0*)?$/.test(s)) s = s.slice(1); return s.replace('-', '−'); };
  const sig = (x, k) => { if (!isFinite(x) || x === 0) return f(x, 1); const d = Math.max(0, (k || 3) - 1 - Math.floor(Math.log10(Math.abs(x)))); return f(x, Math.min(d, 8)); };
  const rt = (x, d) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);

  /* ===================================================================== Blöcke */
  const BLOCKS = [
    {
      id: 1, tab: 'Übertragung', title: 'Übertragungsfunktion, Pole und Nullstellen, Sprungantwort',
      lead: 'Wie ein Bauteil oder eine Strecke auf Änderungen reagiert, steckt in einem Bruch aus Polynomen in s. Die Nullstellen des Nenners (die Pole) verraten, ob und wie die Antwort ausklingt.',
      parts: [
        'Die Übertragungsfunktion G(s) = Ausgang/Eingang beschreibt ein lineares System im Bildbereich. Zähler und Nenner sind Polynome in s. Nullstellen des Zählers heißen Nullstellen, Nullstellen des Nenners Pole. Im Pol-Nullstellen-Plan zeichnet man beide in die komplexe s-Ebene ein (Realteil waagerecht, Imaginärteil senkrecht).',
        'Die Lage der Pole bestimmt die Sprungantwort: Liegen alle Pole links der Imaginärachse, klingt die Antwort aus (stabil). Ein Pol rechts davon lässt sie aufschaukeln (instabil). Ein einfacher Pol genau auf der Achse liefert einen Anteil, der von selbst weder abklingt noch aufklingt (grenzstabil): beim Polpaar ±jω eine Dauerschwingung, beim Pol in 0 (Integrator) einen Wert, der stehen bleibt. Auf einen Sprung antwortet der Integrator deshalb mit einer Rampe. Je weiter links ein Pol, desto schneller klingt sein Anteil ab. Je größer sein Imaginärteil, desto schneller schwingt er.',
        'Standardbausteine: PT1 (ein Energiespeicher, Pol bei −1/T), PT2 (zwei Speicher, Pole mit Dämpfung D und Kennkreisfrequenz ω0), I (Integrator, Pol bei 0), D bzw. DT1 (reagiert auf Änderungen), Totzeit (reine Verzögerung e^(−sTt)). Die Totzeit ist keine Bruchfunktion. Für Rechnungen mit Polen ersetzt man sie näherungsweise durch ein Padé-Glied, z. B. 1. Ordnung (1 − sTt/2)/(1 + sTt/2): Es hat eine Nullstelle in der rechten Halbebene. Deshalb läuft die genäherte Antwort zuerst kurz in die falsche Richtung; die echte Totzeit tut das nicht, sie bleibt bis Tt auf null (Fehler der Näherung, im Labor sichtbar).',
        'Kenngrößen der Sprungantwort: Überschwingen (größter Wert über dem Endwert, in Prozent des Endwerts), Anregelzeit (die Antwort erreicht den Endwert zum ersten Mal), Ausregelzeit (ab hier bleibt die Antwort im Toleranzband, hier ±5 %). Achtung: Manche Bücher zählen die Anregelzeit bis zum ersten Eintritt ins Toleranzband oder nennen die Zeit von 10 % auf 90 % Anstiegszeit; die Ausregelzeit wird auch mit ±2 % angegeben.'
      ],
      merke: ['PT2 mit D < 1: Pole −Dω0 ± jω0·√(1−D²). Überschwingen = e^(−πD/√(1−D²)).', 'PT1: Ausregelzeit (5 %) ≈ 3T, nach 1T sind 63,2 % erreicht.', 'Pole rechts der Achse = instabil. Totzeit-Padé: Nullstellen rechts, Pole links.']
    },
    {
      id: 2, tab: 'Bode', title: 'Bode-Diagramm',
      lead: 'Das Bode-Diagramm zeigt, wie stark und wie verzögert ein System Sinusschwingungen verschiedener Frequenz überträgt. Es lässt sich aus Eckfrequenzen und Geradenstücken (Asymptoten) von Hand zeichnen.',
      parts: [
        'Man setzt s = jω und trägt Betrag (in dB = 20·lg|G|) und Phase (in Grad) über der Frequenz ω logarithmisch auf. Weil sich Faktoren multiplizieren, addieren sich im Diagramm ihre dB-Werte und ihre Phasen. Das macht das Zusammensetzen aus Bausteinen einfach.',
        'Jeder Baustein hat eine Eckfrequenz. Ein PT1 mit Zeitkonstante T hat ω_E = 1/T: Darunter verläuft der Betrag waagerecht (Verstärkung K), darüber fällt er mit −20 dB je Dekade. An der Eckfrequenz selbst liegt der echte Verlauf 3 dB unter dem Knick, die Phase beträgt −45° und geht von 0° nach −90°. Ein Integrator hat die Steigung −20 dB/Dek. und −90° Phase. Ein PT2 fällt oberhalb ω0 mit −40 dB/Dek.; bei kleiner Dämpfung (D < 0,707) hebt er sich vor dem Knick um 1/(2D√(1−D²)) heraus (Resonanz). Seine Phase ist bei ω0 genau −90°.',
        'Die Totzeit ändert den Betrag nicht, kostet aber Phase: φ = −ω·Tt (im Bogenmaß). Das wächst linear mit der Frequenz und ist deshalb für schnelle Regelkreise gefährlich.',
        'Die Durchtrittsfrequenz ω_D ist jene Frequenz, bei der die Kurve 0 dB kreuzt (Betrag 1). Sie ist ein Maß für die Schnelligkeit eines Regelkreises und wird im nächsten Block für die Stabilitätsprüfung gebraucht.'
      ],
      merke: ['Steigung ändert sich an jeder Eckfrequenz um ±20 dB/Dek. je einfachem Pol/Nullstelle (±40 bei einem komplexen Paar).', 'Phase eines Bausteins an seiner Ecke: PT1 −45°, PT2 −90°. Totzeit: −ω·Tt bei jeder Frequenz (keine Ecke).']
    },
    {
      id: 3, tab: 'Stabilität', title: 'Stabilität: Nyquist, Phasenreserve, Amplitudenreserve',
      lead: 'Ein Regelkreis kippt, wenn die Rückführung die Schwingung nicht dämpft, sondern verstärkt. Aus dem offenen Kreis L(s) = R(s)·G(s) kann man ablesen, wie weit er davon entfernt ist.',
      parts: [
        'Man schneidet den Kreis auf und betrachtet L(s). Der geschlossene Kreis hat den Nenner 1 + L(s). Im einfachen Fall gilt: Hat L(jω) bei der Frequenz, an der die Phase −180° erreicht, einen Betrag größer als 1, ist der Kreis instabil (die Ortskurve umläuft den Punkt −1); bei genau 1 schwingt er dauerhaft (Stabilitätsgrenze).',
        'Vereinfachtes Nyquist-Kriterium: Hat der offene Kreis keine Pole rechts der Imaginärachse (höchstens zwei Pole im Ursprung sind erlaubt), positive Verstärkung, keine Nullstellen rechts und genau einen Durchtritt durch 0 dB, dann ist der geschlossene Kreis genau dann stabil, wenn die Phase bei der Durchtrittsfrequenz ω_D noch über −180° liegt. Eine Totzeit im Kreis ist dabei zulässig. Der Abstand heißt Phasenreserve φ_R = 180° + φ(ω_D). Brauchbar sind etwa 30° bis 60°.',
        'Die Amplitudenreserve A_R gibt an, um welchen Faktor (oder wie viele dB) man die Verstärkung erhöhen darf, bevor der Kreis bei der Phasendurchtrittsfrequenz ω_180 kippt: A_R = 1/|L(jω_180)|. Phasenreserve und Amplitudenreserve zusammen sind die Sicherheitsabstände des Regelkreises.',
        'Totzeit im Kreis senkt die Phasenreserve um ω_D·Tt, ohne ω_D zu ändern. Die größte zulässige Totzeit ist also Tt,max = φ_R/ω_D (φ_R im Bogenmaß). Das Kriterium gilt in dieser einfachen Form nicht bei Polen in der rechten Halbebene, bei Nullstellen rechts oder mehreren Durchtritten. Das Programm sagt dann, warum es nicht anwendbar ist, und prüft zusätzlich die Pole des geschlossenen Kreises.'
      ],
      merke: ['Stabil, wenn φ_R > 0 und A_R > 1 (im einfachen Fall).', 'Kritische Verstärkung: K_krit = K·A_R = K/|L(jω_180)| (A_R: Amplitudenreserve, Faktor, um den K noch steigen darf).', 'Zusätzliche Totzeit verschiebt nur die Phase, nicht den Betrag.']
    },
    {
      id: 4, tab: 'Wurzelort', title: 'Wurzelortskurve',
      lead: 'Die Wurzelortskurve (WOK) zeigt, wie die Pole des geschlossenen Kreises wandern, wenn man die Verstärkung K von 0 an erhöht. Sie macht sichtbar, wo ein Kreis zu schwingen beginnt und wo er instabil wird.',
      parts: [
        'Ausgangspunkt ist der offene Kreis L(s) = K·Z(s)/N(s). Die Pole des geschlossenen Kreises sind die Lösungen von N(s) + K·Z(s) = 0. Bei K = 0 sind das die Pole des offenen Kreises, mit wachsendem K wandern sie zu den Nullstellen von Z(s) oder (wenn es zu wenige Nullstellen gibt) in unendliche Entfernung.',
        'Regeln, die beim Skizzieren helfen: Ein Punkt der reellen Achse liegt auf der Kurve, wenn rechts von ihm eine ungerade Anzahl von Polen und Nullstellen liegt. Die Zahl der Äste, die ins Unendliche laufen, ist n − m (Polzahl minus Nullstellenzahl). Ihre Richtungen sind (2k+1)·180°/(n − m), und sie laufen von einem gemeinsamen Schwerpunkt σ_S = (ΣPole − ΣNullstellen)/(n − m) aus. Stoßen zwei Äste auf der reellen Achse zusammen, verlassen sie diese an einem Verzweigungspunkt.',
        'Wo ein Ast die imaginäre Achse kreuzt, ist die kritische Verstärkung K_krit erreicht (dort schwingt der Kreis ungedämpft mit ω_krit). Für K darüber ist der Kreis instabil. Die Lage der Pole beim gewählten K liefert direkt Dämpfung und Kennkreisfrequenz des geschlossenen Kreises: Pol bei s = −σ ± jω_d, Dämpfung D = σ/|s|, Kennkreisfrequenz ω0 = |s|; die Schwingung selbst läuft mit ω_d.',
        'Mit dem Regler K als einzigem Parameter lässt sich so die Verstärkung nach einem gewünschten Dämpfungswert aussuchen, zum Beispiel D = 1/√2 ≈ 0,707 für etwa 4,3 % Überschwingen der PT2-Antwort.'
      ],
      merke: ['Pole des geschlossenen Kreises lösen N(s) + K·Z(s) = 0.', 'Punkt der reellen Achse liegt auf der Kurve, wenn rechts von ihm eine ungerade Zahl von Polen und Nullstellen liegt.', 'Die kritische Verstärkung folgt auch aus dem Hurwitz-Kriterium.']
    },
    {
      id: 5, tab: 'Entwurf', title: 'Reglerentwurf: Betragsoptimum, symmetrisches Optimum, Einstellregeln',
      lead: 'Es gibt drei Wege zu Reglerwerten: eine Strecke rechnerisch kompensieren (Betrags- und symmetrisches Optimum), am Regelkreis bis zur Stabilitätsgrenze probieren (Ziegler-Nichols) oder aus der gemessenen Sprungantwort Tabellen nutzen (Ziegler-Nichols Sprungantwort, Chien-Hrones-Reswick).',
      parts: [
        'Betragsoptimum (BO): Die Strecke hat eine oder zwei große Zeitkonstanten T1, T2 und eine Summe kleiner Zeitkonstanten Tσ. Der Regler kürzt die großen Zeitkonstanten: Nachstellzeit Tn = T1, beim PID in Reihenform (multiplikative Form Kp·(1+sTn)(1+sTv)/(sTn)) zusätzlich Vorhaltezeit Tv = T2. In der Parallelform Kp′(1 + 1/(sTn′) + sTv′) entspricht das Tn′ = T1 + T2, Tv′ = T1·T2/(T1 + T2) und Kp′ = (T1 + T2)/(2·Ks·Tσ). Die Verstärkung wird so gewählt, dass der geschlossene Kreis wie ein PT2 mit D = 1/√2 antwortet: Kp = T1/(2·Ks·Tσ) (PI bzw. Reihenform). Das ergibt 4,3 % Überschwingen und eine Anregelzeit von ca. 4,7·Tσ.',
        'Symmetrisches Optimum (SO): Gedacht für Strecken mit Integrator, Kis/(s(1+sTσ)), mit PI-Regler. Der Phasengang des offenen Kreises ist symmetrisch zur Durchtrittsfrequenz ω_D = 1/(a·Tσ) und hat dort sein Maximum; die Ecken 1/Tn und 1/Tσ liegen gleich weit links und rechts davon (logarithmisch). Standard a = 2: Tn = a²·Tσ = 4·Tσ, Kp = 1/(a·Kis·Tσ). Das gibt eine Phasenreserve von etwa 37° und gute Störunterdrückung. Das Überschwingen auf den Sollwertsprung ist groß (ca. 43 %) und lässt sich mit einem Sollwertfilter mit Zeitkonstante Tn auf ca. 8 % senken.',
        'Ziegler-Nichols (Schwingversuch): Verstärkung am P-Regler erhöhen, bis der Kreis gerade dauerhaft schwingt (K_krit, Periodendauer T_krit). Der PID-Regler wird auf Kp = 0,6·K_krit, Tn = 0,5·T_krit, Tv = 0,125·T_krit gesetzt. Ziegler-Nichols (Sprungantwort) und Chien-Hrones-Reswick (CHR) arbeiten mit Streckenkennwerten aus der Wendetangente der Sprungantwort: Ks, Verzugszeit Tu und Ausgleichszeit Tg. CHR unterscheidet zwischen Führungs- und Störverhalten und zwischen aperiodischem Verlauf (0 %) und 20 % Überschwingen.',
        'Die Regeln sind Faustformeln. Ziegler-Nichols ist bewusst scharf und schwingt oft stark nach, CHR (0 %) ist ruhig. Entscheidend ist, was gewünscht wird: schnell ausregeln, Sollwertsprünge ohne Überschwingen oder Störungen schnell ausgleichen. Das Vergleichs-Diagramm zeigt die Wirkung.'
      ],
      merke: ['BO (PI; PID in Reihenform mit Tv = T2): Tn = T1, Kp = T1/(2·Ks·Tσ), Überschwingen 4,3 %.', 'SO: Tn = 4·Tσ, Kp = 1/(2·Kis·Tσ), φ_R ≈ 37°.', 'ZN Schwingversuch (PID): 0,6·K_krit, 0,5·T_krit, 0,125·T_krit.']
    },
    {
      id: 6, tab: 'Digital', title: 'Digitale Regelung: Abtastzeit, z-Transformation, Phasenreserve',
      lead: 'Ein digitaler Regler sieht die Strecke nur zu Abtastzeitpunkten und hält seinen Ausgangswert dazwischen konstant. Das verzögert die Rückführung und kostet Phasenreserve.',
      parts: [
        'Aus dem Zeitverlauf wird eine Folge von Werten im Abstand Ts. Statt der Variable s verwendet man z: z = e^(s·Ts). Ein Pol bei s = −σ ± jω liegt in der z-Ebene bei |z| = e^(−σ·Ts) und dem Winkel ω·Ts. Die linke s-Halbebene wird so zum Inneren des Einheitskreises: Stabil ist ein System, wenn alle Pole in z betragsmäßig kleiner als 1 sind.',
        'Ein PT1 mit Halteglied ergibt die Pulsübertragungsfunktion G(z) = Ks·(1 − a)/(z − a) mit a = e^(−Ts/T). Die zugehörige Differenzengleichung y[k] = a·y[k−1] + Ks(1 − a)·u[k−1] liefert an den Abtastzeitpunkten exakt die Werte der kontinuierlichen Sprungantwort. Die Tustin-Näherung ersetzt s durch (2/Ts)(z−1)/(z+1) und kommt ohne e-Funktion aus, liefert aber leicht abweichende Pole.',
        'Warum Abtastung Phase kostet: Das Halteglied wirkt im Mittel wie eine Totzeit von Ts/2, jede zusätzliche Rechen- oder Ausgabeverzögerung um einen Takt kommt mit Ts dazu. Ein Verzug Teff senkt die Phasenreserve um ω_D·Teff (im Bogenmaß), der Betrag und damit ω_D bleiben unverändert. Als Faustregel soll ω_D·Ts klein bleiben (grob unter 0,1 bis 0,3), sonst ist die Stabilität in Gefahr.',
        'Die Abtastfrequenz fs muss mehr als doppelt so groß sein wie die höchste Signalfrequenz. Höhere Frequenzen klappen als Alias-Frequenz zurück: f_alias = |f − n·fs| mit n so gewählt, dass das Ergebnis unter fs/2 liegt.'
      ],
      merke: ['z = e^(s·Ts). Stabil, wenn alle Pole in z innerhalb des Einheitskreises liegen.', 'Phasenverlust Abtastung: ω_D·(Ts/2 + Rechenverzug).', 'Alias: f_alias = |f − n·fs|.']
    }
  ];

  /* ===================================================================== Aufgaben */
  const CHOICE_STAB = ['stabil', 'grenzstabil', 'instabil'];
  const stabIdx = cls => CHOICE_STAB.indexOf(cls);
  const T = [];
  const add = t => { T.push(t); };

  /* ----------------------------------------------------------- Block 1 */
  add({
    id: '1-01', block: 1, level: 1, title: 'PT1: Ausregelzeit', kind: 'num', unit: 's', tol: { rel: 0.03 }, p: { K: 2.5, T: 0.4 },
    text: p => `Eine Strecke verhält sich wie ein PT1-Glied mit K = ${f(p.K, 1)} und T = ${f(p.T, 1)} s. Nach welcher Zeit bleibt die Sprungantwort dauerhaft im Band von ±5 % um den Endwert?`,
    calc: (R, p) => { const G = R.pt1(p.K, p.T), r = R.stepResponse(G, { tEnd: 10 * p.T }); const i = R.stepInfo(r, { yFinal: R.dcGain(G) }); return { answer: i.tSettle5, v: { yEnd: i.yEnd } }; },
    tips: (p, v) => ['Die Antwort eines PT1-Gliedes ist y(t) = K·(1 − e^(−t/T)). Das Band ±5 % heißt: Der Rest zum Endwert ist nur noch 5 % des Endwerts.', 'Setze e^(−t/T) = 0,05 und löse nach t auf: t = −T·ln(0,05).', `−ln(0,05) = ${f(-Math.log(0.05), 3)}, also t = ${f(-Math.log(0.05), 3)} · ${f(p.T, 1)} s.`],
    steps: (p, v, a) => ['y(t) = K·(1 − e^(−t/T)), Endwert K·1 = ' + f(v.yEnd, 2) + '.', 'Band erreicht, wenn e^(−t/T) = 0,05.', 't = −T·ln(0,05) = ' + f(-Math.log(0.05), 3) + ' · ' + f(p.T, 1) + ' s = ' + f(a, 3) + ' s (Faustregel 3·T).']
  });
  add({
    id: '1-02', block: 1, level: 1, title: 'PT1: Lage des Pols', kind: 'num', unit: '1/s', tol: { rel: 0.02 }, p: { K: 3, T: 0.25 },
    text: p => `Gegeben ist G(s) = ${f(p.K, 0)} / (1 + ${f(p.T, 2)}·s). Wo liegt der Pol auf der reellen Achse (Realteil in 1/s)?`,
    calc: (R, p) => { const pl = R.tfPoles(R.pt1(p.K, p.T)); return { answer: pl[0].re, v: { n: pl.length } }; },
    tips: p => ['Der Pol ist die Nullstelle des Nenners.', '1 + T·s = 0 nach s auflösen.', `s = −1/T = −1/${f(p.T, 2)} s.`],
    steps: (p, v, a) => ['Nenner gleich null setzen: 1 + ' + f(p.T, 2) + '·s = 0.', 's = −1/' + f(p.T, 2) + ' = ' + f(a, 2) + ' 1/s.', 'Der Pol liegt links der Achse, das System ist stabil.']
  });
  add({
    id: '1-03', block: 1, level: 2, title: 'PT2: Überschwingen', kind: 'num', unit: '%', tol: { abs: 0.5 }, p: { K: 1.5, w0: 10, D: 0.3 },
    text: p => `Ein PT2-Glied hat K = ${f(p.K, 1)}, ω0 = ${f(p.w0, 0)} 1/s und die Dämpfung D = ${f(p.D, 1)}. Wie groß ist das Überschwingen der Sprungantwort in Prozent des Endwerts?`,
    calc: (R, p) => { const G = R.pt2(p.K, p.w0, p.D), r = R.stepResponse(G, { n: 6000 }); const i = R.stepInfo(r, { yFinal: p.K }); return { answer: i.overshootPct, v: { yMax: i.yMax, yEnd: i.yEnd, tPeak: i.tPeak } }; },
    tips: p => ['Das Überschwingen hängt nur von der Dämpfung D ab, nicht von K und ω0.', 'Formel: ü = e^(−π·D/√(1−D²)) · 100 %.', `√(1−D²) = ${f(Math.sqrt(1 - p.D * p.D), 4)}, π·D/√(1−D²) = ${f(Math.PI * p.D / Math.sqrt(1 - p.D * p.D), 4)}.`],
    steps: (p, v, a) => ['Nur D zählt: √(1−D²) = ' + f(Math.sqrt(1 - p.D * p.D), 4) + '.', 'Exponent: π·D/√(1−D²) = ' + f(Math.PI * p.D / Math.sqrt(1 - p.D * p.D), 4) + '.', 'ü = e^(−Exponent) = ' + f(a / 100, 4) + ' = ' + f(a, 2) + ' %. Kontrolle aus der Simulation: größter Wert ' + f(v.yMax, 3) + ' bei Endwert ' + f(v.yEnd, 3) + '.']
  });
  add({
    id: '1-04', block: 1, level: 2, title: 'PT2: Imaginärteil der Pole', kind: 'num', unit: '1/s', tol: { rel: 0.02 }, p: { K: 2, w0: 5, D: 0.6 },
    text: p => `Ein PT2-Glied hat K = ${f(p.K, 0)}, ω0 = ${f(p.w0, 0)} 1/s und D = ${f(p.D, 1)}. Wie groß ist der Imaginärteil (positiver Wert) der beiden Pole?`,
    calc: (R, p) => { const pl = R.tfPoles(R.pt2(p.K, p.w0, p.D)); return { answer: Math.max(...pl.map(z => z.im)), v: { re: pl[0].re } }; },
    tips: p => ['Der Nenner ist s² + 2·D·ω0·s + ω0². Bei D < 1 sind die Pole komplex konjugiert.', 'Pole: s = −D·ω0 ± j·ω0·√(1 − D²).', `D·ω0 = ${f(p.D * p.w0, 2)}, √(1−D²) = ${f(Math.sqrt(1 - p.D * p.D), 2)}.`],
    steps: (p, v, a) => ['Realteil: −D·ω0 = ' + f(v.re, 2) + ' 1/s.', 'Imaginärteil: ω0·√(1−D²) = ' + f(p.w0, 0) + ' · ' + f(Math.sqrt(1 - p.D * p.D), 2) + ' = ' + f(a, 2) + ' 1/s.', 'Probe: |s| = √(Re²+Im²) = ' + f(Math.hypot(v.re, a), 2) + ' = ω0.']
  });
  add({
    id: '1-05', block: 1, level: 2, title: 'PT2: Anregelzeit', kind: 'num', unit: 's', tol: { rel: 0.03 }, p: { w0: 8, D: 0.5 },
    text: p => `Ein PT2-Glied (K = 1) hat ω0 = ${f(p.w0, 0)} 1/s und D = ${f(p.D, 1)}. Nach welcher Zeit erreicht die Sprungantwort den Endwert zum ersten Mal (Anregelzeit)?`,
    calc: (R, p) => { const r = R.stepResponse(R.pt2(1, p.w0, p.D), { n: 6000 }); const i = R.stepInfo(r, { yFinal: 1 }); return { answer: i.tRise, v: { tPeak: i.tPeak } }; },
    tips: p => ['Beim PT2 gilt y(t) = 1 − e^(−D·ω0·t)/√(1−D²)·sin(ω_d·t + φ) mit φ = arccos D und ω_d = ω0·√(1−D²).', 'Den Endwert erreicht die Kurve zum ersten Mal, wenn ω_d·t + φ = π ist.', `φ = ${f(Math.acos(p.D), 4)} rad, ω_d = ${f(p.w0 * Math.sqrt(1 - p.D * p.D), 3)} 1/s.`],
    steps: (p, v, a) => ['ω_d = ω0·√(1−D²) = ' + f(p.w0 * Math.sqrt(1 - p.D * p.D), 3) + ' 1/s, φ = arccos(D) = ' + f(Math.acos(p.D), 4) + ' rad.', 't_an = (π − φ)/ω_d = ' + f(Math.PI - Math.acos(p.D), 4) + ' / ' + f(p.w0 * Math.sqrt(1 - p.D * p.D), 3) + ' s = ' + f(a, 4) + ' s.', 'Der Gipfel folgt später bei π/ω_d = ' + f(v.tPeak, 3) + ' s.']
  });
  add({
    id: '1-06', block: 1, level: 1, title: 'Integrator: Zeit bis zum Zielwert', kind: 'num', unit: 's', tol: { rel: 0.02 }, p: { Ki: 0.8, u: 2.5, yEnd: 10 },
    text: p => `Ein Integrator hat K_I = ${f(p.Ki, 1)} 1/s. Am Eingang liegt ein Sprung der Höhe ${f(p.u, 1)}. Nach welcher Zeit erreicht der Ausgang den Wert ${f(p.yEnd, 0)}?`,
    calc: (R, p) => { const r = R.stepResponse(R.integrator(p.Ki), { amp: p.u, tEnd: 4 * p.yEnd / (p.Ki * p.u), n: 4000 }); return { answer: R.timeAtLevel(r, p.yEnd), v: {} }; },
    tips: p => ['Ein Integrator summiert den Eingang auf: y(t) = K_I · ∫u dt. Bei konstantem Eingang entsteht eine Rampe.', 'y(t) = K_I · u · t.', `Steigung der Rampe: K_I·u = ${f(p.Ki * p.u, 2)} je Sekunde.`],
    steps: (p, v, a) => ['y(t) = K_I·u·t = ' + f(p.Ki * p.u, 2) + ' · t.', 't = y/(K_I·u) = ' + f(p.yEnd, 0) + ' / ' + f(p.Ki * p.u, 2) + ' = ' + f(a, 2) + ' s.']
  });
  add({
    id: '1-07', block: 1, level: 3, title: 'Totzeit-Padé: Nullstelle', kind: 'num', unit: '1/s', tol: { rel: 0.02 }, p: { Tt: 0.6 },
    text: p => `Die Totzeit e^(−s·Tt) mit Tt = ${f(p.Tt, 1)} s wird durch das Padé-Glied 1. Ordnung (1 − s·Tt/2)/(1 + s·Tt/2) ersetzt. Bei welchem Wert s (reell, mit Vorzeichen, in 1/s) liegt dessen Nullstelle?`,
    calc: (R, p) => { const pc = R.padeCoeffs(1, p.Tt), z = R.roots(pc.num), pl = R.roots(pc.den); return { answer: z[0].re, v: { pole: pl[0].re } }; },
    tips: p => ['Die Nullstelle ist der Wert, bei dem der Zähler null wird.', '1 − s·Tt/2 = 0 nach s auflösen.', `s = 2/Tt = 2/${f(p.Tt, 1)} s. Das Vorzeichen ist positiv: Die Nullstelle liegt rechts der Achse.`],
    steps: (p, v, a) => ['Zähler 1 − s·Tt/2 = 0 ergibt s = 2/Tt = ' + f(a, 3) + ' 1/s.', 'Der Pol des Nenners liegt bei −2/Tt = ' + f(v.pole, 3) + ' 1/s (spiegelbildlich, links).', 'Eine Nullstelle rechts heißt nicht minimalphasig: Bei der Padé-Näherung geht die Antwort deshalb zuerst in die falsche Richtung.']
  });
  add({
    id: '1-08', block: 1, level: 2, title: 'PT1 mit Totzeit: 90 %-Zeit', kind: 'num', unit: 's', tol: { rel: 0.02 }, p: { K: 1, T: 2, Tt: 1 },
    text: p => `Eine Strecke ist ein PT1-Glied (K = ${f(p.K, 0)}, T = ${f(p.T, 0)} s) mit Totzeit Tt = ${f(p.Tt, 0)} s. Nach welcher Zeit erreicht die Sprungantwort 90 % des Endwerts?`,
    calc: (R, p) => { const r = R.stepResponse(R.withDelay(R.pt1(p.K, p.T), p.Tt), { tEnd: 12 * p.T + 2 * p.Tt, n: 6000 }); return { answer: R.timeAtLevel(r, 0.9 * p.K), v: {} }; },
    tips: p => ['Die Totzeit verschiebt die PT1-Antwort einfach nach rechts: y(t) = K·(1 − e^(−(t−Tt)/T)) für t > Tt.', '90 % heißt: e^(−(t−Tt)/T) = 0,1.', `(t − Tt) = T·ln 10 = ${f(p.T * Math.log(10), 3)} s.`],
    steps: (p, v, a) => ['Nach der Totzeit gilt (t − Tt) = −T·ln(0,1) = ' + f(p.T * Math.log(10), 3) + ' s.', 't = Tt + T·ln 10 = ' + f(p.Tt, 0) + ' s + ' + f(p.T * Math.log(10), 3) + ' s = ' + f(a, 3) + ' s.']
  });
  add({
    id: '1-09', block: 1, level: 2, title: 'Pole prüfen: stabil?', kind: 'choice', options: CHOICE_STAB, tol: {}, p: { a: 0.5, w: 3 },
    text: p => `Der Nenner einer Strecke lautet (s + 2)·(s² − s + ${f(p.a * p.a + p.w * p.w, 2)}). Wie ist das Verhalten des Systems?`,
    calc: (R, p) => { const den = R.pmul([1, 2], [1, -2 * p.a, p.a * p.a + p.w * p.w]); const pl = R.roots(den); const st = R.stabilityOfPoles(pl); return { answer: stabIdx(st.cls), v: { pl: pl } }; },
    tips: p => ['Prüfe den Realteil jedes Pols. Der Faktor (s + 2) ist leicht. Für den quadratischen Faktor s² + b·s + c brauchst du die Mitternachtsformel.', 'Für s² − s + ' + f(p.a * p.a + p.w * p.w, 2) + ': s = (1 ± √(1 − ' + f(4 * (p.a * p.a + p.w * p.w), 0) + '))/2.', 'Der Realteil der Pole des quadratischen Faktors ist −b/2 = ' + f(p.a, 1) + '. Liegt ein Pol rechts der Achse, ist das System instabil.'],
    steps: (p, v) => ['(s + 2) = 0 ergibt s = −2 (links).', 's² − s + ' + f(p.a * p.a + p.w * p.w, 2) + ' = 0 ergibt s = ' + f(p.a, 1) + ' ± j·' + f(p.w, 0) + ' (Realteil positiv, also rechts).', 'Ein Pol rechts der Imaginärachse: instabil. Die Antwort schwingt mit wachsender Amplitude.']
  });
  add({
    id: '1-10', block: 1, level: 2, title: 'DT1: Sprunghöhe', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { Kd: 0.2, T1: 0.05 },
    text: p => `Ein D-Glied mit Verzögerung hat G(s) = K_D·s/(1 + T1·s) mit K_D = ${f(p.Kd, 1)} s und T1 = ${f(p.T1, 2)} s. Eingangssprung der Höhe 1. Wie groß ist der Ausgangswert unmittelbar nach dem Sprung (t = 0+)?`,
    calc: (R, p) => { const r = R.stepResponse(R.dt1(p.Kd, p.T1), { n: 2000 }); return { answer: r.y[0], v: { late: r.y[r.y.length - 1] } }; },
    tips: p => ['Der Anfangswert folgt aus dem Grenzwertsatz: y(0+) = lim s→∞ von s·G(s)·(1/s).', 'Für s → ∞ gilt K_D·s/(1 + T1·s) → K_D/T1.', `K_D/T1 = ${f(p.Kd, 1)}/${f(p.T1, 2)}.`],
    steps: (p, v, a) => ['y(0+) = lim G(s) für s → ∞ = K_D/T1 = ' + f(p.Kd, 1) + ' / ' + f(p.T1, 2) + ' = ' + f(a, 2) + '.', 'Danach klingt die Antwort mit e^(−t/T1) auf null ab (Endwert 0).']
  });

  /* ----------------------------------------------------------- Block 2 */
  add({
    id: '2-01', block: 2, level: 1, title: 'PT1: Eckfrequenz in Hz', kind: 'num', unit: 'Hz', tol: { rel: 0.02 }, p: { T: 0.02 },
    text: p => `Ein PT1-Glied hat die Zeitkonstante T = ${f(p.T * 1000, 0)} ms. Welche Eckfrequenz f_E hat sein Bode-Diagramm?`,
    calc: (R, p) => { const a = R.bodeAsymptotes(R.pt1(1, p.T)); return { answer: a.corners[0].w / (2 * Math.PI), v: { wE: a.corners[0].w } }; },
    tips: p => ['Die Eckfrequenz liegt dort, wo ω·T = 1 ist.', 'ω_E = 1/T, dann in Hz umrechnen: f = ω/(2π).', `ω_E = 1/${f(p.T, 3)} s.`],
    steps: (p, v, a) => ['ω_E = 1/T = ' + f(v.wE, 1) + ' 1/s.', 'f_E = ω_E/(2π) = ' + f(a, 3) + ' Hz.']
  });
  add({
    id: '2-02', block: 2, level: 1, title: 'PT1: Pegel an der Ecke', kind: 'num', unit: 'dB', tol: { abs: 0.15 }, p: { K: 5, T: 0.02 },
    text: p => `PT1-Glied mit K = ${f(p.K, 0)} und T = ${f(p.T * 1000, 0)} ms. Welchen Betrag (in dB) hat der Frequenzgang bei der Eckfrequenz ω_E = 1/T?`,
    calc: (R, p) => { const F = R.factors(R.pt1(p.K, p.T)); return { answer: R.respAt(F, 1 / p.T).db, v: { kdb: 20 * Math.log10(p.K) } }; },
    tips: p => ['Bei tiefen Frequenzen gilt 20·lg K. An der Ecke liegt der echte Verlauf 3 dB darunter.', '|G| = K/√(1 + (ωT)²), bei ωT = 1 also K/√2.', `20·lg ${f(p.K, 0)} = ${f(20 * Math.log10(p.K), 2)} dB.`],
    steps: (p, v, a) => ['Tiefe Frequenzen: 20·lg K = ' + f(v.kdb, 2) + ' dB.', 'An der Ecke: −20·lg √2 = −3,01 dB.', 'Ergebnis: ' + f(v.kdb, 2) + ' dB − 3,01 dB = ' + f(a, 2) + ' dB.']
  });
  add({
    id: '2-03', block: 2, level: 1, title: 'PT1: Phase', kind: 'num', unit: '°', tol: { abs: 1 }, p: { T: 0.05, w: 60 },
    text: p => `PT1-Glied mit T = ${f(p.T, 2)} s. Welche Phase (in Grad, negativ) hat der Frequenzgang bei ω = ${f(p.w, 0)} 1/s?`,
    calc: (R, p) => ({ answer: R.respAt(R.factors(R.pt1(1, p.T)), p.w).ph, v: { wT: p.w * p.T } }),
    tips: p => ['Die Phase eines PT1-Gliedes ist −arctan(ω·T).', 'Zuerst das Produkt ω·T bilden.', `ω·T = ${f(p.w * p.T, 2)}, arctan davon im Gradmaß.`],
    steps: (p, v, a) => ['ω·T = ' + f(p.w, 0) + ' · ' + f(p.T, 2) + ' = ' + f(v.wT, 2) + '.', 'φ = −arctan(' + f(v.wT, 2) + ') = ' + f(a, 2) + '°.']
  });
  add({
    id: '2-04', block: 2, level: 2, title: 'Asymptote eines PT1', kind: 'num', unit: 'dB', tol: { abs: 0.3 }, p: { K: 40, T: 0.05, w: 200 },
    text: p => `PT1-Glied mit K = ${f(p.K, 0)} und T = ${f(p.T, 2)} s. Welchen Pegel in dB hat die Asymptote (Geradenstück) bei ω = ${f(p.w, 0)} 1/s?`,
    calc: (R, p) => { const A = R.bodeAsymptotes(R.pt1(p.K, p.T)); return { answer: A.db(p.w), v: { wE: 1 / p.T, kdb: 20 * Math.log10(p.K) } }; },
    tips: p => ['Die Asymptote ist waagerecht bis zur Eckfrequenz und fällt dann mit −20 dB je Dekade.', 'Eckfrequenz bestimmen: ω_E = 1/T. Dann das Frequenzverhältnis ω/ω_E bilden.', `ω_E = ${f(1 / p.T, 0)} 1/s, Verhältnis ${f(p.w * p.T, 0)} = ${f(Math.log10(p.w * p.T), 2)} Dekaden.`],
    steps: (p, v, a) => ['Bis ω_E = ' + f(v.wE, 0) + ' 1/s: ' + f(v.kdb, 2) + ' dB.', 'Darüber −20 dB je Dekade, hier ' + f(Math.log10(p.w * p.T), 2) + ' Dekaden: −' + f(20 * Math.log10(p.w * p.T), 2) + ' dB.', 'Asymptote: ' + f(v.kdb, 2) + ' − ' + f(20 * Math.log10(p.w * p.T), 2) + ' = ' + f(a, 2) + ' dB.']
  });
  add({
    id: '2-05', block: 2, level: 2, title: 'PT2: Resonanzüberhöhung', kind: 'num', unit: 'dB', tol: { abs: 0.2 }, p: { w0: 3, D: 0.2 },
    text: p => `Ein PT2-Glied (K = 1) hat ω0 = ${f(p.w0, 0)} 1/s und D = ${f(p.D, 1)}. Wie hoch liegt das Maximum des Betragsverlaufs über 0 dB?`,
    calc: (R, p) => { const pk = R.resonancePeak(R.pt2(1, p.w0, p.D)); return { answer: pk.db, v: { wr: pk.w } }; },
    tips: p => ['Bei kleiner Dämpfung hebt sich der Betrag im Bereich ω0 heraus. Die Spitze ist 1/(2·D·√(1−D²)).', 'Das Verhältnis in dB umrechnen: 20·lg(Verhältnis).', `2·D·√(1−D²) = ${f(2 * p.D * Math.sqrt(1 - p.D * p.D), 4)}.`],
    steps: (p, v, a) => ['Überhöhung: 1/(2·D·√(1−D²)) = 1/' + f(2 * p.D * Math.sqrt(1 - p.D * p.D), 4) + ' = ' + f(1 / (2 * p.D * Math.sqrt(1 - p.D * p.D)), 4) + '.', 'In dB: 20·lg(...) = ' + f(a, 2) + ' dB, bei ω = ' + f(v.wr, 3) + ' 1/s (knapp unter ω0).']
  });
  add({
    id: '2-06', block: 2, level: 3, title: 'Asymptotenpegel I-PT1-PT1', kind: 'num', unit: 'dB', tol: { abs: 0.3 }, p: { K: 100, T1: 0.1, T2: 0.001, w: 100 },
    text: p => `G(s) = ${f(p.K, 0)} / [ s·(1 + ${f(p.T1, 1)}·s)·(1 + ${f(p.T2, 3)}·s) ]. Welchen Pegel in dB hat die Asymptote bei ω = ${f(p.w, 0)} 1/s?`,
    calc: (R, p) => { const A = R.bodeAsymptotes(R.itn(p.K, [p.T1, p.T2])); return { answer: A.db(p.w), v: { c: A.corners.map(c => c.w) } }; },
    tips: p => ['Zuerst die Eckfrequenzen der beiden PT1 bestimmen und die Steigung abschnittsweise verfolgen. Der Integrator beginnt mit −20 dB/Dek.', `Eckfrequenzen: 1/T1 = ${f(1 / p.T1, 0)} 1/s, 1/T2 = ${f(1 / p.T2, 0)} 1/s. Bei ω = ${f(p.w, 0)} 1/s ist nur die erste überschritten.`, `Für ω < 1/T1 gilt K/ω. Bei ω = 1/T1 = ${f(1 / p.T1, 0)}: 20·lg(${f(p.K, 0)}/${f(1 / p.T1, 0)}) = ${f(20 * Math.log10(p.K * p.T1), 1)} dB; danach −40 dB/Dek.`],
    steps: (p, v, a) => ['Bis ω = ' + f(1 / p.T1, 0) + ': G ≈ K/ω, bei ω = ' + f(1 / p.T1, 0) + ' also ' + f(20 * Math.log10(p.K * p.T1), 2) + ' dB.', 'Zwischen ' + f(1 / p.T1, 0) + ' und ' + f(1 / p.T2, 0) + ': −40 dB/Dek.; ' + f(Math.log10(p.w * p.T1), 2) + ' Dekaden ergeben −' + f(40 * Math.log10(p.w * p.T1), 2) + ' dB.', 'Pegel: ' + f(20 * Math.log10(p.K * p.T1), 2) + ' − ' + f(40 * Math.log10(p.w * p.T1), 2) + ' = ' + f(a, 2) + ' dB.']
  });
  add({
    id: '2-07', block: 2, level: 2, title: 'Totzeit: Phase', kind: 'num', unit: '°', tol: { abs: 1 }, p: { f: 50, Tt: 0.005 },
    text: p => `Ein Signal mit f = ${f(p.f, 0)} Hz durchläuft eine reine Totzeit von ${f(p.Tt * 1000, 0)} ms. Wie groß ist die Phase des Frequenzgangs in Grad (negativ)?`,
    calc: (R, p) => ({ answer: R.respAt(R.factors(R.tf([1], [1], p.Tt)), 2 * Math.PI * p.f).ph, v: { w: 2 * Math.PI * p.f } }),
    tips: p => ['Die Totzeit verzögert das Signal um Tt. Eine volle Periode entspricht 360°.', 'φ = −ω·Tt (im Bogenmaß) oder φ = −360° · f · Tt.', `f·Tt = ${f(p.f * p.Tt, 3)} Perioden.`],
    steps: (p, v, a) => ['ω = 2π·f = ' + f(v.w, 2) + ' 1/s.', 'φ = −ω·Tt = −' + f(v.w * p.Tt, 4) + ' rad = ' + f(a, 2) + '°. Der Betrag bleibt 0 dB.']
  });
  add({
    id: '2-08', block: 2, level: 2, title: 'Durchtrittsfrequenz I-PT1', kind: 'num', unit: '1/s', tol: { rel: 0.02 }, p: { K: 20, T: 0.1 },
    text: p => `Ein Kreis hat L(s) = ${f(p.K, 0)} / [ s·(1 + ${f(p.T, 1)}·s) ]. Bei welcher Kreisfrequenz ω_D schneidet |L| die 0-dB-Linie?`,
    calc: (R, p) => { const m = R.margins(R.tf([p.K], R.pmul([1, 0], [p.T, 1]))); return { answer: m.wc, v: { pm: m.pm } }; },
    tips: p => ['Gesucht ist |L(jω)| = 1.', '|L| = K/(ω·√(1 + (ωT)²)) = 1 führt auf eine Gleichung in ω².', `Mit x = ω²: ${f(p.T * p.T, 3)}·x² + x − ${f(p.K * p.K, 0)} = 0.`],
    steps: (p, v, a) => ['K² = ω²·(1 + T²ω²) mit x = ω²: ' + f(p.T * p.T, 3) + '·x² + x − ' + f(p.K * p.K, 0) + ' = 0.', 'x = (−1 + √(1 + 4·' + f(p.T * p.T, 3) + '·' + f(p.K * p.K, 0) + '))/(2·' + f(p.T * p.T, 3) + ') = ' + f(a * a, 2) + '.', 'ω_D = √x = ' + f(a, 3) + ' 1/s.']
  });
  add({
    id: '2-09', block: 2, level: 2, title: 'PT2: Phase bei ω0', kind: 'num', unit: '°', tol: { abs: 1 }, p: { w0: 50, D: 0.4 },
    text: p => `PT2-Glied mit ω0 = ${f(p.w0, 0)} 1/s und D = ${f(p.D, 1)}. Welche Phase hat der Frequenzgang bei ω = ω0 (in Grad, mit Vorzeichen)?`,
    calc: (R, p) => ({ answer: R.respAt(R.factors(R.pt2(1, p.w0, p.D)), p.w0).ph, v: {} }),
    tips: p => ['Setze s = jω in den Nenner und beachte: bei ω = ω0 fällt etwas Entscheidendes weg.', 'Nenner: ω0² − ω² + j·2·D·ω0·ω.', 'Bei ω = ω0 ist der Realteil des Nenners null, der Nenner also rein imaginär (positiv).'],
    steps: (p, v, a) => ['Nenner bei ω = ω0: (ω0² − ω0²) + j·2·D·ω0² = j·2·D·ω0².', 'Rein imaginär, also +90° im Nenner und damit −90° für G.', 'Ergebnis: ' + f(a, 1) + '°, unabhängig von D.']
  });

  /* ----------------------------------------------------------- Block 3 */
  add({
    id: '3-01', block: 3, level: 2, title: 'Kritische Verstärkung PT3', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { T1: 1, T2: 0.5, T3: 0.2 },
    text: p => `Offener Kreis L(s) = K / [ (1 + ${f(p.T1, 1)}·s)(1 + ${f(p.T2, 1)}·s)(1 + ${f(p.T3, 1)}·s) ]. Bei welchem K schwingt der geschlossene Kreis ungedämpft (Stabilitätsgrenze)?`,
    calc: (R, p) => { const u = R.ultimate(R.ptn(1, [p.T1, p.T2, p.T3])); return { answer: u.Kcrit, v: { w: u.wcrit } }; },
    tips: p => ['Die Grenze liegt dort, wo der Betrag bei der Phase −180° genau 1 ist, oder man nutzt Hurwitz für das Nennerpolynom 1 + L.', 'Nenner ausmultiplizieren: a3·s³ + a2·s² + a1·s + a0 + K. Für Ordnung 3 gilt Stabilität, solange a2·a1 > a3·(a0 + K).', `a3 = ${f(p.T1 * p.T2 * p.T3, 3)}, a2 = ${f(p.T1 * p.T2 + p.T1 * p.T3 + p.T2 * p.T3, 2)}, a1 = ${f(p.T1 + p.T2 + p.T3, 2)}, a0 = 1.`],
    steps: (p, v, a) => { const a3 = p.T1 * p.T2 * p.T3, a2 = p.T1 * p.T2 + p.T1 * p.T3 + p.T2 * p.T3, a1 = p.T1 + p.T2 + p.T3; return ['Nenner: ' + f(a3, 3) + '·s³ + ' + f(a2, 2) + '·s² + ' + f(a1, 2) + '·s + 1 + K.', 'Grenze: a2·a1 = a3·(1 + K) ergibt K = ' + f(a2 * a1 / a3, 2) + ' − 1 = ' + f(a, 2) + '.', 'Dabei schwingt der Kreis mit ω = ' + f(v.w, 3) + ' 1/s.']; }
  });
  add({
    id: '3-02', block: 3, level: 2, title: 'Phasenreserve I-PT1', kind: 'num', unit: '°', tol: { abs: 0.5 }, p: { K: 5, T: 0.2 },
    text: p => `Offener Kreis L(s) = ${f(p.K, 0)} / [ s·(1 + ${f(p.T, 1)}·s) ]. Wie groß ist die Phasenreserve φ_R in Grad?`,
    calc: (R, p) => { const m = R.margins(R.tf([p.K], R.pmul([1, 0], [p.T, 1]))); return { answer: m.pm, v: { wc: m.wc } }; },
    tips: p => ['Erst die Durchtrittsfrequenz aus |L| = 1 bestimmen, dann die Phase dort auswerten.', 'Phase: −90° − arctan(ω·T). Phasenreserve: 180° + Phase.', `Durchtritt aus K² = ω²(1 + ω²T²). Der Rechenweg führt auf ω_D = ${f(Math.sqrt((-1 + Math.sqrt(1 + 4 * p.T * p.T * p.K * p.K)) / (2 * p.T * p.T)), 3)} 1/s.`],
    steps: (p, v, a) => ['ω_D = ' + f(v.wc, 3) + ' 1/s aus K² = ω²(1 + ω²T²).', 'Phase: −90° − arctan(' + f(v.wc * p.T, 3) + ') = ' + f(-90 - Math.atan(v.wc * p.T) * DEG, 2) + '°.', 'φ_R = 180° + (' + f(-90 - Math.atan(v.wc * p.T) * DEG, 2) + '°) = ' + f(a, 2) + '°.']
  });
  add({
    id: '3-03', block: 3, level: 2, title: 'Amplitudenreserve PT3', kind: 'num', unit: 'dB', tol: { abs: 0.2 }, p: { K: 3, T: 0.1 },
    text: p => `Offener Kreis L(s) = ${f(p.K, 0)} / (1 + ${f(p.T, 1)}·s)³. Wie groß ist die Amplitudenreserve in dB?`,
    calc: (R, p) => { const m = R.margins(R.ptn(p.K, [p.T, p.T, p.T])); return { answer: m.gmDb, v: { w: m.wpc } }; },
    tips: p => ['Die Phase −180° wird erreicht, wenn jeder der drei gleichen PT1 −60° beiträgt: arctan(ωT) = 60°.', 'Dort ist ω·T = √3 und der Betrag jedes Faktors 1/2. Betrag des Kreises: K/8.', `|L(jω_180)| = ${f(p.K, 0)}/8 = ${f(p.K / 8, 3)}.`],
    steps: (p, v, a) => ['ω_180 = √3/T = ' + f(v.w, 2) + ' 1/s (jede Stufe −60°).', '|L| = K/(√(1+3))³ = K/8 = ' + f(p.K / 8, 3) + '.', 'A_R = 20·lg(8/K) = ' + f(a, 2) + ' dB (Faktor ' + f(8 / p.K, 3) + ').']
  });
  add({
    id: '3-04', block: 3, level: 3, title: 'Vereinfachtes Nyquist: stabil?', kind: 'choice', options: CHOICE_STAB, tol: {}, p: { K: 150, T: [1, 0.1, 0.01] },
    text: p => `Offener Kreis L(s) = ${f(p.K, 0)} / [ (1 + ${f(p.T[0], 0)}·s)(1 + ${f(p.T[1], 1)}·s)(1 + ${f(p.T[2], 2)}·s) ], der Kreis wird mit Rückführung 1 geschlossen. Was sagt das vereinfachte Nyquist-Kriterium (offener Kreis stabil, ein Durchtritt)?`,
    calc: (R, p) => { const L = R.ptn(p.K, p.T), ns = R.nyquistSimple(L); const m = R.margins(L); return { answer: stabIdx(ns.stable ? 'stabil' : 'instabil'), v: { pm: m.pm, wc: m.wc, gm: m.gmDb } }; },
    tips: p => ['Das Kriterium (offener Kreis stabil, ein Durchtritt): geschlossen stabil genau dann, wenn die Phasenreserve positiv ist.', 'Bestimme ω_D aus |L| = 1 und prüfe, ob die Phase dort über −180° liegt (Summe dreier −arctan-Terme).', 'Alternativ: Hurwitz-Grenze K_krit = a2·a1/a3 − 1 für das Nennerpolynom, mit K vergleichen. Stabil, wenn K darunter liegt.'],
    steps: (p, v) => ['Durchtritt bei ω_D = ' + f(v.wc, 2) + ' 1/s.', 'Phasenreserve φ_R = ' + f(v.pm, 1) + '°, Amplitudenreserve ' + f(v.gm, 2) + ' dB.', v.pm > 0 ? 'φ_R > 0: stabil.' : 'φ_R < 0 (bzw. Amplitudenreserve negativ): der Kreis ist instabil.']
  });
  add({
    id: '3-05', block: 3, level: 3, title: 'Phasenreserve I-PT1-PT1', kind: 'num', unit: '°', tol: { abs: 0.7 }, p: { K: 10, T1: 0.1, T2: 0.02 },
    text: p => `Offener Kreis L(s) = ${f(p.K, 0)} / [ s·(1 + ${f(p.T1, 1)}·s)(1 + ${f(p.T2, 2)}·s) ]. Wie groß ist die Phasenreserve in Grad?`,
    calc: (R, p) => { const m = R.margins(R.itn(p.K, [p.T1, p.T2])); return { answer: m.pm, v: { wc: m.wc } }; },
    tips: (p, v) => ['Durchtrittsfrequenz numerisch bestimmen (Betrag = 1), dann die Phase dort aus den drei Anteilen addieren.', 'φ(ω) = −90° − arctan(ω·T1) − arctan(ω·T2).', 'Die Durchtrittsfrequenz liegt bei etwa ' + f(v.wc, 1) + ' 1/s; setze zur Kontrolle ein und verfeinere.'],
    steps: (p, v, a) => ['Durchtritt: |L(jω)| = 1 gibt ω_D = ' + f(v.wc, 3) + ' 1/s (numerisch).', 'Phase: −90° − ' + f(Math.atan(v.wc * p.T1) * DEG, 2) + '° − ' + f(Math.atan(v.wc * p.T2) * DEG, 2) + '° = ' + f(-90 - Math.atan(v.wc * p.T1) * DEG - Math.atan(v.wc * p.T2) * DEG, 2) + '°.', 'φ_R = 180° + Phase = ' + f(a, 2) + '°.']
  });
  add({
    id: '3-06', block: 3, level: 2, title: 'Größte zulässige Totzeit', kind: 'num', unit: 's', tol: { rel: 0.02 }, p: { K: 4 },
    text: p => `Ein Integrator L(s) = ${f(p.K, 0)}/s wird in einem Regelkreis betrieben. Wie groß darf die zusätzliche Totzeit Tt im Kreis höchstens werden, bis die Phasenreserve null ist?`,
    calc: (R, p) => { const m = R.margins(R.integrator(p.K)); return { answer: R.tdMax(m.pm, m.wc), v: { pm: m.pm, wc: m.wc } }; },
    tips: p => ['Die Totzeit senkt die Phase um ω_D·Tt (im Bogenmaß) und ändert ω_D nicht.', 'Der Integrator hat überall −90°, also φ_R = 90° = π/2. Durchtritt bei ω_D = K.', `Tt,max = (π/2)/ω_D = 1,5708/${f(p.K, 0)}.`],
    steps: (p, v, a) => ['ω_D = K = ' + f(v.wc, 2) + ' 1/s, φ_R = ' + f(v.pm, 1) + '° = ' + f(v.pm / DEG, 4) + ' rad.', 'Tt,max = φ_R/ω_D = ' + f(v.pm / DEG, 4) + ' / ' + f(v.wc, 2) + ' = ' + f(a, 4) + ' s.']
  });
  add({
    id: '3-07', block: 3, level: 2, title: 'Phasenreserve mit Totzeit', kind: 'num', unit: '°', tol: { abs: 0.6 }, p: { K: 4, Tt: 0.2 },
    text: p => `Offener Kreis L(s) = ${f(p.K, 0)}/s · e^(−${f(p.Tt, 1)}·s). Wie groß ist die Phasenreserve in Grad?`,
    calc: (R, p) => { const m = R.margins(R.withDelay(R.integrator(p.K), p.Tt)); return { answer: m.pm, v: { wc: m.wc } }; },
    tips: p => ['Die Totzeit ändert den Betrag nicht, also bleibt die Durchtrittsfrequenz die des Integrators: ω_D = K.', 'Phase bei ω_D: −90° − ω_D·Tt·(180°/π).', `ω_D·Tt = ${f(p.K * p.Tt, 2)} rad = ${f(p.K * p.Tt * DEG, 2)}°.`],
    steps: (p, v, a) => ['ω_D = ' + f(v.wc, 2) + ' 1/s (unverändert).', 'Totzeit-Phase: −ω_D·Tt = −' + f(p.K * p.Tt, 3) + ' rad = −' + f(p.K * p.Tt * DEG, 2) + '°.', 'φ_R = 180° − 90° − ' + f(p.K * p.Tt * DEG, 2) + '° = ' + f(a, 2) + '°.']
  });
  add({
    id: '3-08', block: 3, level: 3, title: 'Amplitudenreserve I-PT1-PT1', kind: 'num', unit: 'dB', tol: { abs: 0.25 }, p: { K: 6, T1: 0.1, T2: 0.05 },
    text: p => `Offener Kreis L(s) = ${f(p.K, 0)} / [ s·(1 + ${f(p.T1, 1)}·s)(1 + ${f(p.T2, 2)}·s) ]. Wie groß ist die Amplitudenreserve in dB?`,
    calc: (R, p) => { const m = R.margins(R.itn(p.K, [p.T1, p.T2])); return { answer: m.gmDb, v: { w: m.wpc } }; },
    tips: p => ['Gesucht ist die Frequenz ω_180 mit Phase −180°: arctan(ω·T1) + arctan(ω·T2) = 90°.', 'Das gilt genau für ω²·T1·T2 = 1. Dort den Betrag |L| ausrechnen.', `ω_180 = 1/√(T1·T2) = ${f(1 / Math.sqrt(p.T1 * p.T2), 3)} 1/s.`],
    steps: (p, v, a) => ['ω_180 = 1/√(T1·T2) = ' + f(v.w, 3) + ' 1/s.', '|L| = K/(ω·√(1 + ω²T1²)·√(1 + ω²T2²)) = ' + f(Math.pow(10, -a / 20), 4) + '.', 'A_R = −20·lg|L| = ' + f(a, 2) + ' dB (Faktor ' + f(Math.pow(10, a / 20), 2) + ').']
  });
  add({
    id: '3-09', block: 3, level: 3, title: 'Verstärkung für 45° Phasenreserve', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { T: 0.1, pm: 45 },
    text: p => `Offener Kreis L(s) = K / [ s·(1 + ${f(p.T, 1)}·s) ]. Wie groß muss K sein, damit die Phasenreserve ${f(p.pm, 0)}° beträgt?`,
    calc: (R, p) => {
      let lo = 0.1, hi = 1000;
      for (let i = 0; i < 80; i++) { const mid = Math.sqrt(lo * hi); const m = R.margins(R.tf([mid], R.pmul([1, 0], [p.T, 1]))); if (m.pm > p.pm) lo = mid; else hi = mid; }
      const K = Math.sqrt(lo * hi), m = R.margins(R.tf([K], R.pmul([1, 0], [p.T, 1]))); return { answer: K, v: { wc: m.wc, pm: m.pm } };
    },
    tips: p => ['Die Phase ist −90° − arctan(ω_D·T). Für φ_R = 45° muss arctan(ω_D·T) = 45° sein, also ω_D·T = 1.', 'Dann ω_D = 1/T. Und dort muss |L| = 1 gelten.', `|L(jω_D)| = K/(ω_D·√2) = 1 mit ω_D = ${f(1 / p.T, 0)} 1/s.`],
    steps: (p, v, a) => ['φ_R = 90° − arctan(ω_D·T) = 45° führt auf ω_D = 1/T = ' + f(1 / p.T, 0) + ' 1/s.', '|L| = K/(ω_D·√(1 + 1)) = 1, also K = ω_D·√2.', 'K = ' + f(1 / p.T, 0) + ' · 1,4142 = ' + f(a, 2) + '. Probe: φ_R = ' + f(v.pm, 2) + '°.']
  });

  /* ----------------------------------------------------------- Block 4 */
  const wokDen = rts => rts.reduce((p, r) => R.pmul(p, [1, -r]), [1]);
  add({
    id: '4-01', block: 4, level: 1, title: 'Wurzelort: Schwerpunkt', kind: 'num', unit: '1/s', tol: { abs: 0.05 }, p: { poles: [-1, -2, -3] },
    text: p => `L(s) = K / [ (s + 1)(s + 2)(s + 3) ] hat keine Nullstellen. Wo liegt der Schwerpunkt σ_S der Asymptoten auf der reellen Achse?`,
    calc: (R, p) => { const info = R.locusInfo([1], wokDen(p.poles)); return { answer: info.centroid, v: { n: info.nAsym } }; },
    tips: p => ['Der Schwerpunkt ist der gemeinsame Ausgangspunkt der Asymptoten.', 'σ_S = (Summe der Pole − Summe der Nullstellen)/(n − m).', 'n = 3 Pole, m = 0 Nullstellen; addiere die Polwerte.'],
    steps: (p, v, a) => ['Summe der Pole: ' + p.poles.map(x => f(x, 0)).join(' + ').replace(/\+ −/g, '− ') + ' = ' + f(p.poles.reduce((s, x) => s + x, 0), 0) + '.', 'σ_S = ' + f(p.poles.reduce((s, x) => s + x, 0), 0) + ' / ' + v.n + ' = ' + f(a, 2) + '.']
  });
  add({
    id: '4-02', block: 4, level: 2, title: 'Wurzelort: kritisches K', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { poles: [-1, -2, -3] },
    text: p => `L(s) = K / [ (s + 1)(s + 2)(s + 3) ]. Bei welchem K wandern zwei Pole des geschlossenen Kreises auf die imaginäre Achse?`,
    calc: (R, p) => { const info = R.locusInfo([1], wokDen(p.poles)); return { answer: info.kcrit, v: { w: info.wcrit } }; },
    tips: p => ['Der geschlossene Kreis hat den Nenner (s+1)(s+2)(s+3) + K. Ausmultiplizieren.', 's³ + 6·s² + 11·s + (6 + K). Für Ordnung 3 liegt die Stabilitätsgrenze bei a2·a1 = a3·a0.', '6·11 = 6 + K nach K auflösen.'],
    steps: (p, v, a) => ['Nenner: s³ + 6·s² + 11·s + 6 + K.', 'Grenze: 6 · 11 = 6 + K, also K = ' + f(a, 1) + '.', 'Dann ist s² = −11 gemäß dem Hilfspolynom 6·s² + 66 = 0.']
  });
  add({
    id: '4-03', block: 4, level: 2, title: 'Wurzelort: Frequenz der Grenzschwingung', kind: 'num', unit: '1/s', tol: { rel: 0.02 }, p: { poles: [-1, -2, -3] },
    text: p => `L(s) = K / [ (s + 1)(s + 2)(s + 3) ]. Mit welcher Kreisfrequenz ω_krit schwingt der geschlossene Kreis an der Stabilitätsgrenze?`,
    calc: (R, p) => { const info = R.locusInfo([1], wokDen(p.poles)); return { answer: info.wcrit, v: { K: info.kcrit } }; },
    tips: p => ['An der Grenze liegt ein Polpaar bei s = ±jω. Setze s = jω in s³ + 6·s² + 11·s + 6 + K = 0 ein.', 'Imaginärteil: −ω³ + 11·ω = 0; Realteil: −6·ω² + 6 + K = 0.', 'Aus dem Imaginärteil folgt ω² = 11.'],
    steps: (p, v, a) => ['Imaginärteil: −ω³ + 11·ω = 0 ergibt ω² = 11.', 'ω_krit = √11 = ' + f(a, 3) + ' 1/s (Realteil liefert dazu K = 6·11 − 6 = ' + f(v.K, 0) + ').']
  });
  add({
    id: '4-04', block: 4, level: 2, title: 'Wurzelort: Verzweigungspunkt', kind: 'num', unit: '1/s', tol: { abs: 0.05 }, p: { p1: -1, p2: -4 },
    text: p => `L(s) = K / [ (s + 1)(s + 4) ]. An welcher Stelle s auf der reellen Achse verlassen die beiden Äste die Achse (Verzweigungspunkt)?`,
    calc: (R, p) => { const info = R.locusInfo([1], R.pmul([1, -p.p1], [1, -p.p2])); return { answer: info.breakaway[0].s, v: { K: info.breakaway[0].K } }; },
    tips: p => ['Der Verzweigungspunkt liegt dort, wo K = −N(s)/Z(s) auf der reellen Achse ein Maximum hat.', 'Ableitung von (s+1)(s+4) = s² + 5·s + 4 nach s gleich null.', '2·s + 5 = 0.'],
    steps: (p, v, a) => ['K(s) = −(s² + 5·s + 4); Ableitung 2·s + 5 = 0.', 's = ' + f(a, 2) + ' (Mitte zwischen den beiden Polen).', 'Dort ist K = ' + f(v.K, 3) + '. Für größeres K wird das Polpaar komplex.']
  });
  add({
    id: '4-05', block: 4, level: 3, title: 'Wurzelort: K für Dämpfung 0,707', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { a: 4, D: Math.SQRT1_2 },
    text: p => `L(s) = K / [ s·(s + ${f(p.a, 0)}) ]. Bei welchem K hat das Polpaar des geschlossenen Kreises die Dämpfung D = 1/√2 ≈ 0,707?`,
    calc: (R, p) => { const K = R.locusKforDamping([1], [1, p.a, 0], p.D); const rs = R.locusRoots([1], [1, p.a, 0], K); return { answer: K, v: { re: rs[0].re, im: rs[0].im } }; },
    tips: p => ['Der geschlossene Kreis hat den Nenner s² + 4·s + K = s² + 2·D·ω0·s + ω0².', 'Vergleichen: ω0² = K und 2·D·ω0 = 4.', 'ω0 = 2/D, also K = 4/D².'],
    steps: (p, v, a) => ['ω0² = K, 2·D·ω0 = ' + f(p.a, 0) + ' ergibt ω0 = ' + f(p.a / (2 * p.D), 3) + ' 1/s.', 'K = ω0² = ' + f(a, 2) + '.', 'Probe: Pole −' + f(-v.re, 2) + ' ± j·' + f(Math.abs(v.im), 2) + ', Dämpfung ' + f(-v.re / Math.hypot(v.re, v.im), 4) + '.']
  });
  add({
    id: '4-06', block: 4, level: 2, title: 'Wurzelort: Punkt auf der Achse?', kind: 'choice', options: ['ja', 'nein'], tol: {}, p: { s: -2 },
    text: p => `L(s) = K·(s + 3) / [ s·(s + 1)(s + 5) ], K > 0. Liegt der Punkt s = −2 auf der Wurzelortskurve?`,
    calc: (R, p) => { const on = R.onLocusReal([1, 3], R.pmul(R.pmul([1, 0], [1, 1]), [1, 5]), p.s); return { answer: on ? 0 : 1, v: { K: R.locusKatReal([1, 3], R.pmul(R.pmul([1, 0], [1, 1]), [1, 5]), p.s) } }; },
    tips: p => ['Ein Punkt der reellen Achse liegt auf der Kurve, wenn rechts von ihm eine ungerade Anzahl von Polen und Nullstellen liegt.', 'Zähle Pole bei 0, −1, −5 und Nullstelle bei −3, die rechts von −2 liegen.', 'Rechts von −2 liegen die Pole bei 0 und −1, also zwei (gerade).'],
    steps: (p, v) => ['Rechts von s = −2 liegen: Pol bei 0, Pol bei −1 (zwei Stück).', 'Zwei ist gerade, also liegt der Punkt nicht auf der Kurve.', 'Gegenprobe: K = −N(s)/Z(s) ergibt ' + f(v.K, 3) + ', also negativ: gehört zum Fall K < 0.']
  });
  add({
    id: '4-07', block: 4, level: 1, title: 'Wurzelort: Zahl der Asymptoten', kind: 'num', unit: '', tol: { abs: 0.01 }, p: { n: 4, m: 1 },
    text: p => `L(s) = K·(s + 3) / [ s·(s + 1)(s + 5)(s + 8) ]. Wie viele Äste der Wurzelortskurve laufen für K → ∞ ins Unendliche?`,
    calc: (R, p) => { const D = R.pmul(R.pmul(R.pmul([1, 0], [1, 1]), [1, 5]), [1, 8]); const info = R.locusInfo([1, 3], D); return { answer: info.nAsym, v: { n: info.poles.length, m: info.zeros.length } }; },
    tips: p => ['Jeder Ast endet in einer Nullstelle oder im Unendlichen.', 'Anzahl ins Unendliche: n − m (Polzahl minus Nullstellenzahl).', 'Zähle die Pole im Nenner und die Nullstellen im Zähler.'],
    steps: (p, v, a) => ['Pole n = ' + v.n + ' (0, −1, −5, −8), Nullstellen m = ' + v.m + ' (−3).', 'Äste ins Unendliche: n − m = ' + a + '. Winkel: ' + Array.from({ length: a }, (_, k) => f((2 * k + 1) * 180 / a, 0) + '°').join(', ') + '.']
  });
  add({
    id: '4-08', block: 4, level: 3, title: 'Wurzelort: K für einen vorgegebenen Pol', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { s: -1 },
    text: p => `L(s) = K / [ s·(s + 2)(s + 4) ]. Bei welchem K liegt ein Pol des geschlossenen Kreises genau bei s = ${f(p.s, 0)}?`,
    calc: (R, p) => { const D = R.pmul(R.pmul([1, 0], [1, 2]), [1, 4]); return { answer: R.locusKatReal([1], D, p.s), v: { D: R.pevalR(D, p.s) } }; },
    tips: p => ['Ein Pol des geschlossenen Kreises löst 1 + L(s) = 0, also s(s+2)(s+4) + K = 0.', 'Setze s = −1 ein und löse nach K.', '(−1)·(1)·(3) + K = 0.'],
    steps: (p, v, a) => ['s(s+2)(s+4) bei s = ' + f(p.s, 0) + ': ' + f(v.D, 0) + '.', 'Nullsetzen: ' + f(v.D, 0) + ' + K = 0 ergibt K = ' + f(a, 0) + '.', 'Probe: Der Pol bei −1 liegt auf der reellen Achse zwischen 0 und −2, wo die Kurve verläuft.']
  });
  add({
    id: '4-09', block: 4, level: 2, title: 'Wurzelort: Polpaar bei gegebenem K', kind: 'num', unit: '1/s', tol: { rel: 0.02 }, p: { a: 4, K: 20 },
    text: p => `L(s) = K / [ s·(s + ${f(p.a, 0)}) ] mit K = ${f(p.K, 0)}. Wie groß ist der Imaginärteil (positiver Wert) der Pole des geschlossenen Kreises?`,
    calc: (R, p) => { const rs = R.locusRoots([1], [1, p.a, 0], p.K); return { answer: Math.max(...rs.map(r => r.im)), v: { re: rs[0].re } }; },
    tips: p => ['Der geschlossene Kreis hat den Nenner s² + a·s + K.', 'Mitternachtsformel: s = −a/2 ± √(a²/4 − K).', `a²/4 − K = ${f(p.a * p.a / 4 - p.K, 0)} (negativ, also komplex).`],
    steps: (p, v, a) => ['Nenner: s² + ' + f(p.a, 0) + '·s + ' + f(p.K, 0) + ' = 0.', 's = ' + f(v.re, 0) + ' ± j·√(' + f(p.K - p.a * p.a / 4, 0) + ').', 'Imaginärteil: ' + f(a, 3) + ' 1/s.']
  });

  /* ----------------------------------------------------------- Block 5 */
  const stepOf = (R, G, C, tEnd) => { const T = R.feedbackW(G, C); return R.stepInfo(R.stepResponse(T, { tEnd: tEnd, n: 6000 }), { yFinal: 1 }); };
  add({
    id: '5-01', block: 5, level: 1, title: 'BO: Verstärkung des PI-Reglers', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { Ks: 2, T1: 0.5, Ts: 0.02 },
    text: p => `Strecke: G(s) = ${f(p.Ks, 0)} / [ (1 + ${f(p.T1, 1)}·s)(1 + ${f(p.Ts, 2)}·s) ]. PI-Regler nach dem Betragsoptimum (Tn = T1). Wie groß ist K_p?`,
    calc: (R, p) => { const c = R.boPI(p.Ks, p.T1, p.Ts); return { answer: c.Kp, v: { Tn: c.Tn } }; },
    tips: p => ['Betragsoptimum: Der Regler kürzt die große Zeitkonstante, übrig bleibt Kp·Ks/(Tn·s·(1 + Tσ·s)).', 'Verstärkung: Kp = T1/(2·Ks·Tσ).', `2·Ks·Tσ = ${f(2 * p.Ks * p.Ts, 3)}, T1 = ${f(p.T1, 1)}.`],
    steps: (p, v, a) => ['Tn = T1 = ' + f(v.Tn, 2) + ' s (kürzt den großen PT1).', 'Kp = T1/(2·Ks·Tσ) = ' + f(p.T1, 2) + ' / (2 · ' + f(p.Ks, 0) + ' · ' + f(p.Ts, 2) + ') = ' + f(a, 3) + '.']
  });
  add({
    id: '5-02', block: 5, level: 2, title: 'BO: Überschwingen', kind: 'num', unit: '%', tol: { abs: 0.3 }, p: { Ks: 1.5, T1: 0.8, Ts: 0.01 },
    text: p => `Strecke G(s) = ${f(p.Ks, 1)} / [ (1 + ${f(p.T1, 1)}·s)(1 + ${f(p.Ts, 2)}·s) ] mit PI-Regler nach Betragsoptimum. Wie groß ist das Überschwingen der Führungssprungantwort in %?`,
    calc: (R, p) => { const c = R.boPI(p.Ks, p.T1, p.Ts), i = stepOf(R, R.ptn(p.Ks, [p.T1, p.Ts]), R.piTF(c.Kp, c.Tn), 40 * p.Ts); return { answer: i.overshootPct, v: { Kp: c.Kp, Tn: c.Tn, tan: i.tRise } }; },
    tips: p => ['Nach dem Kürzen ist der geschlossene Kreis ein PT2-Glied.', 'Seine Dämpfung ist 1/√2 (das ist der Sinn des Betragsoptimums). Das Überschwingen hängt nur von D ab.', 'Setze D = 0,7071 in e^(−π·D/√(1−D²)) ein: Exponent = π.'],
    steps: (p, v, a) => ['Regler: Kp = ' + f(v.Kp, 2) + ', Tn = ' + f(v.Tn, 2) + ' s.', 'Der geschlossene Kreis wird 1/(1 + 2·Tσ·s + 2·Tσ²·s²), also D = 1/√2.', 'ü = e^(−π) = ' + f(a, 2) + ' %. Simulation bestätigt.']
  });
  add({
    id: '5-03', block: 5, level: 2, title: 'BO: Anregelzeit', kind: 'num', unit: 'ms', tol: { rel: 0.03 }, p: { Ks: 2, T1: 0.4, Ts: 0.015 },
    text: p => `Strecke G(s) = ${f(p.Ks, 0)} / [ (1 + ${f(p.T1, 1)}·s)(1 + ${f(p.Ts * 1000, 0)} ms·s) ] mit BO-PI-Regler. Nach welcher Zeit erreicht die Führungssprungantwort zum ersten Mal den Endwert (Anregelzeit, in ms)?`,
    calc: (R, p) => { const c = R.boPI(p.Ks, p.T1, p.Ts), i = stepOf(R, R.ptn(p.Ks, [p.T1, p.Ts]), R.piTF(c.Kp, c.Tn), 40 * p.Ts); return { answer: i.tRise * 1000, v: { ratio: i.tRise / p.Ts } }; },
    tips: p => ['Der geschlossene Kreis ist ein PT2 mit D = 1/√2 und ω0 = 1/(√2·Tσ).', 'Anregelzeit PT2: t = (π − arccos D)/(ω0·√(1−D²)). Mit D = 1/√2 ist arccos D = π/4.', 'ω_d = ω0·√(1−D²) = 1/(2·Tσ). Also t = (3π/4)·2·Tσ ≈ 4,71·Tσ.'],
    steps: (p, v, a) => ['ω0 = 1/(√2·Tσ) = ' + f(1 / (Math.SQRT2 * p.Ts), 2) + ' 1/s, ω_d = 1/(2·Tσ) = ' + f(1 / (2 * p.Ts), 2) + ' 1/s.', 't_an = (π − π/4)/ω_d = ' + f(3 * Math.PI / 4, 4) + ' · ' + f(2 * p.Ts * 1000, 0) + ' ms = ' + f(a, 2) + ' ms.', 'Das ist ' + f(v.ratio, 2) + ' · Tσ (Faustregel 4,7·Tσ).']
  });
  add({
    id: '5-04', block: 5, level: 2, title: 'BO: PID-Verstärkung', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { Ks: 1.5, T1: 0.8, T2: 0.2, Ts: 0.01 },
    text: p => `Strecke G(s) = ${f(p.Ks, 1)} / [ (1 + ${f(p.T1, 1)}·s)(1 + ${f(p.T2, 1)}·s)(1 + ${f(p.Ts, 2)}·s) ]. PID-Regler in Reihenform nach Betragsoptimum (Tn = T1, Tv = T2). Wie groß ist K_p?`,
    calc: (R, p) => { const c = R.boPID(p.Ks, p.T1, p.T2, p.Ts); return { answer: c.Kp, v: { Tn: c.Tn, Tv: c.Tv } }; },
    tips: p => ['Der Regler kürzt die beiden großen Zeitkonstanten. Übrig bleibt Kp·Ks/(T1·s·(1 + Tσ·s)).', 'Die Formel ist wie beim PI-Regler: Kp = T1/(2·Ks·Tσ).', 'Die zweite große Zeitkonstante T2 geht nur in Tv ein, nicht in Kp.'],
    steps: (p, v, a) => ['Tn = T1 = ' + f(v.Tn, 1) + ' s, Tv = T2 = ' + f(v.Tv, 1) + ' s.', 'Kp = T1/(2·Ks·Tσ) = ' + f(p.T1, 1) + ' / (2 · ' + f(p.Ks, 1) + ' · ' + f(p.Ts, 2) + ') = ' + f(a, 3) + '.']
  });
  add({
    id: '5-05', block: 5, level: 2, title: 'SO: Verstärkung', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { Kis: 20, Ts: 0.005 },
    text: p => `Strecke G(s) = ${f(p.Kis, 0)} / [ s·(1 + ${f(p.Ts * 1000, 0)} ms·s) ] (Integrator mit kleiner Verzögerung). PI-Regler nach dem symmetrischen Optimum mit a = 2. Wie groß ist K_p?`,
    calc: (R, p) => { const c = R.soPI(p.Kis, p.Ts, 2); return { answer: c.Kp, v: { Tn: c.Tn, wc: c.wc } }; },
    tips: p => ['Symmetrisches Optimum: Die Durchtrittsfrequenz soll bei ω_D = 1/(a·Tσ) liegen, mit Tn = a²·Tσ.', 'Betragsbedingung |L(jω_D)| = 1 führt auf Kp = 1/(a·Kis·Tσ).', `a·Kis·Tσ = 2 · ${f(p.Kis, 0)} · ${f(p.Ts, 3)} = ${f(2 * p.Kis * p.Ts, 3)}.`],
    steps: (p, v, a) => ['Tn = 4·Tσ = ' + f(v.Tn * 1000, 1) + ' ms, ω_D = 1/(2·Tσ) = ' + f(v.wc, 1) + ' 1/s.', 'Kp = 1/(2·Kis·Tσ) = 1/(2 · ' + f(p.Kis, 0) + ' · ' + f(p.Ts, 3) + ') = ' + f(a, 3) + '.']
  });
  add({
    id: '5-06', block: 5, level: 3, title: 'SO: Phasenreserve', kind: 'num', unit: '°', tol: { abs: 0.5 }, p: { Kis: 20, Ts: 0.005 },
    text: p => `Strecke G(s) = ${f(p.Kis, 0)} / [ s·(1 + ${f(p.Ts * 1000, 0)} ms·s) ] mit PI-Regler nach dem symmetrischen Optimum (a = 2). Wie groß ist die Phasenreserve des offenen Kreises in Grad?`,
    calc: (R, p) => { const c = R.soPI(p.Kis, p.Ts, 2), L = R.tfMul(R.piTF(c.Kp, c.Tn), R.tf([p.Kis], R.pmul([1, 0], [p.Ts, 1]))); const m = R.margins(L); return { answer: m.pm, v: { wc: m.wc, Tn: c.Tn } }; },
    tips: p => ['Phase des offenen Kreises L = Kp·Kis·(1 + Tn·s)/(Tn·s²·(1 + Tσ·s)): −180° + arctan(ω·Tn) − arctan(ω·Tσ).', 'Phasenreserve: φ_R = arctan(ω_D·Tn) − arctan(ω_D·Tσ), mit ω_D = 1/(2·Tσ).', 'ω_D·Tn = 2 und ω_D·Tσ = 0,5.'],
    steps: (p, v, a) => ['ω_D = 1/(2·Tσ) = ' + f(v.wc, 1) + ' 1/s, ω_D·Tn = ' + f(v.wc * v.Tn, 2) + ', ω_D·Tσ = ' + f(v.wc * p.Ts, 2) + '.', 'φ_R = arctan(2) − arctan(0,5) = ' + f(Math.atan(2) * DEG, 2) + '° − ' + f(Math.atan(0.5) * DEG, 2) + '° = ' + f(a, 2) + '°.']
  });
  add({
    id: '5-07', block: 5, level: 3, title: 'SO mit Sollwertfilter: Überschwingen', kind: 'num', unit: '%', tol: { abs: 0.5 }, p: { Kis: 20, Ts: 0.01 },
    text: p => `Strecke G(s) = ${f(p.Kis, 0)} / [ s·(1 + ${f(p.Ts * 1000, 0)} ms·s) ] mit SO-PI-Regler (a = 2). Der Sollwert wird mit einem PT1-Filter 1/(1 + Tn·s) geglättet (Tn = Reglernachstellzeit). Wie groß ist das Überschwingen der Sprungantwort in %?`,
    calc: (R, p) => {
      const c = R.soPI(p.Kis, p.Ts, 2), G = R.tf([p.Kis], R.pmul([1, 0], [p.Ts, 1])), Tw = R.feedbackW(G, R.piTF(c.Kp, c.Tn));
      const Tf = R.tfMul(Tw, R.tf([1], [c.Tn, 1])), i = R.stepInfo(R.stepResponse(Tf, { tEnd: 60 * p.Ts, n: 6000 }), { yFinal: 1 });
      const i0 = R.stepInfo(R.stepResponse(Tw, { tEnd: 60 * p.Ts, n: 6000 }), { yFinal: 1 });
      return { answer: i.overshootPct, v: { ohne: i0.overshootPct, Tn: c.Tn } };
    },
    tips: (p, v, a) => ['Ohne Filter hat die Antwort ca. ' + f(v.ohne, 0) + ' % Überschwingen, weil der Regler eine Nullstelle (1 + Tn·s) in die Führungsübertragung bringt.', 'Der Filter 1/(1 + Tn·s) kürzt diese Nullstelle. Übrig bleibt 1/(1 + 4Tσ·s + 8Tσ²·s² + 8Tσ³·s³).', 'Die Sprungantwort dieses PT3-Gliedes überschwingt deutlich weniger. Berechne sie im Block „Entwurf“ (symmetrisches Optimum, mit Sollwertfilter) oder simuliere sie selbst; zur Kontrolle: das Ergebnis liegt zwischen ' + f(Math.floor(a), 0) + ' und ' + f(Math.floor(a) + 1, 0) + ' %.'],
    steps: (p, v, a) => ['Ohne Filter: ' + f(v.ohne, 1) + ' % Überschwingen.', 'Mit Filter Tf = Tn = ' + f(v.Tn * 1000, 0) + ' ms kürzt sich die Zählernullstelle weg.', 'Der Rest ist 1/(1 + 4Tσs + 8Tσ²s² + 8Tσ³s³); seine Sprungantwort überschwingt um ' + f(a, 2) + ' %.']
  });
  add({
    id: '5-08', block: 5, level: 2, title: 'Wendetangente: Verzugszeit', kind: 'num', unit: 's', tol: { rel: 0.03 }, p: { T: 2 },
    text: p => `Eine Strecke besteht aus zwei gleichen PT1-Gliedern mit je T = ${f(p.T, 0)} s (Ks = 1). Man legt die Tangente im Wendepunkt der Sprungantwort an. Wie groß ist die Verzugszeit Tu (Schnittpunkt der Tangente mit der Zeitachse)?`,
    calc: (R, p) => { const id = R.identifyTuTg(R.ptn(1, [p.T, p.T])); return { answer: id.Tu, v: { Tg: id.Tg, tW: id.tWende, yW: id.yWende } }; },
    tips: p => ['Die Sprungantwort ist y(t) = 1 − e^(−t/T)·(1 + t/T). Der Wendepunkt liegt bei t = T (y″ = 0).', `Dort: y(T) = 1 − 2/e, Steigung = 1/(e·T).`, 'Tangente: y = y(T) + Steigung·(t − T). Nullstelle der Tangente ergibt Tu = T·(3 − e).'],
    steps: (p, v, a) => ['Wendepunkt bei t = T = ' + f(v.tW, 2) + ' s, y(T) = 1 − 2/e = ' + f(v.yW, 4) + ', Steigung 1/(e·T) = ' + f(1 / (Math.E * p.T), 4) + ' 1/s.', 'Tangente schneidet die Zeitachse bei Tu = T − y(T)·e·T = T·(3 − e) = ' + f(a, 3) + ' s.', 'Zugleich ist Tg = e·T = ' + f(v.Tg, 3) + ' s.']
  });
  add({
    id: '5-09', block: 5, level: 3, title: 'ZN Schwingversuch: Nachstellzeit', kind: 'num', unit: 's', tol: { rel: 0.03 }, p: { Ks: 1, T: 0.2 },
    text: p => `Strecke: drei gleiche PT1-Glieder, G(s) = ${f(p.Ks, 0)} / (1 + ${f(p.T, 1)}·s)³. Beim Schwingversuch mit P-Regler ergibt sich K_krit und die Periodendauer T_krit. Wie groß ist Tn des PID-Reglers nach Ziegler-Nichols (Tn = 0,5·T_krit)?`,
    calc: (R, p) => { const u = R.ultimate(R.ptn(p.Ks, [p.T, p.T, p.T])), z = R.znOsc(u.Kcrit, u.Tcrit, 'PID'); return { answer: z.Tn, v: { Kcrit: u.Kcrit, Tcrit: u.Tcrit, w: u.wcrit } }; },
    tips: p => ['Die Dauerschwingung tritt bei der Frequenz auf, bei der die Phase −180° ist: jede Stufe liefert −60°.', 'ω_krit = √3/T, T_krit = 2π/ω_krit. Dann Tn = 0,5·T_krit.', `ω_krit = ${f(Math.sqrt(3) / p.T, 3)} 1/s.`],
    steps: (p, v, a) => ['ω_krit = √3/T = ' + f(v.w, 3) + ' 1/s, K_krit = 8/Ks = ' + f(v.Kcrit, 2) + '.', 'T_krit = 2π/ω_krit = ' + f(v.Tcrit, 4) + ' s.', 'Tn = 0,5·T_krit = ' + f(a, 4) + ' s (K_p = ' + f(0.6 * v.Kcrit, 2) + ', Tv = ' + f(0.125 * v.Tcrit, 4) + ' s).']
  });
  add({
    id: '5-10', block: 5, level: 2, title: 'ZN Sprungantwort: PID-Verstärkung', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { Ks: 2, Tu: 0.8, Tg: 6 },
    text: p => `Aus der Wendetangente einer Strecke: Ks = ${f(p.Ks, 0)}, Tu = ${f(p.Tu, 1)} s, Tg = ${f(p.Tg, 0)} s. Wie groß ist K_p eines PID-Reglers nach Ziegler-Nichols (Sprungantwort-Verfahren)?`,
    calc: (R, p) => { const z = R.znStep(p.Ks, p.Tu, p.Tg, 'PID'); return { answer: z.Kp, v: { Tn: z.Tn, Tv: z.Tv } }; },
    tips: p => ['Das Sprungantwort-Verfahren benutzt das Verhältnis Tg/Tu und die Verstärkung der Strecke.', 'PID: Kp = 1,2·Tg/(Ks·Tu), Tn = 2·Tu, Tv = 0,5·Tu.', `Tg/(Ks·Tu) = ${f(p.Tg / (p.Ks * p.Tu), 3)}.`],
    steps: (p, v, a) => ['Tg/(Ks·Tu) = ' + f(p.Tg, 0) + ' / (' + f(p.Ks, 0) + ' · ' + f(p.Tu, 1) + ') = ' + f(p.Tg / (p.Ks * p.Tu), 3) + '.', 'Kp = 1,2 · ' + f(p.Tg / (p.Ks * p.Tu), 3) + ' = ' + f(a, 3) + ', Tn = ' + f(v.Tn, 2) + ' s, Tv = ' + f(v.Tv, 2) + ' s.']
  });
  add({
    id: '5-11', block: 5, level: 2, title: 'CHR: PID für Störverhalten', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { Ks: 2, Tu: 1, Tg: 10 },
    text: p => `Strecke mit Ks = ${f(p.Ks, 0)}, Tu = ${f(p.Tu, 0)} s, Tg = ${f(p.Tg, 0)} s. Chien-Hrones-Reswick, Störverhalten, aperiodisch (0 % Überschwingen), PID-Regler: Kp = 0,95·Tg/(Ks·Tu). Wie groß ist K_p?`,
    calc: (R, p) => { const c = R.chr(p.Ks, p.Tu, p.Tg, 'PID', 'stoerung', 0); return { answer: c.Kp, v: { Tn: c.Tn, Tv: c.Tv } }; },
    tips: p => ['Die Tabelle gibt K_p als Faktor mal Tg/(Ks·Tu). Der Faktor hängt von Verhalten (Führung/Störung) und Überschwingen ab.', 'Hier: Faktor 0,95. Tg/(Ks·Tu) berechnen.', `Tg/(Ks·Tu) = ${f(p.Tg, 0)} / (${f(p.Ks, 0)} · ${f(p.Tu, 0)}) = ${f(p.Tg / (p.Ks * p.Tu), 2)}.`],
    steps: (p, v, a) => ['Tg/(Ks·Tu) = ' + f(p.Tg / (p.Ks * p.Tu), 2) + '.', 'Kp = 0,95 · ' + f(p.Tg / (p.Ks * p.Tu), 2) + ' = ' + f(a, 3) + '.', 'Weitere Werte: Tn = 2,4·Tu = ' + f(v.Tn, 2) + ' s, Tv = 0,42·Tu = ' + f(v.Tv, 2) + ' s.']
  });
  add({
    id: '5-12', block: 5, level: 3, title: 'Vergleich ZN gegen CHR (Führung)', kind: 'choice', options: ['Ziegler-Nichols (Sprungantwort)', 'CHR aperiodisch, Führung'], tol: {}, p: { K: 1, T: 1, Tt: 0.2 },
    text: p => `Strecke: PT1 mit Totzeit, K = ${f(p.K, 0)}, T = ${f(p.T, 0)} s, Tt = ${f(p.Tt, 1)} s. Beide Regler sind PID (Tu = Tt, Tg = T). Welche Einstellung überschwingt bei einem Sollwertsprung weniger?`,
    calc: (R, p) => {
      const G = R.withDelay(R.pt1(p.K, p.T), p.Tt), Tu = p.Tt, Tg = p.T;
      const z = R.znStep(p.K, Tu, Tg, 'PID'), c = R.chr(p.K, Tu, Tg, 'PID', 'fuehrung', 0);
      const a = R.loopStep(G, R.pidTF(z.Kp, z.Tn, z.Tv), 'w', { tEnd: 15, padeN: 4 }), b = R.loopStep(G, R.pidTF(c.Kp, c.Tn, c.Tv), 'w', { tEnd: 15, padeN: 4 });
      return { answer: a.info.overshootPct <= b.info.overshootPct ? 0 : 1, v: { zn: a.info.overshootPct, chr: b.info.overshootPct, znKp: z.Kp, chrKp: c.Kp } };
    },
    tips: p => ['Ziegler-Nichols ist auf schnelles Ausregeln von Störungen ausgelegt und bewusst scharf. CHR 0 % ist für Sollwertsprünge ohne Überschwingen gedacht.', 'Berechne beide Parametersätze (Tu = Tt, Tg = T) und vergleiche die Verstärkungen: Höheres Kp bedeutet eine schärfere Regelung.', 'Simuliere die beiden Regelkreise im Vergleichsdiagramm (Block 5, Strecke „PT1 mit Totzeit“).'],
    steps: (p, v) => ['ZN: Kp = ' + f(v.znKp, 2) + ', Überschwingen etwa 70 bis 90 % (Simulation mit Padé-Näherung 4. Ordnung ' + f(v.zn, 1) + ' %, mit exakter Totzeit rund 87 %; die Näherung unterschätzt das Überschwingen scharfer Einstellungen).', 'CHR 0 % Führung: Kp = ' + f(v.chrKp, 2) + ', Überschwingen ' + f(v.chr, 1) + ' %.', v.zn <= v.chr ? 'ZN überschwingt weniger.' : 'CHR überschwingt weniger; ZN reagiert dafür schärfer auf Störungen.']
  });

  /* ----------------------------------------------------------- Block 6 */
  add({
    id: '6-01', block: 6, level: 1, title: 'z-Ebene: Betrag des Pols', kind: 'num', unit: '', tol: { rel: 0.01 }, p: { re: -3, im: 4, Ts: 0.05 },
    text: p => `Ein Pol liegt bei s = ${f(p.re, 0)} + j·${f(p.im, 0)} (1/s). Abtastzeit Ts = ${f(p.Ts * 1000, 0)} ms. Wie groß ist der Betrag |z| des zugehörigen Pols in der z-Ebene?`,
    calc: (R, p) => { const z = R.sToZ({ re: p.re, im: p.im }, p.Ts); return { answer: R.cabs(z), v: { ang: R.carg(z) * DEG } }; },
    tips: p => ['Die Abbildung lautet z = e^(s·Ts).', 'Der Betrag hängt nur vom Realteil ab: |z| = e^(Re(s)·Ts).', `Re(s)·Ts = ${f(p.re * p.Ts, 3)}.`],
    steps: (p, v, a) => ['|z| = e^(Re(s)·Ts) = e^(' + f(p.re * p.Ts, 3) + ') = ' + f(a, 4) + '.', 'Weil |z| < 1 ist, liegt der Pol im Einheitskreis (stabil).']
  });
  add({
    id: '6-02', block: 6, level: 1, title: 'z-Ebene: Winkel des Pols', kind: 'num', unit: '°', tol: { abs: 0.2 }, p: { re: -3, im: 4, Ts: 0.05 },
    text: p => `Wie im vorigen Beispiel: s = ${f(p.re, 0)} + j·${f(p.im, 0)} (1/s) und Ts = ${f(p.Ts * 1000, 0)} ms. Welchen Winkel (in Grad) hat der Pol z in der z-Ebene?`,
    calc: (R, p) => { const z = R.sToZ({ re: p.re, im: p.im }, p.Ts); return { answer: R.carg(z) * DEG, v: { abs: R.cabs(z) } }; },
    tips: p => ['z = e^(σ·Ts)·e^(j·ω·Ts). Der Winkel ist ω·Ts im Bogenmaß.', 'Danach mit 180°/π ins Gradmaß umrechnen.', `ω·Ts = ${f(p.im * p.Ts, 3)} rad.`],
    steps: (p, v, a) => ['Winkel = Im(s)·Ts = ' + f(p.im * p.Ts, 3) + ' rad.', 'In Grad: ' + f(p.im * p.Ts, 3) + ' · 180°/π = ' + f(a, 2) + '°.']
  });
  add({
    id: '6-03', block: 6, level: 2, title: 'PT1 mit Halteglied: Pol a', kind: 'num', unit: '', tol: { rel: 0.01 }, p: { T: 0.2, Ts: 0.05 },
    text: p => `Ein PT1-Glied (T = ${f(p.T, 1)} s) wird mit Ts = ${f(p.Ts * 1000, 0)} ms abgetastet und mit Halteglied umgesetzt. G(z) = b/(z − a). Wie groß ist a?`,
    calc: (R, p) => { const g = R.c2dZOH(R.pt1(1, p.T), p.Ts); return { answer: -g.den[1], v: { b: g.num[0] } }; },
    tips: p => ['Der kontinuierliche Pol s = −1/T wird auf z = e^(s·Ts) abgebildet.', 'a = e^(−Ts/T).', `Ts/T = ${f(p.Ts / p.T, 3)}.`],
    steps: (p, v, a) => ['Ts/T = ' + f(p.Ts / p.T, 3) + '.', 'a = e^(−Ts/T) = ' + f(a, 4) + '.', 'b = Ks·(1 − a) = ' + f(v.b, 4) + ' (für Ks = 1).']
  });
  add({
    id: '6-04', block: 6, level: 2, title: 'PT1 mit Halteglied: Zählerwert b', kind: 'num', unit: '', tol: { rel: 0.01 }, p: { K: 2, T: 0.2, Ts: 0.05 },
    text: p => `PT1-Glied mit Ks = ${f(p.K, 0)}, T = ${f(p.T, 1)} s, Abtastzeit Ts = ${f(p.Ts * 1000, 0)} ms, Halteglied. Die Pulsübertragungsfunktion lautet G(z) = b/(z − a). Wie groß ist b?`,
    calc: (R, p) => { const g = R.c2dZOH(R.pt1(p.K, p.T), p.Ts); return { answer: g.num[0], v: { a: -g.den[1] } }; },
    tips: p => ['Der statische Endwert muss erhalten bleiben: G(z = 1) = Ks.', 'Das ergibt b/(1 − a) = Ks.', `a = e^(−Ts/T) = ${f(Math.exp(-p.Ts / p.T), 4)}.`],
    steps: (p, v, a) => ['a = e^(−Ts/T) = ' + f(v.a, 4) + '.', 'Endwertforderung: b = Ks·(1 − a) = ' + f(p.K, 0) + ' · ' + f(1 - v.a, 4) + ' = ' + f(a, 4) + '.']
  });
  add({
    id: '6-05', block: 6, level: 2, title: 'Tustin: Pol', kind: 'num', unit: '', tol: { rel: 0.01 }, p: { T: 0.2, Ts: 0.05 },
    text: p => `Ein PT1-Glied (T = ${f(p.T, 1)} s) wird nach Tustin diskretisiert (s = (2/Ts)·(z − 1)/(z + 1)), Ts = ${f(p.Ts * 1000, 0)} ms. Wo liegt der Pol in z?`,
    calc: (R, p) => { const g = R.tustin(R.pt1(1, p.T), p.Ts); return { answer: R.roots(g.den).filter(r => Math.abs(r.im) < 1e-9)[0].re, v: { exact: Math.exp(-p.Ts / p.T) } }; },
    tips: p => ['Setze die Substitution in 1 + T·s ein und multipliziere mit (z + 1).', '1 + T·(2/Ts)·(z − 1)/(z + 1) = 0 ergibt (z + 1) + (2T/Ts)·(z − 1) = 0.', 'Löse nach z: z = (2T/Ts − 1)/(2T/Ts + 1) = (1 − Ts/(2T))/(1 + Ts/(2T)).'],
    steps: (p, v, a) => ['Ts/(2T) = ' + f(p.Ts / (2 * p.T), 4) + '.', 'z = (1 − ' + f(p.Ts / (2 * p.T), 4) + ')/(1 + ' + f(p.Ts / (2 * p.T), 4) + ') = ' + f(a, 4) + '.', 'Zum Vergleich der genaue Pol e^(−Ts/T) = ' + f(v.exact, 4) + ': Tustin weicht ein wenig ab.']
  });
  add({
    id: '6-06', block: 6, level: 3, title: 'Digitale P-Regelung: Stabilitätsgrenze', kind: 'num', unit: '', tol: { rel: 0.02 }, p: { K: 1, T: 0.2, Ts: 0.05 },
    text: p => `Strecke PT1 (Ks = ${f(p.K, 0)}, T = ${f(p.T, 1)} s) mit Halteglied, Abtastzeit Ts = ${f(p.Ts * 1000, 0)} ms, digitaler P-Regler mit der Verstärkung Kp. Ab welchem Kp wird der geschlossene Kreis instabil (Pol bei z = −1)?`,
    calc: (R, p) => {
      const g = R.c2dZOH(R.pt1(p.K, p.T), p.Ts);
      let lo = 0, hi = 1000; for (let i = 0; i < 100; i++) { const mid = 0.5 * (lo + hi), d = R.dClosed(g, { num: [mid], den: [1] }); if (R.zStability(d.den).maxAbs < 1) lo = mid; else hi = mid; }
      return { answer: 0.5 * (lo + hi), v: { a: -g.den[1], b: g.num[0] } };
    },
    tips: p => ['Geschlossener Kreis: 1 + Kp·G(z) = 0, also z − a + Kp·b = 0.', 'Der Pol liegt bei z = a − Kp·b. Instabil, sobald z < −1.', `a − Kp·b = −1 ergibt Kp = (1 + a)/b mit a = ${f(Math.exp(-p.Ts / p.T), 4)}, b = ${f(p.K * (1 - Math.exp(-p.Ts / p.T)), 4)}.`],
    steps: (p, v, a) => ['a = ' + f(v.a, 4) + ', b = ' + f(v.b, 4) + '.', 'Pol: z = a − Kp·b = −1 ergibt Kp = (1 + a)/b = ' + f(1 + v.a, 4) + ' / ' + f(v.b, 4) + ' = ' + f(a, 3) + '.', 'Im kontinuierlichen Kreis (PT1 allein) wäre jedes Kp stabil: Die Abtastung allein bringt diese Grenze.']
  });
  add({
    id: '6-07', block: 6, level: 3, title: 'Phasenreserve digital (Näherung)', kind: 'num', unit: '°', tol: { abs: 0.6 }, p: { K: 10, T: 0.1, Ts: 0.02, d: 1 },
    text: p => `Kontinuierlich entworfener Kreis L(s) = ${f(p.K, 0)} / [ s·(1 + ${f(p.T, 1)}·s) ]. Er wird digital mit Ts = ${f(p.Ts * 1000, 0)} ms umgesetzt: Halteglied (Verzug Ts/2) plus ${f(p.d, 0)} Takt Rechenverzug. Wie groß ist die Phasenreserve in Grad (Näherung über die Ersatztotzeit)?`,
    calc: (R, p) => { const r = R.pmWithDelay(R.tf([p.K], R.pmul([1, 0], [p.T, 1])), p.Ts / 2 + p.d * p.Ts); return { answer: r.pm, v: { pmCont: r.pmCont, wc: r.wc, loss: r.loss } }; },
    tips: p => ['Die Abtastung wirkt wie eine Totzeit Teff = Ts/2 + d·Ts. Betrag und ω_D ändern sich nicht.', 'Phasenverlust = ω_D·Teff (im Bogenmaß, dann in Grad).', `Teff = ${f(p.Ts / 2 + p.d * p.Ts, 3)} s. Erst die kontinuierliche Phasenreserve und ω_D bestimmen.`],
    steps: (p, v, a) => ['Kontinuierlich: ω_D = ' + f(v.wc, 3) + ' 1/s, φ_R = ' + f(v.pmCont, 2) + '°.', 'Teff = Ts/2 + d·Ts = ' + f(p.Ts / 2 + p.d * p.Ts, 3) + ' s, Verlust = ω_D·Teff = ' + f(v.loss, 2) + '°.', 'Digital: φ_R ≈ ' + f(v.pmCont, 2) + '° − ' + f(v.loss, 2) + '° = ' + f(a, 2) + '°.']
  });
  add({
    id: '6-08', block: 6, level: 3, title: 'Größte Abtastzeit', kind: 'num', unit: 'ms', tol: { rel: 0.03 }, p: { K: 10, T: 0.1, lossMax: 5, d: 1 },
    text: p => `Kreis wie vorher: L(s) = ${f(p.K, 0)} / [ s·(1 + ${f(p.T, 1)}·s) ]. Wie groß darf die Abtastzeit Ts höchstens sein, wenn die Abtastung (Halteglied Ts/2 plus ${f(p.d, 0)} Takt Rechenverzug, also 1,5·Ts) höchstens ${f(p.lossMax, 0)}° Phasenreserve kosten darf? Angabe in ms.`,
    calc: (R, p) => { const m = R.margins(R.tf([p.K], R.pmul([1, 0], [p.T, 1]))); const Teff = R.tdMax(p.lossMax, m.wc); return { answer: Teff / (0.5 + p.d) * 1000, v: { wc: m.wc, Teff: Teff } }; },
    tips: p => ['Phasenverlust = ω_D·Teff mit Teff = 1,5·Ts.', 'Teff,max = Verlust/ω_D (Verlust im Bogenmaß); dann Ts = Teff/1,5.', `Verlust: ${f(p.lossMax, 0)}° = ${f(p.lossMax / DEG, 4)} rad. ω_D aus |L| = 1 bestimmen.`],
    steps: (p, v, a) => ['ω_D = ' + f(v.wc, 3) + ' 1/s.', 'Teff,max = ' + f(p.lossMax / DEG, 4) + ' rad / ' + f(v.wc, 3) + ' 1/s = ' + f(v.Teff * 1000, 2) + ' ms.', 'Ts = Teff/1,5 = ' + f(a, 2) + ' ms.']
  });
  add({
    id: '6-09', block: 6, level: 1, title: 'Aliasing', kind: 'num', unit: 'Hz', tol: { abs: 0.5 }, p: { f: 900, fs: 1000 },
    text: p => `Ein Sinussignal mit f = ${f(p.f, 0)} Hz wird mit fs = ${f(p.fs, 0)} Hz abgetastet. Bei welcher Frequenz erscheint es in den Abtastwerten (Alias-Frequenz)?`,
    calc: (R, p) => ({ answer: R.aliasFreq(p.f, p.fs), v: { nyq: p.fs / 2 } }),
    tips: p => ['Die Nyquist-Frequenz fs/2 ist die höchste darstellbare Frequenz. Alles darüber klappt zurück.', 'f_alias = |f − n·fs| mit passendem ganzzahligem n.', `fs/2 = ${f(p.fs / 2, 0)} Hz. Welches Vielfache von fs liegt am nächsten an f?`],
    steps: (p, v, a) => ['Nächstes Vielfaches von fs: 1 · ' + f(p.fs, 0) + ' Hz.', 'f_alias = |' + f(p.f, 0) + ' − ' + f(p.fs, 0) + '| = ' + f(a, 0) + ' Hz (unter fs/2 = ' + f(v.nyq, 0) + ' Hz).']
  });
  add({
    id: '6-10', block: 6, level: 2, title: 'Differenzengleichung: Wert y[3]', kind: 'num', unit: '', tol: { rel: 0.01 }, p: { K: 1, T: 0.2, Ts: 0.05 },
    text: p => `PT1-Glied (Ks = ${f(p.K, 0)}, T = ${f(p.T, 1)} s) mit Halteglied, Ts = ${f(p.Ts * 1000, 0)} ms. Eingang: Sprung von 1 bei k = 0. Wie groß ist der Ausgangswert y[3] (Zeitpunkt t = 3·Ts)?`,
    calc: (R, p) => { const g = R.c2dZOH(R.pt1(p.K, p.T), p.Ts), y = R.dstep(g.num, g.den, 6); return { answer: y[3], v: { a: -g.den[1], b: g.num[0], y: y } }; },
    tips: p => ['Differenzengleichung: y[k] = a·y[k−1] + b·u[k−1] mit a = e^(−Ts/T), b = Ks·(1 − a).', 'Starte mit y[0] = 0 und rechne drei Schritte.', `a = ${f(Math.exp(-p.Ts / p.T), 4)}, b = ${f(p.K * (1 - Math.exp(-p.Ts / p.T)), 4)}.`],
    steps: (p, v, a) => ['y[1] = a·0 + b·1 = ' + f(v.y[1], 4) + '.', 'y[2] = a·y[1] + b = ' + f(v.y[2], 4) + '.', 'y[3] = a·y[2] + b = ' + f(a, 4) + ' (gleich Ks·(1 − e^(−3·Ts/T)) = Ks·(1 − e^(−' + f(3 * p.Ts / p.T, 2) + '))).']
  });
  add({
    id: '6-11', block: 6, level: 2, title: 'Digitaler PI-Regler: Koeffizient', kind: 'num', unit: '', tol: { rel: 0.01 }, p: { Kp: 2, Tn: 0.5, Ts: 0.05 },
    text: p => `Ein PI-Regler mit Kp = ${f(p.Kp, 0)} und Tn = ${f(p.Tn, 1)} s wird mit Ts = ${f(p.Ts * 1000, 0)} ms nach dem Rückwärts-Euler-Verfahren umgesetzt: u[k] = u[k−1] + c0·e[k] + c1·e[k−1]. Wie groß ist c0?`,
    calc: (R, p) => { const c = R.piDigital(p.Kp, p.Tn, p.Ts, 'rueckwaerts'); return { answer: c.num[0], v: { c1: c.num[1] } }; },
    tips: p => ['Rückwärts-Euler ersetzt das Integral durch die Summe Ts·e[k]. Der PI-Regler lautet u = Kp·(e + (1/Tn)·∫e dt).', 'u[k] − u[k−1] = Kp·(e[k] − e[k−1]) + Kp·(Ts/Tn)·e[k].', 'c0 = Kp·(1 + Ts/Tn), c1 = −Kp.'],
    steps: (p, v, a) => ['Ts/Tn = ' + f(p.Ts / p.Tn, 3) + '.', 'c0 = Kp·(1 + Ts/Tn) = ' + f(p.Kp, 0) + ' · ' + f(1 + p.Ts / p.Tn, 3) + ' = ' + f(a, 3) + '.', 'c1 = −Kp = ' + f(v.c1, 0) + '.']
  });

  /* ===================================================================== Aufgaben bauen */
  const byId = {}; T.forEach(t => { byId[t.id] = t; });
  function build(id) {
    const t = byId[id]; if (!t) return null;
    const c = t.calc(R, t.p), v = c.v || {};
    let ans = c.answer;
    const text = t.text(t.p), tips = t.tips(t.p, v, ans), steps = t.steps(t.p, v, ans);
    let result;
    if (t.kind === 'choice') result = t.options[ans];
    else if (!t.unit && Math.abs(ans - Math.round(ans)) < 1e-9) result = String(Math.round(ans)).replace('-', '−');
    else result = (t.unit === '%' || t.unit === '°') ? sig(ans, 3) + ' ' + t.unit : (t.unit ? sig(ans, 3) + ' ' + t.unit : sig(ans, 3));
    return { id: t.id, block: t.block, level: t.level, title: t.title, kind: t.kind, unit: t.unit || '', options: t.options || null, tol: t.tol, p: t.p, text: text, answer: ans, v: v, tips: tips, steps: steps, result: result };
  }
  function check(task, input) {
    if (task.kind === 'choice') return { ok: Number(input) === task.answer };
    const x = parseNum(input); if (x == null) return { ok: false, bad: true };
    const tol = Math.max((task.tol.abs || 0), (task.tol.rel || 0) * Math.abs(task.answer));
    return { ok: Math.abs(x - task.answer) <= tol, x: x };
  }
  function parseNum(s) {
    if (typeof s === 'number') return isFinite(s) ? s : null;
    s = String(s == null ? '' : s).trim().replace(/−/g, '-').replace(/\s+/g, '').replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
    const x = parseFloat(s); return isFinite(x) ? x : null;
  }
  const META = { id: 'rg2', file: 'rg2lab.html', name: 'Regelungstechnik Aufbau', stufe: 'studium', version: 'v78.195', blocks: BLOCKS.length };
  return {
    VERSION: '1.0', META: META, BLOCKS: BLOCKS, TASKS: T, ids: () => T.map(t => t.id), byBlock: b => T.filter(t => t.block === b), get: id => byId[id] || null, build: build, check: check, parseNum: parseNum, fmt: f
  };
});
