'use strict';
/* Tonfunk 3D-Druck-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools).
   ALLE Zahlen (Temperaturen, Dichten, Preise, Zeiten, Maße) sind ÜBUNGSWERTE, nicht für die Praxis.
   window.DRK_DATA  { cats, tasks, gens, make, makeTask, randomQ, pools }
   window.DRK_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'drk', Status in localStorage 'lm4.drk.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Aufgabe hat einen Block "So gehst du vor" (plan, die Schritte der Reihe nach), einen Tipp in zwei Stufen und einen Lösungsweg (expl).
   Titel bleiben neutral und verraten weder Ergebnis noch Fehler. Die Namen Bambu Studio und Bambu Lab stehen nur dort, wo sie helfen. */
(function (root) {
  const C = () => root.DRK_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Verfahren und Druckerteile', 'Filamente', 'Slicer-Einstellungen', 'Rechnen und Kosten', 'Fehlerbilder', 'Konstruieren und Sicherheit'];

  const numQ = (text, value, unit, label, tol, expl, tips, plan) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, plan });
  function choiceQ(R, text, right, wrong, expl, tips, plan) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, plan };
  }
  /* Fragen-Pool: [Text, richtig, falsch[3], Erklärung, Tipps[2]] */
  const pq = (POOL, plan) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], plan); };

  /* ---------- Verfahren und Druckerteile ---------- */
  const TEILQ = [
    ['Welches Teil schmilzt das Filament und bringt es auf Drucktemperatur?', 'Das Hotend mit Heizelement und Düse', ['Das Heizbett', 'Der Bauteillüfter', 'Der Spulenhalter'], 'Im Hotend wird das Filament geschmolzen. Das Heizbett wärmt die Platte, der Lüfter kühlt das fertige Filament.', ['Wo wird das Filament flüssig?', 'Das Hotend sitzt am Druckkopf.']],
    ['Welches Teil schiebt das Filament von der Spule zum Hotend?', 'Der Extruder (Fördermechanismus mit Zahnrad)', ['Die Düse', 'Die Bauplatte', 'Die Linearführung'], 'Der Extruder klemmt das Filament mit einem Zahnrad und schiebt es vor oder zieht es beim Rückzug zurück.', ['Wer bewegt das Filament?', 'Ein Zahnrad klemmt den Draht.']],
    ['Wie heißt die kleine Öffnung ganz unten am Hotend, aus der das flüssige Filament austritt?', 'Düse', ['Extruder', 'Heizbett', 'Spulenhalter'], 'Die Düse formt die dünne Kunststoffraupe. Ihr Durchmesser (zum Beispiel 0,4 mm) bestimmt die Linienbreite.', ['Wo kommt der Kunststoff heraus?', 'Die Öffnung hat meist 0,4 mm.']],
    ['Wozu ist das Heizbett da?', 'Es wärmt die Bauplatte, damit die erste Schicht haftet und sich das Teil weniger verzieht', ['Es schmilzt das Filament', 'Es kühlt das Teil beim Druck', 'Es schiebt das Filament nach vorn'], 'Ein warmes Bett hält die unterste Schicht fest und gleicht den Wärmeunterschied zum Rest des Teils aus.', ['Was soll an der Platte haften?', 'Warm ist die Haftung besser.']],
    ['Wozu dient der Bauteillüfter?', 'Er kühlt das frisch abgelegte Filament, damit es schnell fest wird (wichtig bei Überhängen)', ['Er trocknet das Filament', 'Er heizt die Düse', 'Er hält die Platte am Drucker fest'], 'Der Lüfter bläst auf die gerade gedruckte Schicht. Zu viel Kühlung kann bei ABS und ASA aber Verzug fördern.', ['Warum bläst Luft auf das Teil?', 'Schnell fest heißt schnell kühlen.']],
    ['Wozu dient ein Filamentwechsler im Mehrfarbdruck?', 'Er hält mehrere Spulen bereit und führt das gewünschte Filament zum Druckkopf', ['Er wechselt die Düse', 'Er wechselt die Bauplatte', 'Er schneidet das fertige Teil ab'], 'Beim Farbwechsel zieht der Wechsler das alte Filament zurück und lädt das neue. Das gewechselte Filament muss danach gespült werden.', ['Er arbeitet mit mehreren Spulen.', 'Es geht um Farben, nicht um die Düse.']]
  ];
  const VERFQ = [
    ['Was geschieht beim FDM-Druck (Schmelzschichtung)?', 'Kunststoffdraht (Filament) wird geschmolzen und Schicht für Schicht abgelegt', ['Flüssiges Harz wird mit Licht ausgehärtet', 'Metallpulver wird mit einem Laser verschmolzen', 'Ein Block wird durch Fräsen abgetragen'], 'FDM steht für Fused Deposition Modeling. Harz-Druck, Pulver-Sintern und Fräsen sind andere Verfahren.', ['Was wird in die Düse geschoben?', 'Schmelzen und ablegen, Schicht für Schicht.']],
    ['Wie nennt man Verfahren wie den 3D-Druck, bei denen ein Teil durch Auftragen von Material entsteht?', 'Additive Fertigung', ['Subtraktive Fertigung (Abtragen)', 'Umformen', 'Trennen'], 'Additiv heißt hinzufügen. Beim Fräsen wird dagegen Material abgetragen (subtraktiv).', ['Wird Material hinzugefügt oder weggenommen?', 'Das Gegenteil ist Abtragen.']],
    ['Was ist ein Vorteil von FDM gegenüber dem Fräsen?', 'Man kann innen hohle oder gitterartige Formen drucken, die sich nicht fräsen lassen', ['Die Oberfläche ist immer glatter', 'Die Teile sind immer fester', 'Es braucht keine Konstruktionsdaten'], 'Der Druck kann Hohlräume und Füllmuster herstellen. Oberfläche und Festigkeit sind bei Fräsen meist besser.', ['Wo hat Fräsen Grenzen?', 'Denke an Hohlräume im Inneren.']],
    ['Was ist eine typische Grenze von FDM?', 'Die Schichtstruktur: Teile sind quer zu den Schichten schwächer und die Oberfläche zeigt Schichtlinien', ['Es lassen sich nur einfarbige Teile drucken', 'Es gibt nur ein einziges Material', 'Teile müssen kleiner als 1 cm sein'], 'Zwischen den Schichten ist die Verbindung die Schwachstelle. Mehrfarbdruck und viele Materialien sind möglich.', ['Woraus besteht das Teil? Aus vielen Schichten.', 'Wo reißt es zuerst?']],
    ['Was erzeugt der Slicer für den Drucker?', 'Eine Anweisungsdatei mit Bewegungen, Temperaturen und Materialmengen (G-Code)', ['Ein CAD-Modell', 'Eine Stückliste', 'Einen Schaltplan'], 'Der Slicer zerlegt das Modell in Schichten und schreibt für jede Schicht die Fahrwege und Einstellungen auf. Das Modell selbst kommt aus dem CAD.', ['Was braucht der Drucker, um zu fahren?', 'Der Slicer schneidet das Modell in Schichten.']]
  ];
  const AUFBQ = [
    ['Welche Achsen hat ein einfacher kartesischer FDM-Drucker?', 'Drei Achsen X, Y und Z im rechten Winkel zueinander', ['Nur zwei Achsen, die Höhe stellt man von Hand ein', 'Zwei Achsen und eine Drehachse', 'Fünf Achsen wie eine Fräsmaschine'], 'X und Y bewegen sich in der Schicht, Z stellt die Höhe der nächsten Schicht ein.', ['Wie viele Richtungen im Raum gibt es?', 'Eine Achse ist für die Höhe da.']],
    ['Welche Achse bewegt sich beim Wechsel zur nächsten Schicht?', 'Die Z-Achse (Höhe)', ['Die X-Achse', 'Die Y-Achse', 'Die Achse des Bauteillüfters'], 'Nach jeder Schicht wird Düse und Platte um eine Schichthöhe auseinandergefahren.', ['Was ändert sich von Schicht zu Schicht?', 'Z steht für die Höhe.']],
    ['Was bedeutet die Bauart CoreXY?', 'Zwei Motoren bewegen über Riemen den Druckkopf in X und Y', ['Der Druckkopf hängt an drei Armen (Delta)', 'Die Bauplatte dreht sich im Kreis', 'Der Drucker hat zwei Düsen'], 'CoreXY ist ein Riemenantrieb: Beide Motoren zusammen bestimmen die X- und Y-Bewegung.', ['Es geht um die Bewegung in X und Y.', 'Die Motoren wirken zusammen auf die Riemen.']],
    ['Wozu dienen die Schrittmotoren am Drucker?', 'Sie fahren Achsen und Extruder um genau gezählte Schritte', ['Sie heizen das Bett', 'Sie messen die Temperatur', 'Sie kühlen das Teil'], 'Ein Schrittmotor dreht sich in kleinen, zählbaren Schritten. So lässt sich der Weg genau steuern.', ['Wer bewegt die Achsen?', 'Zählbar heißt genau.']],
    ['Wie hält der Drucker die Düsentemperatur konstant?', 'Ein Fühler misst, die Steuerung schaltet die Heizung nach (Regelkreis)', ['Die Heizung läuft immer mit voller Leistung', 'Der Lüfter regelt die Temperatur allein', 'Die Spule gibt die Wärme ab'], 'Der Temperaturfühler meldet den Istwert, die Steuerung vergleicht mit dem Sollwert und schaltet die Heizung.', ['Wer misst? Wer schaltet?', 'Ist- und Sollwert werden verglichen.']]
  ];
  const DUESEQ = [
    ['Du tauschst die 0,4-mm-Düse gegen eine 0,2-mm-Düse. Was ist die Folge?', 'Feinere Details, aber deutlich längere Druckzeit', ['Schnelleres Drucken bei gleicher Qualität', 'Stärkere Teile bei gleicher Zeit', 'Das Filament muss dünner als 1,75 mm sein'], 'Die Linien werden dünner, also braucht es mehr Linien und mehr Zeit. Das Filament bleibt gleich.', ['Dünnere Linie heißt was für die Strecke?', 'Wie lange dauert mehr Strecke?']],
    ['Wann nimmst du eine größere Düse, zum Beispiel 0,6 mm?', 'Wenn es auf Tempo und Festigkeit ankommt und feine Details unwichtig sind', ['Wenn du sehr feine Schrift drucken willst', 'Wenn du nur winzige Figuren druckst', 'Wenn das Filament sehr dünn ist'], 'Eine dicke Linie füllt schneller und trägt mehr. Feine Details gehen dabei verloren.', ['Wofür ist dicker besser?', 'Detail und Tempo vertragen sich nicht.']],
    ['Wofür steht die Angabe 0,4 mm bei der Düse?', 'Für den Durchmesser der Austrittsöffnung', ['Für die Länge der Düse', 'Für den Filamentdurchmesser', 'Für die Dicke der Bauplatte'], 'Das Maß beschreibt die Öffnung. Das Filament hat 1,75 mm oder 2,85 mm Durchmesser.', ['Welches Maß hat die Öffnung?', 'Das Filament ist dicker als 0,4 mm.']],
    ['Was ist die Linienbreite im Slicer?', 'Die Breite der Kunststoffraupe, die die Düse ablegt, meist nahe am Düsendurchmesser', ['Die Breite der Bauplatte', 'Der Abstand zwischen zwei Teilen', 'Die Dicke des Filaments'], 'Die Linienbreite ist die Breite der gedruckten Linie von oben gesehen. Sie liegt oft etwas über dem Düsendurchmesser.', ['Von oben auf eine Linie gesehen.', 'Sie hängt von der Düse ab.']],
    ['Warum braucht man für Filament mit Kohlefaser oder Glasfaser oft eine gehärtete Düse?', 'Die Fasern wirken schleifend und nutzen eine Messingdüse schnell ab', ['Sie schmelzen sonst nicht', 'Sie kleben sonst an der Platte', 'Sie ziehen sonst Feuchte'], 'Fasergefülltes Filament schleift. Gehärtete Düsen halten länger.', ['Was machen Fasern in der Düse?', 'Wie nutzt sich Messing ab?']]
  ];

  /* ---------- Filamente ---------- */
  const ZUORDQ = [
    ['Welches Filament ist gummiartig und lässt sich biegen und dehnen?', 'TPU', ['PLA', 'ABS', 'PETG'], 'TPU ist ein thermoplastisches Elastomer: weich und elastisch.', ['Gummiartig heißt elastisch.', 'Das weichste Filament der Tabelle.']],
    ['Welches Filament eignet sich für den Einstieg, weil es wenig verzieht und auch ohne Einhausung gut druckbar ist?', 'PLA', ['ABS', 'ASA', 'TPU'], 'PLA verzieht kaum, schmilzt bei niedriger Temperatur und braucht kein heißes Bett.', ['Welches Material hat die niedrigsten Temperaturen?', 'Es verzieht sich kaum.']],
    ['Welches Filament ist UV- und wetterbeständig und wird für Teile im Freien gewählt?', 'ASA', ['PLA', 'TPU', 'ABS'], 'ASA ist wie ABS aufgebaut, vergilbt aber in der Sonne kaum.', ['Welcher Buchstabe steht für Außen?', 'Es ist eng mit ABS verwandt.']],
    ['Welches Material wird schon bei etwa 60 °C weich und ist deshalb für Teile im heißen Auto ungeeignet?', 'PLA', ['ASA', 'ABS', 'Alle sind gleich hitzebeständig'], 'PLA hat die niedrigste Wärmeformbeständigkeit der Tabelle.', ['Welches Material verträgt am wenigsten Wärme?', 'Schau in die Sterne für die Hitzebeständigkeit.']],
    ['Welches Filament ist zäh, wasserbeständig und eignet sich für robuste Halter, auch ohne Einhausung?', 'PETG', ['PLA', 'TPU', 'Gar keins, dafür braucht man Harz'], 'PETG ist zäher als PLA und braucht keine Einhausung.', ['Es liegt zwischen PLA und ABS.', 'Es druckt bei etwa 245 °C.']],
    ['Warum brauchen ABS und ASA oft eine Einhausung?', 'Sie verziehen sich bei kühler Umgebung stark, die Wärme im Gehäuse hilft', ['Sie schmelzen sonst nicht', 'Sie geben sonst Feuchte ab', 'Die Einhausung färbt die Teile'], 'Warme Umgebungsluft macht den Temperaturunterschied im Teil kleiner und senkt den Verzug.', ['Wo kommt der Verzug her?', 'Gleichmäßig warm ist besser.']]
  ];
  const FEUCHTQ = [
    ['Woran erkennst du, dass ein Filament zu feucht ist?', 'Es knistert oder zischt an der Düse, bildet Bläschen und die Oberfläche wird rau mit Fäden', ['Es druckt schneller', 'Es wird glänzender und fester', 'Die Spule wird kälter'], 'Das Wasser im Filament verdampft in der heißen Düse. Dabei entstehen Bläschen und Fäden.', ['Was passiert mit Wasser in einer heißen Düse?', 'Du kannst es hören und sehen.']],
    ['Wie lagerst du Filament am besten?', 'Trocken in einer Box oder einem Beutel mit Trockenmittel', ['Offen im Regal am Fenster', 'Im Kühlschrank ohne Verpackung', 'Auf der Heizung'], 'Filament nimmt Feuchte aus der Luft auf. Eine dichte Verpackung mit Trockenmittel schützt.', ['Wovor soll das Filament geschützt werden?', 'Dicht und trocken.']],
    ['Womit trocknest du feuchtes Filament sinnvoll?', 'In einem Filamenttrockner mit geregelter, niedriger Temperatur nach den Angaben für das Material', ['In der Mikrowelle', 'Mit dem Heißluftgebläse auf höchster Stufe', 'Auf dem Heizbett bei 150 °C'], 'Gleichmäßige, geregelte Wärme über Stunden entzieht das Wasser, ohne das Filament zu verformen.', ['Eher lang und sanft oder kurz und heiß?', 'Die Temperatur muss geregelt sein.']],
    ['Warum darf die Trockentemperatur nicht zu hoch sein?', 'Filament und Spule können sich verformen, wenn sie zu warm werden', ['Heißes Filament nimmt mehr Feuchte auf', 'Es wird dann leitfähig', 'Die Farbe wird entzogen'], 'Jedes Material wird ab einer bestimmten Temperatur weich. Die Trockentemperatur liegt deutlich darunter.', ['Was passiert mit PLA bei 80 °C?', 'Beachte die Angaben der Spule.']],
    ['Was kann bei einem Teil aus feuchtem Filament passieren?', 'Raue, blasige Oberfläche und schwächere Verbindung der Schichten', ['Es wird dichter und fester', 'Es lässt sich besser von Stützen lösen', 'Nichts, Feuchte hat nie Einfluss'], 'Dampfbläschen schwächen die Raupe und hinterlassen Löcher in der Oberfläche.', ['Was machen Bläschen im Kunststoff?', 'Löcher sind Schwachstellen.']],
    ['Wie lange trocknet Filament bei der empfohlenen Temperatur ungefähr?', 'Mehrere Stunden, je nach Material etwa 4 bis 12', ['Wenige Sekunden', 'Etwa 10 Minuten', 'Mehrere Wochen'], 'Das Wasser muss langsam aus dem Kunststoff diffundieren. Das dauert Stunden.', ['Geht das Wasser schnell aus dem Inneren?', 'Wieviel Zeit hat ein Trockner nach der Tabelle?']]
  ];
  const ANWQ = [
    ['Ein Griff soll sich beim Zudrücken leicht verformen und wieder zurückfedern. Welches Material nimmst du?', 'TPU', ['PLA', 'ABS', 'ASA'], 'Nur TPU ist gummiartig und federt zurück.', ['Welches Material ist elastisch?', 'Schau in die Sterne für Flexibilität.']],
    ['Ein Gehäuse wird an einer Fassade im Freien befestigt, Sonne und Regen. Welches Material nimmst du?', 'ASA', ['PLA', 'TPU', 'ABS'], 'ASA ist wetter- und UV-beständig, ABS vergilbt, PLA verformt sich in der Sonne.', ['Was gibt es gegen UV?', 'Vergleiche ASA mit ABS.']],
    ['Ein schneller Funktionsprototyp für den Schreibtisch, ohne Wärme- oder Dauerlast. Welches Material nimmst du?', 'PLA', ['ABS', 'ASA', 'TPU'], 'PLA druckt einfach und schnell, die Wärmeformbeständigkeit spielt hier keine Rolle.', ['Was ist am einfachsten zu drucken?', 'Es braucht keine Einhausung.']],
    ['Ein Halter an der Werkbank soll zäh und wasserbeständig sein und sich ohne Einhausung drucken lassen. Welches Material nimmst du?', 'PETG', ['PLA', 'ASA', 'TPU'], 'PETG ist zäh und druckt ohne Einhausung. PLA ist spröde, ASA braucht ein Gehäuse, TPU ist zu weich.', ['Zäh und ohne Einhausung.', 'Es liegt zwischen PLA und ABS.']],
    ['Ein Teil bleibt dauerhaft bei etwa 80 °C. Welches der Materialien eignet sich am ehesten?', 'ASA', ['PLA', 'PETG', 'TPU'], 'PLA und PETG werden bei dieser Temperatur weich, TPU ebenfalls. ASA hält mehr Wärme aus.', ['Wo liegen die Sterne für Hitze am höchsten?', 'Nenne die Materialien mit Einhausung.']]
  ];

  /* ---------- Slicer-Einstellungen ---------- */
  const BEGRQ = [
    ['Was ist die Schichthöhe?', 'Die Dicke einer einzelnen gedruckten Schicht in Millimetern', ['Die Höhe des fertigen Teils', 'Der Abstand zwischen Hotend und Tisch', 'Die Höhe der Bauplatte über dem Boden'], 'Je dünner die Schicht, desto feiner das Teil, desto mehr Schichten und desto länger der Druck.', ['Es ist ein Maß für eine einzelne Schicht.', 'Typisch sind 0,08 bis 0,28 mm.']],
    ['Was sind die Wände (Wandlinien, englisch Wall loops)?', 'Die Umrisslinien, die außen um jede Schicht laufen und die Außenhaut bilden', ['Die Wände des Druckerraums', 'Das Gitter im Inneren des Teils', 'Die Stützen unter Überhängen'], 'Mehrere Wandlinien nebeneinander ergeben eine dickere, festere Außenhaut.', ['Sie liegen außen, nicht innen.', 'Mehr Wände sind fester.']],
    ['Was ist die Füllung (Infill)?', 'Das Muster im Inneren des Teils zwischen den Wänden, angegeben in Prozent', ['Die Menge Filament auf der Spule', 'Die Schicht direkt auf der Platte', 'Das Material der Stützen'], 'Die Füllung hält die Wände auseinander und trägt die Deckschichten.', ['Wo liegt sie im Teil?', 'Sie hat ein Muster und eine Dichte.']],
    ['Was bedeutet eine Fülldichte von 100 %?', 'Das Innere des Teils wird vollständig ausgefüllt', ['Das Teil wird mit 100 mm/s gedruckt', 'Das Teil bekommt 100 Schichten', 'Das Teil bekommt 100 Stützen'], 'Bei 100 % bleibt im Inneren kein Hohlraum. Das braucht viel Material und Zeit.', ['Prozent von was? Vom Innenraum.', 'Voll ist voll.']],
    ['In Bambu Studio gibt es drei Arten von Profilen: Drucker, Filament und Prozess. Welches Profil legt Düsendurchmesser und Bauraum fest?', 'Das Druckerprofil', ['Das Filamentprofil', 'Das Prozessprofil', 'Das Farbprofil'], 'Das Druckerprofil beschreibt die Maschine: Bauraum, Düse, Ausstattung.', ['Was gehört zur Maschine, was zum Material?', 'Düse und Bauraum sind Maschine.']],
    ['In Bambu Studio sind Drucker, Filament und Prozess getrennte Profile. In welchem stehen Temperaturen und Materialfluss des Filaments?', 'Im Filamentprofil', ['Im Druckerprofil', 'Im Prozessprofil', 'Im Plattenprofil'], 'Das Filamentprofil gehört zum Material: Temperaturen, Fluss, Lüfter.', ['Was hängt am Material?', 'Temperaturen gehören zum Filament.']],
    ['Welches Profil enthält Schichthöhe, Wände, Füllung und Geschwindigkeiten?', 'Das Prozessprofil', ['Das Druckerprofil', 'Das Filamentprofil', 'Das Stützprofil'], 'Das Prozessprofil beschreibt, wie gedruckt wird: Schichthöhe, Wände, Füllung, Stützen, Tempo.', ['Wie gedruckt wird, nicht womit.', 'Schichthöhe und Füllung sind Prozess.']],
    ['Was zeigt die Vorschau im Slicer?', 'Wie das Teil Schicht für Schicht gedruckt wird, mit Wänden, Füllung, Stützen und geschätzter Zeit', ['Nur das Modell von außen ohne Schichten', 'Die Temperatur des Bauraums live', 'Die Stückliste des Teils'], 'In der Vorschau prüfst du, ob Stützen fehlen, Wände dünn sind oder die Zeit passt, bevor du druckst.', ['Wofür dient die Vorschau vor dem Druck?', 'Sie zeigt jede Schicht.']]
  ];
  const MUSTQ = [
    ['Welches Füllmuster druckt meist am schnellsten?', 'Linien', ['Gyroid', 'Waben', 'Ein Muster mit vielen Kurven'], 'Gerade Linien haben wenige Richtungswechsel. Waben und Gyroid brauchen mehr Fahrwege.', ['Wenig Kurven, wenig Zeit.', 'Gerade Linien sind einfach.']],
    ['Wofür ist das Gyroid-Muster bekannt?', 'Es ist in allen Raumrichtungen ähnlich belastbar, ein durchgehender wellenförmiger Aufbau', ['Es ist nur für flexibles Material', 'Es ist die dichteste Füllung', 'Es druckt gar kein Material'], 'Beim Gyroid gibt es keine ausgezeichnete Richtung. Es druckt aber langsamer als Linien.', ['Wellen, keine Gerade.', 'Alle Richtungen ähnlich.']],
    ['Du willst ein Teil fester machen und dabei möglichst wenig Material zusetzen. Was bringt meist mehr?', 'Eine Wand mehr', ['Füllung von 15 auf 17 %', 'Die Farbe ändern', 'Das Bett kühler stellen'], 'Die Wände tragen die Last außen, wo die Spannung am größten ist. Eine zusätzliche Wand bringt mehr als ein paar Prozent Füllung.', ['Wo sitzt das Material bei Biegung wirksamer?', 'Außen trägt mehr als innen.']],
    ['Warum genügt für ein Anschauungsmodell oft eine Füllung von 5 bis 15 %?', 'Es spart Material und Zeit, weil das Teil innen kaum belastet wird', ['Höhere Füllung lässt sich nicht drucken', 'Sonst würden die Wände dünner', 'Sonst verstopft die Düse'], 'Wo nichts trägt, ist wenig Füllung genug. Die Deckschichten brauchen nur eine Unterlage.', ['Was soll das Modell aushalten?', 'Mehr Füllung heißt mehr Zeit.']],
    ['Was sind Deck- und Bodenschichten?', 'Vollflächige Schichten, die die Füllung nach oben und unten abschließen', ['Stützen unter Überhängen', 'Die Wandlinien außen', 'Die Randlinien des Brims'], 'Oben und unten wird das Teil geschlossen, damit die Füllung nicht sichtbar bleibt.', ['Wie schließt man ein Gitter nach oben?', 'Voll, ohne Lücken.']],
    ['Was passiert bei 0 % Füllung?', 'Das Innere bleibt hohl, es werden nur Wände, Deck- und Bodenschichten gedruckt', ['Das Teil wird nicht gedruckt', 'Das Teil wird komplett gefüllt', 'Die Stützen füllen das Innere'], 'Ohne Füllung ist das Teil leicht und schnell, trägt aber keine Last auf den Deckschichten.', ['0 heißt nichts innen.', 'Hülle bleibt.']]
  ];
  const STUETZQ = [
    ['Wann braucht ein Teil Stützen?', 'Wenn Flächen stärker als 45 Grad gegen die Senkrechte überhängen oder frei in der Luft liegen', ['Immer, sonst haftet es nicht', 'Nur bei Teilen aus TPU', 'Wenn das Teil größer als 10 cm ist'], 'Unter einer überhängenden Fläche ist Luft. Dort muss Material zum Tragen gedruckt werden.', ['Was liegt unter der Fläche?', 'Die Faustregel nennt 45 Grad.']],
    ['Was ist ein Vorteil von Baumstützen (Tree Support)?', 'Sie brauchen weniger Material, berühren das Teil nur an wenigen Stellen und lassen sich oft leichter entfernen', ['Sie sind immer stabiler als normale Stützen', 'Sie machen Stützen bei jedem Überhang überflüssig', 'Sie werden mit einem zweiten Drucker gedruckt'], 'Baumstützen verzweigen sich und berühren das Teil punktuell. Das spart Material und hinterlässt weniger Spuren.', ['Wie sieht ein Baum aus?', 'Wenige Berührungspunkte.']],
    ['Was bewirkt ein größerer Abstand zwischen Stütze und Teil?', 'Die Stütze lässt sich leichter lösen, die Fläche darüber wird aber oft rauer', ['Die Stütze haftet fester, die Fläche wird glatter', 'Die Stütze wird nicht mehr gedruckt', 'Das Teil wird schneller fertig gedruckt'], 'Ein Spalt zwischen Stütze und Teil macht das Lösen leichter. Dafür liegt die Fläche weniger fest auf.', ['Was gewinnst du, was verlierst du?', 'Lösen und Oberfläche stehen im Konflikt.']],
    ['Wie vermeidest du Stützen schon in der Konstruktion?', 'Überhänge flacher als 45 Grad zur Senkrechten halten, Fasen statt waagerechter Flächen, Teil geschickt drehen', ['Dickere Wände wählen', 'Das Teil kleiner skalieren', 'Das Bett heißer einstellen'], 'Mit Fasen und geschickter Ausrichtung entstehen weniger freie Flächen. Das spart Material und Nacharbeit.', ['Was macht einen Überhang?', 'Eine schräge Fläche ersetzt eine waagerechte.']],
    ['Was geschieht bei einem großen Überhang ohne Stütze?', 'Das Filament hängt durch oder fällt herab, die Unterseite wird rau oder der Druck scheitert', ['Das Filament wird fester', 'Die Düse heizt weniger', 'Nichts, Filament trägt sich selbst'], 'Frisches Filament ist weich. Ohne Unterlage sinkt es ab, bevor es fest ist.', ['Warum ist frisches Filament weich?', 'Was trägt es?']],
    ['Was ist eine Brücke beim 3D-Druck?', 'Eine waagerechte Strecke, die zwischen zwei Stützpunkten frei überspannt wird', ['Eine Wand mit Loch', 'Ein senkrechter Zylinder', 'Die erste Schicht auf der Platte'], 'Eine Brücke wird zwischen zwei Seiten gespannt. Kurze Brücken gelingen oft ohne Stütze, lange nicht.', ['Zwei Pfeiler, dazwischen Luft.', 'Wie bei einer echten Brücke.']]
  ];
  const BRIMQ = [
    ['Wofür ist ein Brim?', 'Eine dünne, flache Randzone um das Teil an der ersten Schicht, die die Haftfläche vergrößert', ['Eine Stütze unter Überhängen', 'Ein Turm für den Farbwechsel', 'Eine Füllung im Teil'], 'Der Brim hängt an der ersten Schicht des Teils und wird nach dem Druck abgelöst.', ['Er wird nur an der ersten Schicht gedruckt.', 'Mehr Fläche haftet besser.']],
    ['Für welches Teil nimmst du Brim?', 'Für ein hohes, schmales Teil oder ein Material, das sich verzieht, zum Beispiel ABS', ['Für ein flaches, breites PLA-Teil mit großer Auflage', 'Für ein Teil mit sehr viel Füllung', 'Für ein Teil mit 0,08 mm Schichthöhe'], 'Wenig Auflagefläche und starker Verzug sind die Fälle, in denen ein Brim hilft.', ['Wann ist die Auflage klein?', 'Wann will das Teil hoch?']],
    ['Wie unterscheidet sich der Skirt vom Brim?', 'Der Skirt liegt mit Abstand um das Teil und dient zum Einlaufen der Düse, der Brim hängt am Teil', ['Der Skirt ist eine Stütze', 'Brim gibt es nur beim Mehrfarbdruck', 'Es gibt keinen Unterschied'], 'Skirt heißt Rock: eine Linie ringsherum, die das Teil nicht berührt. Der Brim ist angebaut.', ['Wer berührt das Teil?', 'Abstand oder angebaut.']],
    ['Auf der Platte sind Fingerabdrücke oder Fett. Was passiert?', 'Die erste Schicht haftet schlecht, das Teil löst sich oder verzieht sich', ['Das Teil haftet besser', 'Die Düse verstopft sofort', 'Das Filament wird feucht'], 'Fett wirkt als Trennschicht. Reinige die Platte vor dem Druck und fasse die Druckfläche nicht an.', ['Was trennt Kunststoff von Metall?', 'Hände hinterlassen Fett.']],
    ['Wie reinigst du eine PEI-Platte vor dem Druck?', 'Nach Herstellerangabe, zum Beispiel mit Wasser und Spülmittel, und ohne die Fläche mit den Fingern zu berühren', ['Mit Schleifpapier', 'Mit einem Metallschaber über die Fläche kratzen', 'Mit Öl abreiben'], 'Schleifen und Kratzen zerstören die Oberfläche, Öl verhindert die Haftung.', ['Was entfernt Fett, ohne zu kratzen?', 'Der Hersteller nennt Mittel.']],
    ['Was ergibt die glatte PEI-Oberfläche an der Unterseite des Teils?', 'Eine glatte, glänzende Unterseite', ['Eine raue, strukturierte Unterseite', 'Gar keine Haftung', 'Eine Unterseite mit Brim-Rand dauerhaft'], 'Die Oberfläche der Platte prägt die Unterseite: glatt auf glatt, fein strukturiert auf strukturiert.', ['Die Platte prägt das Teil.', 'Glatt ergibt glatt.']],
    ['Was ist ein Merkmal der strukturierten PEI-Oberfläche?', 'Die Unterseite bekommt eine feine, matte Struktur und das Teil haftet meist gut', ['Die Unterseite wird spiegelglatt', 'Sie braucht nie Reinigung', 'Sie ist nur für TPU geeignet'], 'Die Struktur verdeckt kleine Unebenheiten und gibt den Teilen unten ein mattes Aussehen.', ['Struktur ergibt Struktur.', 'Matt statt glänzend.']]
  ];
  const MEHRQ = [
    ['Wofür ist der Spülturm (Prime Tower)?', 'An ihm wird die Düse bei jedem Farbwechsel gespült, damit keine Reste der alten Farbe ins Teil kommen', ['Er stützt Überhänge', 'Er kühlt das Hotend', 'Er hält das Teil auf der Platte'], 'Beim Farbwechsel steckt noch die alte Farbe in der Düse. Sie wird am Spülturm ausgedrückt.', ['Was steckt nach einem Wechsel noch in der Düse?', 'Der Turm steht neben dem Teil.']],
    ['Was kostet beim Mehrfarbdruck mit Filamentwechsler zusätzlich Zeit und Material?', 'Jeder Farbwechsel: Filament zurückziehen, neues laden, spülen', ['Die Auswahl der Farbe im Slicer', 'Das Aufheizen des Bettes', 'Die Anzahl der Wände'], 'Je Wechsel entstehen Wartezeit und Abfall am Spülturm. Mehr Wechsel bedeutet mehr Kosten.', ['Was geschieht bei einem Wechsel?', 'Abfall und Zeit.']],
    ['Wie verringerst du den Abfall beim Mehrfarbdruck?', 'Die Farben so verteilen, dass es insgesamt weniger Farbwechsel gibt', ['Mehr Farben verwenden', 'Den Spülturm größer machen', 'Die Düse kälter stellen'], 'Weniger Wechsel heißt weniger Spülen. Farben in wenigen Schichten bündeln spart.', ['Wo entsteht der Abfall?', 'Weniger Wechsel, weniger Abfall.']],
    ['Was passiert, wenn beim Farbwechsel zu wenig gespült wird?', 'Die neue Farbe ist an Kanten mit Resten der alten verunreinigt', ['Die Düse friert fest', 'Das Teil wird schwerer', 'Der Spülturm wird zu hoch'], 'Reste der alten Farbe mischen sich in die neue. Das sieht man als Farbschleier.', ['Was bleibt in der Düse?', 'Mischfarbe.']],
    ['Ein Filamentwechsler hat vier Spulen. Was bedeutet das für den Druck?', 'Es sind bis zu vier Farben oder Materialien ohne Spulenwechsel von Hand möglich', ['Es ist genau eine Farbe, die anderen sind Reserve', 'Es sind beliebig viele Farben', 'Es werden nur Stützen mehrfarbig'], 'Vier Plätze erlauben vier Filamente in einem Druck. Mehr Farben brauchen einen Spulenwechsel.', ['Vier Spulen, vier Plätze.', 'Mehr als vier geht nicht allein.']],
    ['Welche Aussage über Profile im Mehrfarbdruck stimmt?', 'Jede Spule hat ihr eigenes Filamentprofil, und die Materialien müssen zu ähnlichen Temperaturen passen', ['Es gibt nur ein Profil für alle Farben', 'Profile sind beim Mehrfarbdruck abgeschaltet', 'Es zählt nur das Druckerprofil'], 'Die Düse druckt abwechselnd mit allen Materialien. Sehr unterschiedliche Temperaturen verhindern das.', ['Jedes Filament bringt seine Temperatur mit.', 'Die Düse hat nur eine Temperatur.']]
  ];
  const ABLQ = [
    ['Was machst du im Slicer als allerersten Schritt?', 'Das Modell importieren und auf der Platte platzieren', ['Die Vorschau prüfen', 'Den Druck starten', 'Das fertige Teil entnehmen'], 'Ohne Modell gibt es nichts zu schneiden. In Bambu Studio ist das die Ansicht Prepare (Platte vorbereiten).', ['Was braucht der Slicer als Erstes?', 'Das Modell muss auf die Platte.']],
    ['Was machst du direkt nach dem Slicen (Platte berechnen)?', 'Die Vorschau Schicht für Schicht ansehen und prüfen', ['Den Slicer schließen', 'Das Filament wechseln', 'Das Modell neu konstruieren'], 'Die Vorschau zeigt, ob Stützen fehlen, ob Wände dünn sind und wie lange der Druck dauert. In Bambu Studio heißt die Ansicht Preview.', ['Was prüfst du, bevor du druckst?', 'Fehler siehst du am billigsten in der Vorschau.']],
    ['In der Vorschau siehst du, dass unter dem Arm des Halters nichts gedruckt wird. Was tust du?', 'Stützen einschalten und neu slicen', ['Nichts, das Filament hält sich selbst', 'Das Bett heißer stellen', 'Die Düse wechseln'], 'Fehlt die Unterlage, entsteht ein Überhang in der Luft. Stützen schaffen die Unterlage.', ['Was fehlt unter dem Arm?', 'Nach der Änderung muss neu geschnitten werden.']],
    ['Die Vorschau zeigt 9 Stunden Druckzeit, du hast nur 2. Was ist ein sinnvoller Hebel?', 'Schichthöhe vergrößern, Füllung oder Wände verringern', ['Schichthöhe verkleinern', 'Mehr Stützen einschalten', 'Mehr Farben verwenden'], 'Dickere Schichten und weniger Linien verkürzen den Druck. Weitere Stützen und Farbwechsel verlängern ihn.', ['Was erzeugt mehr Schichten?', 'Dicker ist schneller.']],
    ['Du wechselst von PLA auf PETG, lässt aber das Filamentprofil unverändert. Was kann passieren?', 'Die Temperaturen passen nicht zum Material, der Druck haftet schlecht oder misslingt', ['Nichts, Profile sind nur Dekoration', 'Der Drucker stellt sich automatisch richtig ein', 'Das Filament wird dunkler'], 'Das Filamentprofil enthält Temperaturen und Fluss. Wer es nicht ändert, druckt mit falschen Werten.', ['Was steht im Filamentprofil?', 'PLA und PETG haben verschiedene Temperaturen.']],
    ['Was gehört zum Vorbereiten der Platte?', 'Passende Platte einlegen und reinigen, Modell ausrichten, Profile prüfen', ['Nur die Farbe der Platte wählen', 'Den Drucker in Wasser stellen', 'Die Düse ausbauen'], 'Vor dem Slicen stimmen Platte, Ausrichtung und Profile. So vermeidest du Haftungsfehler und falsche Werte.', ['Was liegt auf dem Bett?', 'Was ändert sich je Material?']]
  ];

  /* ---------- Fehlerbilder ---------- */
  const WARPQ = [
    ['Ein ABS-Teil hebt an den Ecken ab. Welche Maßnahme hilft zuerst?', 'Bett auf den Bereich des Materials erwärmen, Lüfter klein halten, Brim einschalten', ['Düse kälter und Lüfter auf 100 %', 'Schichthöhe auf 0,28 mm erhöhen', 'Füllung auf 100 % stellen'], 'Verzug kommt vom ungleichen Abkühlen. Warmes Bett, wenig Lüfter und mehr Haftfläche halten die Ecken unten.', ['Was soll die Ecke unten halten?', 'Kühle Luft macht es schlimmer.']],
    ['Warum verzieht sich ABS stärker als PLA?', 'Es schrumpft beim Abkühlen stärker, die oberen Schichten ziehen die unteren hoch', ['Es braucht eine dickere Düse', 'Es schmilzt bei niedrigerer Temperatur', 'Es ist schwerer'], 'Beim Abkühlen zieht sich der Kunststoff zusammen. Je größer die Schrumpfung, desto stärker der Zug an den Ecken.', ['Was macht Kunststoff beim Abkühlen?', 'Wer zieht an den unteren Schichten?']],
    ['Wie wirkt Zugluft auf einen Druck?', 'Sie kühlt das Teil ungleichmäßig und fördert Warping', ['Sie hilft gegen Warping', 'Sie macht das Teil schwerer', 'Sie hat keinen Einfluss'], 'Zugluft kühlt eine Seite schneller als die andere. Die Spannung verzieht das Teil.', ['Kühlt Zugluft alle Seiten gleich?', 'Ungleich heißt Spannung.']],
    ['Welche Form verzieht sich eher?', 'Ein langes, flaches Teil mit scharfen Ecken', ['Ein kleiner runder Knopf', 'Ein hoher, dünner Zylinder', 'Ein Teil mit abgerundeten Ecken'], 'Lange Kanten schrumpfen stark, scharfe Ecken sind die Stellen mit dem größten Zug.', ['Wo sammelt sich die Spannung?', 'Lange Strecke, große Schrumpfung.']],
    ['Wie änderst du das Modell, um Warping zu verringern?', 'Ecken am Boden abrunden oder mit einer Fase versehen', ['Das Teil dünner machen', 'Das Teil auf Stützen stellen', 'Die Wände aus dem Modell löschen'], 'Abgerundete Ecken nehmen die Spannung auf, ohne dass sie sich an einer Spitze konzentriert.', ['Wo ist die Spannung am größten?', 'Runde Formen verteilen sie.']]
  ];
  const STRINGQ = [
    ['Zwischen zwei Türmchen sind feine Fäden. Welche Einstellung änderst du zuerst?', 'Rückzug erhöhen und die Düse etwas kühler stellen', ['Bett kühler', 'Füllung höher', 'Schichthöhe kleiner'], 'Fäden entstehen, wenn bei Leerfahrten Material nachläuft. Rückzug und kühlere Düse stoppen das.', ['Was läuft nach?', 'Zurückziehen und kühler.']],
    ['Wie hängt die Düsentemperatur mit Fäden zusammen?', 'Zu heißes Filament ist dünnflüssig und tropft nach', ['Zu kaltes Filament tropft nach', 'Nur das Bett beeinflusst Fäden', 'Fäden entstehen nur bei TPU'], 'Je heißer, desto dünnflüssiger. Dünnflüssiges Material läuft aus der Düse, auch wenn der Extruder steht.', ['Wann läuft etwas aus?', 'Heißer heißt dünner.']],
    ['Was macht der Rückzug (Retraction)?', 'Der Extruder zieht das Filament vor einer Leerfahrt kurz zurück, damit nichts nachtropft', ['Er zieht die Düse hoch', 'Er schaltet den Lüfter aus', 'Er vergrößert die Füllung'], 'Durch das Zurückziehen sinkt der Druck in der Düse, und das Material bleibt dort.', ['Was bewegt der Extruder?', 'Zurück statt vor.']],
    ['Es entstehen Fäden und dazu kleine Bläschen. Was ist die wahrscheinliche Ursache?', 'Feuchtes Filament', ['Zu große Schichthöhe', 'Zu kaltes Bett', 'Zu viele Wände'], 'Wasserdampf bildet Bläschen und lässt Material nachlaufen. Trocknen hilft.', ['Was zischt in der Düse?', 'Wasser im Kunststoff.']],
    ['Warum können lange Leerfahrten zwischen den Teilen mehr Fäden erzeugen?', 'Die Düse hat mehr Zeit zum Nachtropfen', ['Die Düse wird auf dem Weg kälter', 'Das Bett heizt dabei die Düse', 'Der Lüfter bläst Fäden an'], 'Je länger die Düse über freier Fläche fährt, desto mehr Material kann herauslaufen.', ['Was passiert mit der Zeit?', 'Länger heißt mehr Tropfen.']]
  ];
  const FUSSQ = [
    ['Das Teil ist unten breiter als oben. Was ist die Ursache?', 'Die ersten Schichten wurden zu heiß oder zu stark angedrückt und quellen nach außen', ['Zu wenig Filament in der Düse', 'Zu große Schichthöhe oben', 'Zu viel Lüfter'], 'Heiße, weiche Schichten werden von der Last darüber nach außen gedrückt: Elefantenfuß.', ['Wo ist der Fuß?', 'Warm und gedrückt quillt aus.']],
    ['Welche Einstellung verringert einen Elefantenfuß?', 'Bett etwas kühler und die erste Schicht weniger stark andrücken', ['Bett heißer', 'Mehr Füllung', 'Breiterer Brim'], 'Kühleres Bett lässt die untersten Schichten schneller fest werden. Weniger Druck verhindert das Auspressen.', ['Was macht die unteren Schichten weich?', 'Weniger Wärme, weniger Druck.']],
    ['Die Wände haben Lücken und die Linien sind dünn. Welche Ursache liegt nahe?', 'Unterextrusion: Düse zu kalt, zu schneller Druck oder zu wenig Material', ['Zu viel Füllung', 'Zu warmes Bett', 'Zu viele Wände'], 'Kommt weniger Material aus der Düse als gebraucht, bleiben Lücken.', ['Zu wenig Material, wo?', 'Düse kalt oder zu schnell.']],
    ['Was prüfst du bei Unterextrusion zuerst?', 'Düsentemperatur, Filament (Feuchte, Durchmesser) und die Düse bzw. den Extruder auf Verstopfung', ['Die Farbe des Filaments', 'Die Größe der Bauplatte', 'Die Zahl der Stützen'], 'Die Ursache liegt auf dem Weg des Filaments von der Spule bis zur Düse.', ['Wo fließt das Filament?', 'Spule bis Düse.']],
    ['Warum kann zu hohe Geschwindigkeit zu Unterextrusion führen?', 'Das Hotend schafft es nicht, so viel Filament so schnell zu schmelzen', ['Das Bett wird zu kalt', 'Das Filament wird dicker', 'Der Lüfter kühlt das Bett'], 'Das Hotend hat einen Höchstwert an Material, den es je Sekunde schmelzen kann. Darüber kommt zu wenig heraus.', ['Wie viel Material je Sekunde?', 'Ein Hotend schmilzt nur begrenzt viel.']]
  ];
  const KALQ = [
    ['Die erste Schicht liegt nur lose auf, weil die Düse zu weit von der Platte entfernt ist. Was tust du?', 'Den Abstand der ersten Schicht verringern (Kalibrierung) und die Platte reinigen', ['Bett kühler stellen', 'Brim entfernen', 'Die Düse höher fahren'], 'Die Linie muss leicht an die Platte gedrückt werden. Zu großer Abstand lässt sie nur auflegen.', ['Zu weit weg heißt was?', 'Näher heran.']],
    ['Die erste Schicht ist so stark gedrückt, dass sie durchscheint und die Linien verschmieren. Was heißt das?', 'Die Düse ist zu nah an der Platte', ['Zu wenig Hitze am Bett', 'Das Filament ist zu trocken', 'Zu viele Wände'], 'Bei zu kleinem Abstand wird die Raupe breit gedrückt und verschmiert.', ['Zu nah oder zu weit?', 'Gequetscht heißt zu nah.']],
    ['Wofür ist die automatische Bettnivellierung?', 'Sie misst die Platte und gleicht Höhenunterschiede aus, damit die erste Schicht überall gleich dicht liegt', ['Sie wechselt die Düse', 'Sie trocknet das Filament', 'Sie rechnet die Druckzeit'], 'Die Platte ist nie perfekt eben. Der Drucker misst und gleicht es beim Fahren aus.', ['Was misst der Drucker vor dem Druck?', 'Ebene Fläche.']],
    ['Wofür ist die Kalibrierung des Materialflusses?', 'Sie stimmt die Materialmenge so ab, dass die Linien weder Lücken noch Überschuss haben', ['Sie stellt die Bettfarbe ein', 'Sie ändert die Düsengröße', 'Sie misst die Raumtemperatur'], 'Jedes Filament fließt etwas anders. Die Kalibrierung gleicht das aus.', ['Was soll genau stimmen?', 'Menge je Strecke.']],
    ['Nach einem Düsenwechsel oder mit einem neuen Filament: Was ist sinnvoll?', 'Kalibrieren und einen kleinen Testdruck ansehen', ['Sofort einen 10-Stunden-Druck starten', 'Alle Profile löschen', 'Die Platte weglassen'], 'Wer neue Teile oder Material einsetzt, prüft zuerst klein. Das spart im Fehlerfall viel Zeit.', ['Was ist billiger: Test oder 10 Stunden?', 'Klein anfangen.']],
    ['Warum schaust du dir die ersten Schichten eines langen Drucks an?', 'Hier entscheidet sich, ob das Teil haftet, spätere Fehler sind oft die Folge', ['Hier sieht man die Farbe', 'Hier wird die Füllung gedruckt', 'Hier wird das Filament getrocknet'], 'Löst sich das Teil später, begann das Problem meist in der ersten Schicht.', ['Wo beginnt jede Haftung?', 'Gute Schicht eins.']]
  ];

  /* ---------- Konstruieren und Sicherheit ---------- */
  const AUSQ = [
    ['Auf einen Winkelhalter wirkt später eine Kraft, die versucht, den Arm abzuknicken. Wie legst du das Teil auf die Platte?', 'So, dass die Kraft die Schichten nicht auseinanderziehen will (Belastung liegt in der Ebene der Schichten)', ['Egal, die Richtung spielt für die Festigkeit keine Rolle', 'Immer auf der kleinsten Fläche stehend', 'Möglichst hoch, damit viele Schichten entstehen'], 'Die Verbindung zwischen den Schichten ist die Schwachstelle. Zug quer zu den Schichten reißt dort.', ['Wo ist das Teil am schwächsten?', 'Quer zu den Schichten.']],
    ['Warum legst du ein Teil mit großer, ebener Unterseite möglichst darauf ab?', 'Große Auflage haftet gut und braucht weniger Stützen', ['Es druckt dann garantiert schneller', 'Die Oberseite wird dann glatter', 'Es braucht dann keine Platte'], 'Eine große ebene Fläche auf der Platte hält das Teil und braucht darunter keine Stütze.', ['Wo haftet das Teil?', 'Fläche auf Fläche.']],
    ['Ein waagerechtes Loch (Achse parallel zur Platte) liegt in einem Block. Wo entsteht der Überhang?', 'Am oberen Bogen des Lochs', ['Am unteren Bogen', 'An den Seiten, wo die Wand senkrecht ist', 'Nirgends'], 'Oben im Loch hängt der Kreisbogen frei: Die Schicht darüber hat keine Unterlage.', ['Wo hat der Bogen Luft darunter?', 'Der obere Bogen zeigt nach unten.']],
    ['Wie machst du waagerechte Löcher oft ohne Stützen druckbar?', 'Die Lochdecke als Tropfen oder Raute mit Spitze nach oben gestalten', ['Als Quadrat mit flacher Decke', 'Als größeren Kreis', 'Mit dünnerer Düse'], 'Eine Spitze mit 45 Grad Neigung kommt ohne Stütze aus. Die flache Decke eines Quadrats hat 90 Grad.', ['Welche Form hat Flanken unter 45 Grad?', 'Eine Spitze nach oben.']],
    ['Wie drehst du ein Teil, damit eine Sichtfläche besonders sauber wird?', 'Die Sichtfläche steht senkrecht oder liegt oben, nicht auf Stützen', ['Sie liegt auf Stützen', 'Sie zeigt zur Platte über Stützen', 'Es ist egal'], 'Stützen hinterlassen Spuren. Flächen ohne Stützkontakt werden am glattesten.', ['Wo hinterlassen Stützen Spuren?', 'Wo gibt es keine?']],
    ['Welche Ausrichtung ist bei einem hohen, schlanken Teil riskant?', 'Stehend: Es kann wackeln oder abbrechen, ein Brim hilft', ['Liegend verliert es Material', 'Beim Liegen entstehen immer Fäden', 'Beim Stehen gibt es keine Schichten'], 'Ein hohes Teil mit kleiner Auflage ist instabil. Brim oder Liegen verbessert den Stand.', ['Wie groß ist die Auflage?', 'Hoch und dünn kippt leicht.']]
  ];
  const SICHQ = [
    ['Wie heiß kann eine Düse beim Drucken werden?', 'Weit über 200 °C: Verbrennungsgefahr, nicht anfassen', ['Etwa 50 °C, ungefährlich', 'Nur handwarm', 'Nie über 100 °C'], 'Düse und Hotend erreichen je nach Material 200 bis 300 °C. Das Bett kann über 100 °C heiß werden.', ['Bei welcher Temperatur schmilzt PLA?', 'Heißer als ein Bügeleisen.']],
    ['Wann darfst du an Düse oder Hotend fassen?', 'Erst wenn alles abgekühlt ist, oder mit geeignetem Werkzeug nach Betriebsanweisung', ['Sofort, wenn der Druck angehalten ist', 'Mit nassen Fingern', 'Mit Stoffhandschuhen bei 250 °C'], 'Nach dem Stopp bleibt das Hotend noch lange heiß.', ['Wie schnell kühlt ein Metallblock?', 'Warten oder Werkzeug.']],
    ['Welche Vorsorge ist beim Drucken von ABS oder ASA sinnvoll?', 'Drucker in gut gelüftetem Raum, mit Absaugung oder Filter, und sich nicht lange daneben aufhalten', ['Fenster schließen, damit der Geruch bleibt', 'Den Raum zusätzlich heizen', 'Nichts, Dämpfe sind immer harmlos'], 'Beim Schmelzen entstehen Dämpfe und feine Partikel. Frische Luft und Filter verringern die Belastung.', ['Wohin sollen die Dämpfe?', 'Weg vom Arbeitsplatz.']],
    ['Wo stellst du einen Drucker auf?', 'Stabil, auf nicht brennbarer Unterlage, mit Abstand zu Papier und Spraydosen', ['Auf einem wackligen Karton', 'Auf dem Teppich, damit er leiser ist', 'Neben einer offenen Flamme'], 'Ein Drucker enthält heiße Teile. Brennbares gehört nicht in die Nähe.', ['Was brennt leicht?', 'Stabil und feuerfest.']],
    ['Du willst einen langen Druck über Nacht laufen lassen. Was beachtest du?', 'Betriebsanweisung beachten: unbeaufsichtigt nur, wenn erlaubt, mit Brandschutz wie Rauchmelder', ['Es ist immer erlaubt', 'Die Tür verriegeln', 'Das Filament in den Ofen legen'], 'Ein Drucker ist ein Gerät mit Heizung. Ob und wie er unbeaufsichtigt laufen darf, regelt der Betrieb.', ['Wer erlaubt das?', 'Heizung und Brand.']],
    ['Welche Gefahr droht an den bewegten Teilen eines offenen Druckers?', 'Einklemmen und Quetschen der Finger an Achsen und Riemen', ['Strahlung', 'Hochspannung am Filament', 'Keine'], 'Achsen und Riemen bewegen sich mit Kraft. Greife nicht hinein, solange der Drucker läuft.', ['Was bewegt sich?', 'Hände gehören raus.']],
    ['Was schützt dich beim Entfernen von Stützen mit Messer oder Zange?', 'Schutzbrille, Klinge vom Körper weg führen, auf stabiler Unterlage arbeiten', ['Nichts, Plastik ist weich', 'Messer zum Körper führen für mehr Kraft', 'Mit nassen Händen arbeiten'], 'Abbrechende Teile fliegen, Messer rutschen ab. Auge und Hände schützen.', ['Was kann abplatzen?', 'Schnittrichtung beachten.']],
    ['Was machst du mit Filament-Resten und Abfall?', 'Sammeln und nach den Regeln des Betriebs als Kunststoffabfall entsorgen', ['Im Waschbecken entsorgen', 'In der Heizung verbrennen', 'Auf dem Boden liegen lassen'], 'Kunststoff gehört nicht ins Wasser und nicht ins Feuer. Der Betrieb regelt die Sammlung.', ['Wohin mit Kunststoff?', 'Nicht in die Natur.']]
  ];
  const NACHQ = [
    ['Das Teil klebt fest auf der Platte. Was tust du?', 'Die Platte abkühlen lassen, biegen oder aus dem Drucker nehmen und das Teil lösen, ohne mit scharfer Klinge auf der Platte zu schaben', ['Mit dem Meißel abschlagen', 'Die Platte auf 200 °C erhitzen', 'Das Teil mit Gewalt abreißen'], 'Abgekühlt lässt die Haftung nach. Scharfe Werkzeuge zerkratzen die Platte.', ['Warm oder kalt löst es sich leichter?', 'Schützt die Platte.']],
    ['Warum lässt sich ein Teil nach dem Abkühlen oft leichter lösen?', 'Das Material schrumpft leicht und die Haftung auf der Platte lässt nach', ['Es wird flüssig', 'Es wird magnetisch', 'Es wird schwerer'], 'Beim Abkühlen zieht sich das Teil zusammen und löst sich von der Fläche.', ['Was macht Kunststoff beim Abkühlen?', 'Haftung nimmt ab.']],
    ['Wie lösen sich Stützen sauber?', 'Mit Zange oder Messer vorsichtig, Kontaktflächen bei Bedarf mit Schleifpapier nachbessern', ['Mit dem Hammer', 'Mit offener Flamme', 'Gar nicht'], 'Vorsichtig brechen und die rauen Stellen schleifen ergibt eine saubere Fläche.', ['Wie vermeidest du Beschädigung?', 'Werkzeug mit Gefühl.']],
    ['Wie lange wartest du bei großen ABS-Teilen vor dem Entnehmen?', 'Bis Bett und Bauraum abgekühlt sind', ['Sofort, damit es heiß weich bleibt', 'Genau 5 Sekunden', 'Bis das Filament abgelaufen ist'], 'Zu schnelles Abkühlen kann Risse und Verzug erzeugen. Langsam abkühlen lassen schützt.', ['Was passiert bei schnellem Abkühlen?', 'Warte bis zum Ende.']],
    ['Wie verbesserst du die Qualität der Unterseite?', 'Passende Platte wählen (glatt oder strukturiert) und die Oberfläche sauber halten', ['Mit weniger Brim', 'Mit immer kälterem Bett', 'Mit zusätzlichem Filament'], 'Die Unterseite hat das Aussehen der Platte. Sauber und passend gewählt ergibt sie ein gleichmäßiges Bild.', ['Wer prägt die Unterseite?', 'Die Platte.']]
  ];

  /* PRUEFEN: Alle Fragenpools sind Fachwissen in eigenen Worten (siehe quelle/drk/PRUEFEN.md). */
  const P = {
    teil: ['Lies, was das gesuchte Teil tut: schmelzen, schieben, formen, wärmen oder kühlen.', 'Gehe den Weg des Filaments gedanklich ab: Spule, Extruder, Hotend, Düse, Teil.', 'Wähle die Antwort, die genau zu dieser Aufgabe passt.'],
    verf: ['Lies, wie das Teil entsteht: Wird Material aufgetragen, abgetragen oder umgeformt?', 'Streiche Antworten, die zu anderen Verfahren gehören (Harz, Pulver, Fräsen).', 'Wähle die Antwort, die zu FDM und zur Fertigungsart passt.'],
    aufb: ['Lies, was am Drucker bewegt, gemessen oder geregelt wird.', 'Ordne es einem Bauteil zu: Motor, Fühler, Heizung oder Steuerung.', 'Wähle die Antwort, die diese Aufgabe erfüllt.'],
    duese: ['Lies, was an der Düse verändert wird: Durchmesser, Material oder Linienbreite.', 'Überlege: Dünnere Linie heißt mehr Details, aber mehr Strecke und mehr Zeit.', 'Wähle die Antwort, die zu dieser Folge passt.'],
    zuord: ['Lies die gesuchte Eigenschaft (weich, hitzebeständig, einfach, wetterfest).', 'Ordne sie den Materialien aus dem Reiter Filamente zu.', 'Wähle das Material, das die Eigenschaft besser erfüllt als die anderen.'],
    feucht: ['Denke daran, wie Feuchte ins Filament kommt: Es nimmt Wasser aus der Luft auf.', 'Überlege, was beim Schmelzen mit Wasser passiert: Es verdampft und bildet Bläschen.', 'Wähle die Antwort, die zu Feuchte, Lagerung oder Trocknen passt.'],
    anw: ['Notiere, was die Anwendung verlangt: Wärme, Wetter, Zähigkeit oder Flexibilität.', 'Vergleiche mit den Sternen der Materialien im Reiter Filamente.', 'Wähle das Material, das die wichtigste Anforderung erfüllt.'],
    begr: ['Lies den Begriff und denke an die Vorschau im Slicer (Reiter Vorschau).', 'Ordne ihn zu: außen (Wände), innen (Füllung), Dicke (Schichthöhe) oder Profil.', 'Wähle die Antwort, die den Begriff richtig beschreibt.'],
    must: ['Überlege, ob es um Tempo, Material oder Festigkeit geht.', 'Denke daran: Wände tragen die Last außen, die Füllung hält nur innen auseinander.', 'Wähle die Antwort, die dazu passt.'],
    stuetz: ['Frage dich: Liegt unter der Fläche Material oder Luft?', 'Prüfe die Neigung: Über 45 Grad gegen die Senkrechte braucht Stützen.', 'Wähle die Antwort, die dazu passt.'],
    brim: ['Überlege, was an der ersten Schicht entscheidend ist: Fläche, Sauberkeit, Temperatur.', 'Der Brim vergrößert die Fläche, Reinigung entfernt Fett, die Platte prägt die Unterseite.', 'Wähle die passende Aussage.'],
    mehr: ['Denke an den Weg des Filaments: Beim Wechsel muss die alte Farbe aus der Düse heraus.', 'Jeder Wechsel kostet Zeit und Material, das am Spülturm landet.', 'Wähle die Antwort, die dazu passt.'],
    abl: ['Gehe den Ablauf von der Datei bis zum fertigen Teil gedanklich durch.', 'Frage dich bei jeder Antwort: Kommt dieser Schritt an dieser Stelle?', 'Wähle die Antwort, die den Ablauf richtig fortsetzt.'],
    warp: ['Überlege: Verzug entsteht, wenn Teile beim Abkühlen ungleich schrumpfen.', 'Was hält die untere Schicht an Ort und Stelle: warmes Bett, Brim, wenig Zugluft, wenig Lüfter?', 'Wähle die Maßnahme oder Ursache, die zu Verzug passt.'],
    string: ['Fäden heißt: Es kommt Material aus der Düse, ohne dass gedruckt wird.', 'Was stoppt das Nachtropfen: Rückzug, kühlere Düse, trockenes Filament?', 'Wähle die Antwort, die das Nachtropfen erklärt oder stoppt.'],
    fuss: ['Beschreibe das Bild: Wulst unten, Lücken in den Wänden oder Fäden?', 'Ordne zu: Wulst unten heißt Fuß, Lücken heißen zu wenig Material.', 'Wähle die Ursache oder Maßnahme, die dazu gehört.'],
    kal: ['Wie sieht die erste Schicht aus: lose, verquetscht oder gleichmäßig?', 'Zu weit weg heißt lose Linien, zu nah heißt verquetscht.', 'Wähle die Maßnahme oder Aussage, die dazu passt.'],
    aus: ['Überlege, welche Flächen nach unten zeigen und wie stark sie geneigt sind.', 'Beachte die Richtung der Schichten: Quer zu den Schichten ist das Teil am schwächsten.', 'Wähle die Ausrichtung, die Stützen spart und die Belastung beachtet.'],
    sich: ['Lies, was droht: Hitze, Dämpfe, Quetschen, Brand oder Splitter.', 'Frage dich, was die Betriebsanweisung dazu verlangen würde.', 'Wähle die sichere Handlung.'],
    nach: ['Denke an Wärme: Heiß haftet das Teil stark, abgekühlt löst es sich meist besser.', 'Schütze Platte, Teil und Finger: kein Schaben mit scharfen Klingen auf der Platte.', 'Wähle die sichere und schonende Variante.']
  };

  /* ---------- Generatoren ---------- */
  const G = {
    teilq: pq(TEILQ, P.teil), verf: pq(VERFQ, P.verf), aufb: pq(AUFBQ, P.aufb), duesefrage: pq(DUESEQ, P.duese),
    zuord: pq(ZUORDQ, P.zuord), feucht: pq(FEUCHTQ, P.feucht), anw: pq(ANWQ, P.anw),
    begr: pq(BEGRQ, P.begr), must: pq(MUSTQ, P.must), stuetz: pq(STUETZQ, P.stuetz), brim: pq(BRIMQ, P.brim), mehr: pq(MEHRQ, P.mehr), abl: pq(ABLQ, P.abl),
    warp: pq(WARPQ, P.warp), string: pq(STRINGQ, P.string), fuss: pq(FUSSQ, P.fuss), kal: pq(KALQ, P.kal),
    aus: pq(AUSQ, P.aus), sich: pq(SICHQ, P.sich), nach: pq(NACHQ, P.nach),
    /* Verfahren und Druckerteile */
    platte: R => {
      const c = C(), Pl = c.pick(R, [220, 250, 256]), a = c.pick(R, [30, 40, 50, 60]), b = c.pick(R, [40, 50, 60, 70, 80]), g = 5, nx = Math.floor((Pl + g) / (a + g)), ny = Math.floor((Pl + g) / (b + g));
      return numQ('Die Bauplatte misst ' + f(Pl, 0) + ' × ' + f(Pl, 0) + ' mm. Du willst Teile mit je ' + f(a, 0) + ' × ' + f(b, 0) + ' mm Grundfläche drucken. Zwischen zwei Teilen bleiben ' + f(g, 0) + ' mm Abstand, am Rand kein Abstand. Alle Teile liegen gleich ausgerichtet, nichts wird gedreht. Wie viele Teile passen in einer Lage auf die Platte?', nx * ny, 'Teile', 'Teile je Platte', 0.01,
        'In einer Reihe: (' + f(Pl, 0) + ' + ' + g + ') / (' + f(a, 0) + ' + ' + g + ') = ' + f((Pl + g) / (a + g), 2) + ', abgerundet ' + f(nx, 0) + '. In der Tiefe: (' + f(Pl, 0) + ' + ' + g + ') / (' + f(b, 0) + ' + ' + g + ') = ' + f((Pl + g) / (b + g), 2) + ', abgerundet ' + f(ny, 0) + '. Zusammen ' + f(nx, 0) + ' · ' + f(ny, 0) + ' = ' + f(nx * ny, 0) + ' Teile.',
        ['Rechne getrennt in Breite und Tiefe, jedes Teil braucht seine Länge plus einen Abstand.', 'Nur ganze Teile zählen: runde ab. Zum Schluss multiplizieren.'],
        ['Zähle, wie viele Teile in die Breite passen: (Platte + Abstand) durch (Teil + Abstand), abrunden.', 'Zähle dasselbe für die Tiefe.', 'Multipliziere beide Zahlen.']);
    },
    /* Filamente */
    duese: R => {
      const c = C(), m = c.filOf(c.pick(R, ['pla', 'petg', 'abs', 'tpu'])), right = Math.round((m.nl + m.nh) / 2 / 5) * 5;
      const cand = [165, 180, 200, 215, 230, 245, 255, 270, 285, 300].filter(v => v < m.nl - 5 || v > m.nh + 5);
      return choiceQ(R, 'Du willst ' + m.n + ' drucken. Welche Düsentemperatur ist sinnvoll? (Übungswerte aus der Tabelle im Reiter Filamente.)', f(right, 0) + ' °C', c.shuffle(R, cand).slice(0, 3).map(v => f(v, 0) + ' °C'),
        m.n + ' wird bei ' + f(m.nl, 0) + ' bis ' + f(m.nh, 0) + ' °C gedruckt. ' + f(right, 0) + ' °C liegt im Bereich, die anderen Werte liegen darüber oder darunter. Das Datenblatt der Spule hat immer Vorrang.',
        ['Schlage ' + m.n + ' im Reiter Filamente nach.', 'Welcher Wert liegt im Bereich der Düsentemperatur?'],
        ['Suche ' + m.n + ' im Reiter Filamente und lies den Bereich der Düsentemperatur ab.', 'Prüfe jede Antwort: Liegt der Wert im Bereich?', 'Wähle den Wert im Bereich.']);
    },
    bett: R => {
      const c = C(), m = c.filOf(c.pick(R, ['pla', 'petg', 'abs', 'tpu'])), right = Math.round((m.bl + m.bh) / 2 / 5) * 5;
      const cand = [20, 25, 55, 60, 65, 80, 90, 100, 110].filter(v => v < m.bl - 4 || v > m.bh + 4);
      return choiceQ(R, 'Du willst ' + m.n + ' drucken. Welche Betttemperatur ist sinnvoll? (Übungswerte aus der Tabelle im Reiter Filamente.)', f(right, 0) + ' °C', c.shuffle(R, cand).slice(0, 3).map(v => f(v, 0) + ' °C'),
        m.n + ' wird mit ' + f(m.bl, 0) + ' bis ' + f(m.bh, 0) + ' °C Betttemperatur gedruckt. ' + f(right, 0) + ' °C liegt im Bereich. Zu kalt haftet das Teil schlecht, zu heiß gibt es Elefantenfuß.',
        ['Schlage ' + m.n + ' im Reiter Filamente nach.', 'Welcher Wert liegt im Bereich der Betttemperatur?'],
        ['Suche ' + m.n + ' im Reiter Filamente und lies den Bereich der Betttemperatur ab.', 'Prüfe jede Antwort: Liegt der Wert im Bereich?', 'Wähle den Wert im Bereich.']);
    },
    trockner: R => {
      const c = C(); let n, k, t;
      for (let i = 0; i < 100; i++) { n = c.pick(R, [3, 5, 7, 9, 10]); k = c.pick(R, [2, 3, 4]); t = c.pick(R, [6, 8]); if (n % k) break; }
      const d = Math.ceil(n / k);
      return numQ('Du hast ' + f(n, 0) + ' feuchte Spulen. Der Trockner nimmt ' + f(k, 0) + ' Spulen auf einmal auf, ein Durchgang dauert ' + f(t, 0) + ' Stunden. Wie viele Stunden dauert es, bis alle Spulen trocken sind?', d * t, 'h', 'Dauer', 0.01,
        'Durchgänge: ' + f(n, 0) + ' / ' + f(k, 0) + ' = ' + f(n / k, 2) + ', aufgerundet ' + f(d, 0) + ', denn ein angefangener Durchgang zählt voll. Dauer: ' + f(d, 0) + ' · ' + f(t, 0) + ' h = ' + f(d * t, 0) + ' h.',
        ['Wie viele Durchgänge brauchst du? Die letzte Spule bekommt einen eigenen.', 'Runde die Durchgänge auf und multipliziere mit der Dauer.'],
        ['Teile die Zahl der Spulen durch die Plätze im Trockner und runde auf.', 'Multipliziere die Durchgänge mit der Dauer eines Durchgangs.']);
    },
    spule: R => {
      const c = C(), leer = c.pick(R, [180, 220, 250]), rest = c.ri(R, 8, 90) * 10, total = leer + rest;
      return numQ('Eine Spule wiegt mit Filament ' + f(total, 0) + ' g. Die leere Spule wiegt ' + f(leer, 0) + ' g. Wie viel Filament ist noch auf der Spule?', rest, 'g', 'Restmenge', 0.01,
        f(total, 0) + ' g − ' + f(leer, 0) + ' g = ' + f(rest, 0) + ' g Filament.', ['Die Waage zeigt Spule und Filament zusammen.', 'Ziehe das Gewicht der leeren Spule ab.'],
        ['Notiere das Gesamtgewicht und das Leergewicht.', 'Ziehe das Leergewicht vom Gesamtgewicht ab.']);
    },
    /* Slicer-Einstellungen */
    hmax: R => {
      const c = C(), d = c.pick(R, [0.2, 0.4, 0.6, 0.8]), v = c.rd(c.maxLayer(d, 75), 3);
      return numQ('Faustregel: Die Schichthöhe sollte höchstens 75 % des Düsendurchmessers betragen. Du druckst mit einer Düse von ' + f(d, 1) + ' mm. Wie groß darf die Schichthöhe höchstens sein?', v, 'mm', 'Schichthöhe', 0.005,
        '75 % entsprechen dem Faktor 0,75. ' + f(d, 1) + ' mm · 0,75 = ' + f(v, 3) + ' mm. Die Faustregel ist ein Richtwert, der Slicer lässt oft mehr zu.',
        ['Rechne 75 % in einen Faktor um.', 'Multipliziere den Düsendurchmesser mit 0,75.'],
        ['Wandle 75 % in einen Faktor um: 75 / 100 = 0,75.', 'Multipliziere den Düsendurchmesser mit dem Faktor.']);
    },
    wand: R => {
      const c = C(), lw = c.pick(R, [0.42, 0.45, 0.5, 0.6]), n = c.ri(R, 2, 5), v = c.rd(lw * n, 3);
      return numQ('Die Linienbreite beträgt ' + f(lw, 2) + ' mm. Du stellst ' + f(n, 0) + ' Wände ein. Wie dick ist die Außenhaut des Teils (alle Wände zusammen)?', v, 'mm', 'Wanddicke', 0.005,
        f(n, 0) + ' Wände · ' + f(lw, 2) + ' mm = ' + f(v, 3) + ' mm. Die Wände liegen nebeneinander, ihre Breiten addieren sich.', ['Wie viele Linien liegen nebeneinander?', 'Anzahl mal Linienbreite.'],
        ['Zähle die Wände.', 'Multipliziere die Zahl mit der Linienbreite.']);
    },
    /* Rechnen und Kosten */
    schichten: R => {
      const c = C(), h = c.pick(R, [0.08, 0.12, 0.16, 0.2, 0.28]), H = c.rd(c.ri(R, 6, 30) * 10 * h, 2), n = c.layersOf(H, h);
      return numQ('Ein Teil ist ' + f(H, 2) + ' mm hoch. Du druckst mit einer Schichthöhe von ' + f(h, 2) + ' mm. Wie viele Schichten hat das Teil? (Die erste Schicht wird nicht anders gerechnet.)', n, 'Schichten', 'Schichten', 0.01,
        f(H, 2) + ' mm / ' + f(h, 2) + ' mm = ' + f(n, 0) + ' Schichten.', ['Wie oft passt eine Schicht in die Höhe?', 'Höhe geteilt durch Schichthöhe.'],
        ['Notiere die Höhe des Teils und die Schichthöhe in Millimetern.', 'Teile die Höhe durch die Schichthöhe.']);
    },
    masse: R => {
      const c = C(), m = c.filOf(c.pick(R, ['pla', 'petg', 'abs'])), a = c.pick(R, [20, 30, 40, 50]), b = c.pick(R, [20, 30, 40]), h = c.pick(R, [10, 15, 20, 25]), V = a * b * h / 1000, g = c.rd(c.massG(V, m.rho), 2);
      return numQ('Ein massiver Quader aus ' + m.n + ' misst ' + f(a, 0) + ' × ' + f(b, 0) + ' × ' + f(h, 0) + ' mm. Die Dichte von ' + m.n + ' beträgt ' + f(m.rho, 2) + ' g/cm³. Wie schwer ist der Quader, wenn er vollständig gefüllt ist?', g, 'g', 'Masse', 0.05,
        'Volumen: ' + f(a, 0) + ' · ' + f(b, 0) + ' · ' + f(h, 0) + ' mm³ = ' + f(a * b * h, 0) + ' mm³ = ' + f(V, 2) + ' cm³ (durch 1.000). Masse: ' + f(V, 2) + ' cm³ · ' + f(m.rho, 2) + ' g/cm³ = ' + f(g, 2) + ' g.',
        ['1 cm³ sind 1.000 mm³.', 'Masse gleich Volumen mal Dichte.'],
        ['Rechne das Volumen in mm³ aus: Länge mal Breite mal Höhe.', 'Teile durch 1.000, um cm³ zu erhalten.', 'Multipliziere mit der Dichte.']);
    },
    fuell: R => {
      const c = C(), m = c.filOf(c.pick(R, ['pla', 'petg'])), S = c.pick(R, [4, 5, 6, 8]), I = c.pick(R, [10, 12, 14, 20]), F = c.pick(R, [10, 15, 20, 25, 30]), V = S + I * F / 100, g = c.rd(V * m.rho, 2);
      return numQ('Ein Teil aus ' + m.n + ' (Dichte ' + f(m.rho, 2) + ' g/cm³) hat eine Schale aus Wänden und Deckschichten mit ' + f(S, 0) + ' cm³ Volumen. Der Innenraum misst ' + f(I, 0) + ' cm³ und wird mit ' + f(F, 0) + ' % Füllung gedruckt. Wie viel Filament in Gramm braucht das Teil?', g, 'g', 'Masse', 0.05,
        'Füllung: ' + f(I, 0) + ' cm³ · ' + f(F, 0) + ' % = ' + f(I * F / 100, 2) + ' cm³. Gesamtvolumen: ' + f(S, 0) + ' + ' + f(I * F / 100, 2) + ' = ' + f(V, 2) + ' cm³. Masse: ' + f(V, 2) + ' cm³ · ' + f(m.rho, 2) + ' g/cm³ = ' + f(g, 2) + ' g.',
        ['Die Füllung gilt nur für den Innenraum, nicht für die Schale.', 'Schale plus gefüllter Anteil, dann mal Dichte.'],
        ['Rechne den gefüllten Anteil des Innenraums aus: Innenraum mal Prozent.', 'Addiere die Schale.', 'Multipliziere das Volumen mit der Dichte.']);
    },
    laenge: R => {
      const c = C(), m = c.filOf(c.pick(R, ['pla', 'petg', 'abs'])), g = c.pick(R, [8, 12, 25, 35, 50, 80, 120]), L = c.rd(c.lenM(g, m.rho, 1.75), 2), tol = Math.max(0.02, c.rd(L * 0.01, 2));
      return numQ('Ein Druck braucht ' + f(g, 0) + ' g ' + m.n + ' (Dichte ' + f(m.rho, 2) + ' g/cm³). Das Filament hat 1,75 mm Durchmesser. Wie lang ist der Filamentfaden in Metern? (Ein Fehler von etwa 1 % wegen Rundung ist erlaubt.)', L, 'm', 'Länge', tol,
        'Volumen: ' + f(g, 0) + ' g / ' + f(m.rho, 2) + ' g/cm³ = ' + f(g / m.rho, 2) + ' cm³ = ' + f(g / m.rho * 1000, 0) + ' mm³. Querschnitt: π · 1,75² / 4 = ' + f(Math.PI * 1.75 * 1.75 / 4, 3) + ' mm². Länge: ' + f(g / m.rho * 1000, 0) + ' / ' + f(Math.PI * 1.75 * 1.75 / 4, 3) + ' = ' + f(g / m.rho * 1000 / (Math.PI * 1.75 * 1.75 / 4), 0) + ' mm = ' + f(L, 2) + ' m.',
        ['Aus der Masse wird das Volumen, aus dem Volumen die Länge.', 'Länge gleich Volumen durch Querschnitt, Querschnitt gleich π mal d² durch 4.'],
        ['Rechne die Masse in das Volumen um: Masse durch Dichte (ergibt cm³), mal 1.000 für mm³.', 'Rechne den Querschnitt des Filaments aus: π mal d² durch 4.', 'Teile das Volumen durch den Querschnitt und rechne von mm in m um.']);
    },
    matkosten: R => {
      const c = C(), g = c.pick(R, [18, 26, 35, 48, 65, 90, 140]), p = c.pick(R, [18, 20, 22, 25, 28, 32]), v = c.rd(c.costMat(g, p), 2);
      return numQ('Ein Teil braucht ' + f(g, 0) + ' g Filament. Die Spule mit 1 kg kostet ' + f(p, 2) + ' €. Wie hoch sind die Materialkosten des Teils?', v, '€', 'Materialkosten', 0.01,
        f(g, 0) + ' g sind ' + f(g / 1000, 3) + ' kg. ' + f(g / 1000, 3) + ' kg · ' + f(p, 2) + ' €/kg = ' + f(v, 2) + ' €.', ['Rechne Gramm in Kilogramm um.', 'Kilogramm mal Preis je Kilogramm.'],
        ['Rechne die Masse in kg um: Gramm durch 1.000.', 'Multipliziere mit dem Preis je kg.']);
    },
    zeit: R => {
      const c = C(); let n, s;
      for (let i = 0; i < 100; i++) { n = c.pick(R, [120, 150, 180, 240, 300]); s = c.pick(R, [30, 45, 60, 90]); if ((n * s) % 60 === 0) break; }
      return numQ('Ein Teil hat ' + f(n, 0) + ' Schichten. Jede Schicht dauert im Mittel ' + f(s, 0) + ' Sekunden (Übungswert). Wie lange dauert der Druck ungefähr, in Minuten?', n * s / 60, 'min', 'Druckzeit', 0.5,
        f(n, 0) + ' · ' + f(s, 0) + ' s = ' + f(n * s, 0) + ' s. ' + f(n * s, 0) + ' s / 60 = ' + f(n * s / 60, 0) + ' min.', ['Zuerst alle Schichten in Sekunden zusammenzählen.', 'Sekunden durch 60 ergibt Minuten.'],
        ['Multipliziere die Zahl der Schichten mit der Zeit je Schicht.', 'Teile das Ergebnis durch 60 für Minuten.']);
    },
    teilkosten: R => {
      const c = C(), g = c.pick(R, [20, 32, 45, 60, 80]), p = c.pick(R, [20, 22, 25, 28]), t = c.pick(R, [1.5, 2, 2.5, 3, 4]), kw = c.pick(R, [0.1, 0.12, 0.15]), e = c.pick(R, [0.28, 0.3, 0.32, 0.35]), z = c.pick(R, [5, 10]);
      const mat = c.costMat(g, p), st = c.costPower(t, kw, e), v = c.rd((mat + st) * (1 + z / 100), 2);
      return numQ('Ein Teil wiegt ' + f(g, 0) + ' g. Die Spule kostet ' + f(p, 2) + ' € je kg. Der Druck dauert ' + f(t, 1) + ' h, der Drucker nimmt im Mittel ' + f(kw * 1000, 0) + ' W auf, eine kWh kostet ' + f(e, 2) + ' €. Auf die Summe kommen ' + f(z, 0) + ' % Zuschlag für Ausschuss. Wie viel kostet ein Teil?', v, '€', 'Kosten je Teil', 0.01,
        'Material: ' + f(g, 0) + ' g / 1.000 · ' + f(p, 2) + ' = ' + f(mat, 3) + ' €. Strom: ' + f(t, 1) + ' h · ' + f(kw, 2) + ' kW · ' + f(e, 2) + ' €/kWh = ' + f(st, 3) + ' €. Summe: ' + f(mat + st, 3) + ' €. Mit ' + f(z, 0) + ' % Zuschlag: ' + f(mat + st, 3) + ' · ' + f(1 + z / 100, 2) + ' = ' + f(v, 2) + ' €.',
        ['Drei Posten: Material, Strom, Zuschlag auf die Summe.', 'Watt in Kilowatt umrechnen, Zuschlag als Faktor 1,05 bzw. 1,10.'],
        ['Rechne die Materialkosten aus: Masse in kg mal Preis je kg.', 'Rechne die Stromkosten: Stunden mal Leistung in kW mal Preis je kWh.', 'Addiere beide Posten.', 'Multipliziere die Summe mit dem Zuschlagsfaktor.']);
    },
    auftrag: R => {
      const c = C(); let N, k, t;
      for (let i = 0; i < 100; i++) { N = c.pick(R, [24, 30, 40, 50, 60]); k = c.pick(R, [4, 6, 8, 9, 12]); t = c.pick(R, [1.5, 2, 2.5, 3]); if (N % k) break; }
      const pl = Math.ceil(N / k), v = c.rd(pl * t, 2);
      return numQ('Ein Auftrag verlangt ' + f(N, 0) + ' gleiche Teile. Auf eine Platte passen ' + f(k, 0) + ' Teile, ein Plattendurchlauf dauert ' + f(t, 1) + ' Stunden. Wie viele Stunden braucht der Drucker für den ganzen Auftrag?', v, 'h', 'Dauer', 0.01,
        'Platten: ' + f(N, 0) + ' / ' + f(k, 0) + ' = ' + f(N / k, 2) + ', aufgerundet ' + f(pl, 0) + '. Dauer: ' + f(pl, 0) + ' · ' + f(t, 1) + ' h = ' + f(v, 2) + ' h.', ['Eine angefangene Platte muss auch gedruckt werden.', 'Plattenzahl mal Zeit je Platte.'],
        ['Teile die Teilezahl durch die Teile je Platte und runde auf.', 'Multipliziere die Plattenzahl mit der Zeit je Platte.']);
    },
    abfall: R => {
      const c = C(), s = c.pick(R, [10, 12, 15, 20, 25]), w = c.pick(R, [1.5, 2, 2.5, 3, 4]), p = c.pick(R, [20, 24, 28]), g = s * 2 * w, v = c.rd(g / 1000 * p, 2);
      return numQ('Ein Teil wird zweifarbig gedruckt. In ' + f(s, 0) + ' Schichten wechselt die Farbe je zweimal. Jeder Farbwechsel erzeugt ' + f(w, 1) + ' g Spülabfall am Spülturm. Das Filament kostet ' + f(p, 2) + ' € je kg. Wie viel kostet der Abfall für dieses Teil?', v, '€', 'Abfallkosten', 0.01,
        'Wechsel: ' + f(s, 0) + ' · 2 = ' + f(s * 2, 0) + '. Abfall: ' + f(s * 2, 0) + ' · ' + f(w, 1) + ' g = ' + f(g, 1) + ' g = ' + f(g / 1000, 3) + ' kg. Kosten: ' + f(g / 1000, 3) + ' kg · ' + f(p, 2) + ' €/kg = ' + f(v, 2) + ' €.',
        ['Zähle zuerst alle Farbwechsel.', 'Abfall in Gramm, dann in kg, dann mal Preis.'],
        ['Rechne alle Farbwechsel aus: Schichten mal Wechsel je Schicht.', 'Rechne den Abfall in g: Wechsel mal Gramm je Wechsel.', 'Rechne in Euro: Gramm durch 1.000 mal Preis je kg.']);
    },
    reicht: R => {
      const c = C(); let rest, g;
      for (let i = 0; i < 100; i++) { rest = c.ri(R, 5, 18) * 50; g = c.pick(R, [18, 24, 32, 45, 60, 75]); if (rest % g) break; }
      const n = Math.floor(rest / g);
      return numQ('Auf einer Spule liegen noch ' + f(rest, 0) + ' g Filament. Ein Teil braucht ' + f(g, 0) + ' g. Wie viele Teile kannst du mit der Spule noch vollständig drucken?', n, 'Teile', 'Teile', 0.01,
        f(rest, 0) + ' g / ' + f(g, 0) + ' g = ' + f(rest / g, 2) + '. Ein angefangenes Teil zählt nicht, also abgerundet ' + f(n, 0) + ' Teile.', ['Nur ganze Teile zählen.', 'Teile den Rest durch den Bedarf und runde ab.'],
        ['Teile die Restmenge durch den Bedarf je Teil.', 'Runde ab, weil nur vollständige Teile zählen.']);
    },
    /* Fehlerbilder */
    fehlerbild: R => {
      const c = C(), F = c.FEHLER, right = c.pick(R, F), wrong = c.shuffle(R, F.filter(x => x.k !== right.k)).slice(0, 3);
      return choiceQ(R, 'Du siehst am fertigen Teil: ' + right.sym + ' Welches Fehlerbild ist das?', right.n, wrong.map(x => x.n),
        right.n + ': ' + right.ursache + ' Abhilfe: ' + right.abhilfe, ['Lies, was am Teil zu sehen ist.', 'Vergleiche mit den Fehlerbildern im Reiter Fehlerbilder.'],
        ['Lies, was am Teil zu sehen ist.', 'Vergleiche mit den Fehlerbildern im Reiter Fehlerbilder.', 'Wähle den Namen, der genau diese Erscheinung beschreibt.']);
    },
    diagnose: R => {
      const c = C(), kind = c.pick(R, ['warp', 'string', 'string2', 'under', 'foot']);
      const mk = k => { const m = c.filOf(k); return { m, s: Object.assign({ mat: k }, c.FSTART[k]) }; };
      let o, key;
      if (kind === 'warp') { o = mk('abs'); o.s.bed = o.m.bl - c.ri(R, 6, 10); o.s.fan = c.ri(R, 6, 9) * 10; key = 'warp'; }
      else if (kind === 'string') { o = mk(c.pick(R, ['pla', 'petg', 'abs'])); o.s.noz = o.m.nh + c.ri(R, 8, 18); key = 'string'; }
      else if (kind === 'string2') { o = mk(c.pick(R, ['pla', 'petg', 'abs'])); o.s.ret = c.pick(R, [0, 0.1, 0.2]); key = 'string'; }
      else if (kind === 'under') { o = mk(c.pick(R, ['pla', 'petg', 'abs'])); o.s.noz = o.m.nl - c.ri(R, 12, 30); key = 'under'; }
      else { o = mk(c.pick(R, ['pla', 'petg'])); o.s.bed = o.m.bh + c.ri(R, 12, 25); key = 'foot'; }
      const s = o.s, m = o.m, fe = c.fehlOf(key), names = ['warp', 'string', 'under', 'foot'].map(k => c.fehlOf(k));
      return choiceQ(R, 'Material ' + m.n + '. Die Werte laut Tabelle: Düse ' + f(m.nl, 0) + ' bis ' + f(m.nh, 0) + ' °C, Bett ' + f(m.bl, 0) + ' bis ' + f(m.bh, 0) + ' °C, Lüfter ' + f(m.fan[0], 0) + ' bis ' + f(m.fan[1], 0) + ' %, Rückzug etwa 0,5 mm oder mehr. Eingestellt sind: Düse ' + f(s.noz, 0) + ' °C, Bett ' + f(s.bed, 0) + ' °C, Lüfter ' + f(s.fan, 0) + ' %, Rückzug ' + f(s.ret, 1) + ' mm. Welcher Fehler ist zu erwarten?', fe.n, names.filter(x => x.k !== key).map(x => x.n),
        'Nur ein Wert liegt außerhalb. ' + fe.n + ': ' + fe.ursache + ' Abhilfe: ' + fe.abhilfe,
        ['Vergleiche jeden eingestellten Wert mit seinem Bereich.', 'Nur ein Wert weicht ab. Welcher Fehler gehört dazu?'],
        ['Vergleiche jeden eingestellten Wert mit dem Bereich in der Aufgabe.', 'Finde den einen Wert, der abweicht: Düse zu kalt oder zu heiß, Bett zu kalt oder zu heiß, Lüfter zu stark, Rückzug zu klein.', 'Ordne die Abweichung dem Fehlerbild zu.']);
    },
    /* Konstruieren */
    ueber45: R => {
      const c = C(), right = c.pick(R, [55, 60, 65, 70, 75, 80]), wrong = c.shuffle(R, [10, 15, 20, 25, 30, 35, 40, 45]).filter(v => !c.needsSupport(v)).slice(0, 3);
      return choiceQ(R, 'Vier schräge Flächen eines Teils hängen nach unten über. Die Neigung wird gegen die Senkrechte gemessen (0 Grad ist eine senkrechte Wand, 90 Grad eine waagerechte Unterseite). Welche Fläche braucht Stützen?', f(right, 0) + ' Grad', wrong.map(v => f(v, 0) + ' Grad'),
        'Die Faustregel: Bis 45 Grad gegen die Senkrechte trägt die Schicht darunter genug, darüber braucht die Fläche Stützen. ' + f(right, 0) + ' Grad liegt darüber, die anderen liegen darunter.',
        ['Vergleiche jeden Winkel mit 45 Grad.', 'Nur der größere Winkel überhängt zu stark.'],
        ['Erinnere dich an die Faustregel: 45 Grad gegen die Senkrechte.', 'Prüfe jede Antwort: Ist der Winkel größer als 45 Grad?', 'Wähle die Fläche, die darüber liegt.']);
    },
    passung: R => {
      const c = C(), d = c.pick(R, [6, 8, 10, 12]), s = c.pick(R, [0.2, 0.3, 0.4]), v = c.rd(c.holeDia(d, s, 0), 2);
      return numQ('Eine Welle mit ' + f(d, 0) + ' mm Durchmesser soll sich in einer gedruckten Bohrung drehen. Du planst ' + f(s, 1) + ' mm Spiel am Durchmesser (Bohrung minus Welle). Welchen Durchmesser zeichnest du für die Bohrung?', v, 'mm', 'Bohrungsdurchmesser', 0.005,
        'Bohrung = Welle + Spiel = ' + f(d, 0) + ' + ' + f(s, 1) + ' = ' + f(v, 2) + ' mm. Ohne Spiel würde die Welle klemmen, weil gedruckte Maße nie ganz genau sind.', ['Das Spiel kommt zum Wellendurchmesser dazu.', 'Welle plus Spiel.'],
        ['Notiere den Wellendurchmesser und das Spiel.', 'Addiere beide, denn die Bohrung muss größer sein.']);
    },
    passung2: R => {
      const c = C(), d = c.pick(R, [5, 6, 8, 10]), s = c.pick(R, [0.2, 0.3]), k = c.pick(R, [0.1, 0.15, 0.2]), v = c.rd(c.holeDia(d, s, k), 2);
      return numQ('Ein Stift mit ' + f(d, 0) + ' mm Durchmesser soll in einem gedruckten Loch gleiten, mit ' + f(s, 1) + ' mm Spiel am Durchmesser. Aus Erfahrung wird das Loch um ' + f(k, 2) + ' mm zu klein gedruckt. Welchen Durchmesser zeichnest du für das Loch?', v, 'mm', 'Lochdurchmesser', 0.005,
        'Wunschmaß nach dem Druck: ' + f(d, 0) + ' + ' + f(s, 1) + ' = ' + f(d + s, 2) + ' mm. Weil das Loch ' + f(k, 2) + ' mm zu klein wird, zeichnest du es um ' + f(k, 2) + ' mm größer: ' + f(v, 2) + ' mm.', ['Zwei Zuschläge: Spiel und Ausgleich der Abweichung.', 'Alles zum Stiftdurchmesser addieren.'],
        ['Rechne zuerst das Wunschmaß nach dem Druck: Stift plus Spiel.', 'Addiere die Abweichung, die das Loch zu klein wird.']);
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator */
  const defs = [
    [0, 1, 'Teile am Drucker', 'teilq'], [0, 1, 'Verfahren erkennen', 'verf'], [0, 1, 'Aufbau und Antrieb', 'aufb'], [0, 2, 'Teile auf der Platte', 'platte'], [0, 1, 'Düse und Linie', 'duesefrage'],
    [1, 1, 'Material zuordnen', 'zuord'], [1, 1, 'Düsentemperatur', 'duese'], [1, 1, 'Betttemperatur', 'bett'], [1, 2, 'Feuchtes Filament', 'feucht'], [1, 2, 'Trockner füllen', 'trockner'], [1, 2, 'Material für die Anwendung', 'anw'], [1, 1, 'Rest auf der Spule', 'spule'],
    [2, 1, 'Begriffe im Slicer', 'begr'], [2, 2, 'Größte Schichthöhe', 'hmax'], [2, 2, 'Füllmuster und Wände', 'must'], [2, 2, 'Dicke der Außenhaut', 'wand'], [2, 2, 'Stützen', 'stuetz'], [2, 2, 'Brim und Platte', 'brim'], [2, 3, 'Mehrfarbdruck', 'mehr'], [2, 2, 'Ablauf im Slicer', 'abl'],
    [3, 1, 'Schichten zählen', 'schichten'], [3, 2, 'Masse eines Quaders', 'masse'], [3, 3, 'Masse mit Füllung', 'fuell'], [3, 2, 'Länge des Filaments', 'laenge'], [3, 2, 'Materialkosten', 'matkosten'], [3, 2, 'Druckzeit überschlagen', 'zeit'], [3, 3, 'Kosten je Teil', 'teilkosten'], [3, 2, 'Platten und Auftrag', 'auftrag'], [3, 3, 'Abfall beim Farbwechsel', 'abfall'], [3, 2, 'Reicht die Spule', 'reicht'],
    [4, 2, 'Fehlerbild erkennen', 'fehlerbild'], [4, 2, 'Ecken heben sich ab', 'warp'], [4, 2, 'Fäden zwischen Teilen', 'string'], [4, 2, 'Wulst und Lücken', 'fuss'], [4, 3, 'Erste Schicht und Kalibrierung', 'kal'], [4, 3, 'Fehler aus den Einstellungen', 'diagnose'],
    [5, 1, 'Überhang prüfen', 'ueber45'], [5, 2, 'Ausrichtung auf der Platte', 'aus'], [5, 2, 'Bohrung für eine Welle', 'passung'], [5, 3, 'Loch mit Druckabweichung', 'passung2'], [5, 1, 'Arbeitssicherheit', 'sich'], [5, 2, 'Nach dem Druck', 'nach']
  ];
  const tasks = defs.map((d, i) => ({ id: 'drk' + (i + 1), cat: CATS[d[0]], level: d[1], title: d[2], gen: d[3] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  const makeTask = t => make(t, C().rng('drk-' + t.id));
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.DRK_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, pools: { TEILQ, VERFQ, AUFBQ, DUESEQ, ZUORDQ, FEUCHTQ, ANWQ, BEGRQ, MUSTQ, STUETZQ, BRIMQ, MEHRQ, ABLQ, WARPQ, STRINGQ, FUSSQ, KALQ, AUSQ, SICHQ, NACHQ } };
  root.DRK_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.DRK_DATA, TASKS: root.DRK_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
