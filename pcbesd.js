'use strict';
/* Leiterplatten-Lab: Reiter "ESD" (View-Id 'esd'), Schutz vor elektrostatischer Entladung in der Elektronikfertigung.
   Teil A (Daten und Logik, ohne DOM, auch mit Node ladbar): window.PCB_ESD / module.exports
     PCB_ESD.spannungMensch(rf)               Übungskurve: Spannung am Menschen in V aus der relativen Luftfeuchte
     PCB_ESD.AUFLADUNG, SCHAEDEN, MODELLE     Grundlagen (Texte)
     PCB_ESD.ELEMENTE, ERDUNG                 Aufbau einer EPA, Hinweise zur Erdung
     PCB_ESD.systemWiderstand(liste), systemAmpel(r), bodenKlasse(r), erdungAusfall(form, pos, n)
     PCB_ESD.VERPACKUNG, verpackungKlasse(p), verpackungEignung(p, ort)
     PCB_ESD.offsetAmpel(u), MESSREGELN
     PCB_ESD.FEHLER                           5 Fehlerbilder rund um den ESD-Schutz
     PCB_ESD.QUIZ                             12 Aufgaben (Zuordnung, Mehrfachwahl, Rechnung) mit je 3 Tipps und Lösungsweg
     PCB_ESD.pruefeQuiz(task, antwort)        -> { pct, ok, zeilen }
   Teil B (Oberfläche) registriert PCB_VIEWS 'esd' mit den Reitern Grundlagen, EPA und Erdung, Verpacken und Messen, Quiz.
   WICHTIG zum Datenschutz: Alles hier ist allgemein gehalten und in eigenen Worten formuliert. Es kommen keine Namen von Firmen,
   Personen, Produkten oder internen Dokumenten vor. Alle Zahlen sind Übungswerte oder typische Zielwerte der Norm; im Betrieb gilt
   immer die eigene Prüfanweisung. Normen werden nur mit ihrer Nummer genannt. Die Texte dieses Reiters stehen bewusst nicht in
   aufgaben.js und gehen nicht in die Sprach-Exporte ein. */
(function (root) {
  /* ====================================================================================
     TEIL A: DATEN UND LOGIK (ohne DOM)
     ==================================================================================== */
  const ZIEL = 'Typische Zielwerte der Norm. Im Betrieb gilt die eigene Prüfanweisung.';
  const SICHER = 'Arbeiten an Erdungsanschlüssen und elektrischen Anlagen macht nur eine Elektrofachkraft. ESD-Schuhe, Handgelenkband und Boden schützen nicht vor einem elektrischen Schlag.';

  /* ---------- Hilfsfunktionen ---------- */
  const round = (v, d) => { const p = Math.pow(10, d == null ? 0 : d); return Math.round(v * p) / p; };
  function zahl(v, d) { /* deutsche Schreibweise, höchstens d Nachkommastellen, ohne überflüssige Nullen */
    const s = round(v, d == null ? 2 : d).toFixed(d == null ? 2 : d);
    return (s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s).replace('.', ',');
  }
  function ohmText(r) {
    if (!(r >= 0)) return '–';
    if (r >= 1e9) return zahl(r / 1e9, 2) + ' GΩ';
    if (r >= 1e6) return zahl(r / 1e6, 2) + ' MΩ';
    if (r >= 1e3) return zahl(r / 1e3, 2) + ' kΩ';
    return zahl(r, 1) + ' Ω';
  }
  function parseZahl(s) {
    if (typeof s === 'number') return isFinite(s) ? s : NaN;
    if (typeof s !== 'string') return NaN;
    const t = s.replace(/\s/g, '').replace(',', '.');
    return /^[-+]?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }

  /* ---------- 1. Grundlagen ---------- */
  const AUFLADUNG = [
    { id: 'reibung', titel: 'Reibung und Trennen', text: 'Zwei Stoffe berühren sich und werden wieder getrennt: beim Gehen, beim Abziehen einer Folie, beim Rutschen eines Bauteils in einer Kunststoffschale. Dabei wechseln Elektronen von der einen Oberfläche zur anderen. Ein Körper ist danach positiv, der andere negativ geladen. Auf Isolatoren bleibt die Ladung lange sitzen, weil sie nicht abfließen kann. Fachlich heißt das der triboelektrische Effekt.' },
    { id: 'influenz', titel: 'Influenz', text: 'Ein geladener Gegenstand verschiebt in seiner Nähe die Ladungen in einem anderen Körper, ohne ihn zu berühren. Wird dieser Körper dabei kurz berührt oder geerdet und dann weggenommen, bleibt eine Ladung zurück. So kann sich auch ein Bauteil auf einer isolierenden Unterlage aufladen, nur weil ein geladener Gegenstand in der Nähe ist.' }
  ];
  /* Eckpunkte der Übung: trocken (unter 20 % r. F.) bis etwa 35.000 V, feucht (über 65 % r. F.) unter 1.500 V. Spürbar ab etwa 2.000 V. */
  const FEUCHTE = { trockenRf: 20, trockenU: 35000, feuchtRf: 65, feuchtU: 1500, spuerbarU: 2000, zielU: 100 };
  function spannungMensch(rf) {
    const r = +rf; if (!isFinite(r)) return NaN;
    if (r <= FEUCHTE.trockenRf) return FEUCHTE.trockenU;
    if (r >= FEUCHTE.feuchtRf) return FEUCHTE.feuchtU;
    const t = (r - FEUCHTE.trockenRf) / (FEUCHTE.feuchtRf - FEUCHTE.trockenRf);
    return FEUCHTE.trockenU * Math.pow(FEUCHTE.feuchtU / FEUCHTE.trockenU, t);
  }
  const spuerbar = u => u >= FEUCHTE.spuerbarU;
  const SCHAEDEN = [
    { id: 'sofort', titel: 'Sofortausfall', text: 'Das Bauteil arbeitet nach der Entladung nicht mehr. Typische Ursachen: Leiterbahnen im Chip schmelzen, es entstehen Kontaktbrücken, oder die hauchdünne Isolierschicht am Gate eines Feldeffekttransistors schlägt durch.' },
    { id: 'schleichend', titel: 'Schleichender Schaden', text: 'Das Bauteil ist vorgeschädigt, funktioniert aber zunächst noch und besteht die Prüfung. Später fällt es früher aus als erwartet, vielleicht erst beim Anwender. Solche Fehler sind besonders teuer, weil sie so spät auffallen.' },
    { id: 'klein', titel: 'Je kleiner, desto empfindlicher', text: 'Mit immer feineren Strukturen im Bauteil reicht immer weniger Energie für einen Schaden. Besonders empfindlich sind Feldeffekttransistoren und integrierte Schaltungen.' },
    { id: 'spuerbar', titel: 'Du spürst es meist nicht', text: 'Eine Entladung spürst du erst ab etwa 2.000 bis 3.000 Volt. Bauteile können schon durch einen kleinen Bruchteil davon Schaden nehmen. Dass du nichts spürst, ist also keine Entwarnung.' }
  ];
  const MODELLE = [
    { id: 'hbm', kurz: 'HBM', name: 'Körpermodell (Human Body Model)', text: 'Ein aufgeladener Mensch berührt ein Bauteil oder eine Baugruppe. Die Ladung des Körpers fließt über das Bauteil ab.', ziel: 'Personen am Arbeitsplatz sollen unter ±100 V bleiben.' },
    { id: 'cdm', kurz: 'CDM', name: 'Modell des geladenen Bauteils (Charged Device Model)', text: 'Das Bauteil selbst ist aufgeladen, zum Beispiel durch das Rutschen in einer Schiene oder Schale. Sobald ein Anschluss ein leitendes Teil berührt, entlädt es sich schlagartig, sehr schnell und sehr kurz.', ziel: 'Bauteile sollen unter ±200 V bleiben.' },
    { id: 'mm', kurz: 'MM', name: 'Maschinenmodell (Machine Model)', text: 'Ein aufgeladener, isolierter Leiter, zum Beispiel ein Werkzeug oder ein Maschinenteil, berührt einen Anschluss. Weil Metall wenig Widerstand hat, fließt die Ladung sehr schnell ab. Als Prüfmodell für Bauteile ist das MM veraltet, der Fall „aufgeladener isolierter Leiter“ bleibt aber real.', ziel: 'Isolierte Leiter sollen unter ±35 V bleiben.' }
  ];

  /* ---------- 2. EPA und Erdung ---------- */
  const EPA_TEXT = 'Die EPA ist der elektrostatisch geschützte Bereich: ein ausgewiesener Arbeitsbereich, in dem empfindliche Bauteile und Baugruppen ohne Schutzverpackung gehandhabt werden dürfen. Ein betriebliches Kontrollprogramm legt fest, wer wofür zuständig ist, wie geschult wird und wie die Einhaltung geprüft wird. Die Norm erlaubt, einzelne Elemente begründet wegzulassen (Anpassung an die eigenen Prozesse). Mindestens gehören dazu: abschirmende Verpackung für Lagerung und Transport sowie Personenerdung und ableitfähige Arbeitsfläche, sobald ausgepackt wird. Ein ESD-Boden ist dagegen optional.';
  const ELEMENTE = [
    { id: 'band', name: 'Handgelenkband mit Spiralkabel', text: 'Wer sitzend arbeitet, trägt das Band direkt auf der Haut und steckt es am gemeinsamen Erdungspunkt ein. So fließt die Körperladung dauernd ab. Im Kabel sitzt ein Widerstand: Er (typisch 1 MΩ) begrenzt den Strom über das Band, falls du versehentlich an eine Spannung gerätst. Eine Schutzmaßnahme gegen elektrischen Schlag ist das Band trotzdem nicht. Das Band wird vor Arbeitsbeginn getestet.' },
    { id: 'flaeche', name: 'Ableitfähige Arbeitsfläche', text: 'Die Fläche ist geerdet und leitet Ladung langsam und kontrolliert ab. Baugruppen und Bauteile liegen nur dort, nicht auf Papier, Kunststoffmappen oder Schaumstoff. Alles, was ein Isolator ist, gehört nicht auf den Platz.' },
    { id: 'schuh', name: 'ESD-Schuhe und ableitfähiger Boden', text: 'Wer steht oder geht, kann statt des Bandes das System aus Schuh und Boden nutzen. Entscheidend ist das ganze System, also Person, Schuh und Boden zusammen. Die Luftfeuchte beeinflusst es stark; deshalb wird es regelmäßig vor Ort geprüft. Die Schuhe schützen nicht vor elektrischem Schlag und sind nicht für Arbeiten unter Spannung gedacht.' },
    { id: 'verpackung', name: 'Verpackung und Behälter', text: 'Innerhalb der EPA reichen ableitfähige Behälter. Wer Baugruppen aus der EPA hinausbringt, braucht zusätzlich eine abschirmende Verpackung. Mehr dazu im Reiter „Verpacken und Messen“.' },
    { id: 'ionisator', name: 'Ionisator', text: 'Der Ionisator ist eine Ergänzung für Isolatoren, die sich weder erden noch vermeiden lassen. Er sorgt dafür, dass Ladungen auf Isolatoren durch Ionen aus der Luft neutralisiert werden. Mehr dazu im Reiter „Verpacken und Messen“.' }
  ];
  const SYSTEM = { gruenBis: 3.5e7, gelbBis: 1e9 };
  /* Regler der Übung: Zehnerpotenz des Widerstands (Übungswerte) */
  const SYSTEM_REGLER = [
    { id: 'person', name: 'Person (Körper und Haut)', min: 4, max: 7.5, start: 6 },
    { id: 'schuh', name: 'Schuh', min: 5, max: 10, start: 7 },
    { id: 'boden', name: 'Boden', min: 4, max: 10, start: 7 }
  ];
  function systemWiderstand(liste) { let s = 0; (liste || []).forEach(r => { const v = +r; if (isFinite(v) && v >= 0) s += v; }); return s; }
  /* gruen: unter 35 MΩ; gelb: 35 MΩ bis unter 1 GΩ (nur mit bestandenem Begehtest, Körperspannung unter 100 V); rot: darüber */
  function systemAmpel(r) { return r < SYSTEM.gruenBis ? 'gruen' : r < SYSTEM.gelbBis ? 'gelb' : 'rot'; }
  /* Fußbodenklassen nach Widerstandsbereich: leitend bis 10^6 Ω, ableitfähig darüber bis 10^9 Ω, darüber isolierend */
  const BODEN = [
    { id: 'leitend', name: 'leitend', bereich: 'bis 10⁶ Ω', text: 'Ladung fließt sehr schnell ab. Der Strom kann bei Fehlern größer sein, deshalb ist auch hier die Sicherheit zu beachten.' },
    { id: 'ableitfaehig', name: 'ableitfähig', bereich: 'über 10⁶ bis 10⁹ Ω', text: 'Ladung fließt kontrolliert ab. Das ist der übliche Bereich für ESD-Böden.' },
    { id: 'isolierend', name: 'zu hochohmig', bereich: 'über 10⁹ Ω', text: 'Zu hochohmig: Die Ladung fließt zu langsam ab. Als Boden in der EPA nicht geeignet. Ab etwa 10¹¹ Ω spricht man von wirklich isolierend.' }
  ];
  function bodenKlasse(r) { return r <= 1e6 ? 'leitend' : r <= 1e9 ? 'ableitfaehig' : 'isolierend'; }
  const ASTATISCH = 'Zusätzlich gibt es die Eigenschaft „astatisch“: Der Boden lädt Personen beim Gehen nur wenig auf (Grenze: Aufladbarkeit bis etwa 2 kV). Das ist eine andere Frage als der Widerstand.';
  const ERDUNG = {
    stern: 'Alle Erdungen laufen sternförmig zu einem gemeinsamen Erdungspunkt: Jedes Teil hat seine eigene Leitung. Fällt eine Leitung aus, bleiben die anderen geerdet. In einer Reihe (Girlande) von Platz zu Platz fällt dagegen alles hinter der Unterbrechung aus.',
    ziel: 'Betriebliche Zielwerte: Der Widerstand der Erdverbindung zum Erdungspunkt der Anlage (Referenzerde) liegt unter 2 Ω. Ein gut geerdetes Teil zeigt gegen die Referenzerde unter 50 mV Wechselspannung.',
    arten: 'Je nach Aufbau erfolgt die Erdung als Schutzerdung, Funktionserdung oder über den Potentialausgleich. Welche Variante gilt, legt der Betrieb fest.',
    hart: 'Hochleitfähige Metallteile wie Gestelle oder Metalltische werden direkt, also hart, ohne zusätzlichen Widerstand geerdet. Ein eingebauter Vorwiderstand wäre ein Sicherheitsrisiko, weil das Teil im Fehlerfall nicht mehr sicher auf Erdpotenzial liegt. Das gilt nur für Metallteile: Ableitfähige Matten und Arbeitsflächen werden bewusst über einen Widerstand (typisch 1 MΩ) angeschlossen.',
    person: 'Bei Personen ist es umgekehrt: Das Handgelenkband enthält absichtlich einen Widerstand, der den Strom durch den Körper begrenzt. Ein Band ohne Widerstand wäre unsicher.'
  };
  /* Ausfall der Erdung bei einer Unterbrechung: form 'stern' oder 'reihe', pos = Platz mit Unterbrechung (1..n) oder 0 (keine) -> Liste: true = geerdet */
  function erdungAusfall(form, pos, n) {
    const out = []; for (let i = 1; i <= n; i++) out.push(!(pos >= 1 && (form === 'reihe' ? i >= pos : i === pos))); return out;
  }

  /* ---------- 3. Verpacken und Messen ---------- */
  const VERPACKUNG = [
    { id: 'tuete', name: 'Gewöhnliche Kunststofftüte oder Schaumfolie', ableit: false, abschirm: false, nachweis: true, info: 'Isolator: Die Ladung bleibt sitzen und kann sich über das Bauteil entladen.' },
    { id: 'rosa', name: 'Rosa Folienbeutel ohne Kennzeichnung und ohne Nachweis', ableit: false, abschirm: false, nachweis: false, info: 'Die Farbe sagt nichts. Rosa Folie muss nicht ableitfähig sein; erst Kennzeichnung oder Prüfung belegt die Eigenschaft.' },
    { id: 'tray', name: 'Ableitfähiger Behälter oder Tray (gekennzeichnet)', ableit: true, abschirm: false, nachweis: true, info: 'Ableitfähig bei direktem Kontakt mit dem Bauteil. Gut für den Platz und den Transport innerhalb der EPA.' },
    { id: 'beutel', name: 'Abschirmbeutel mit ableitfähiger Innenseite (gekennzeichnet)', ableit: true, abschirm: true, nachweis: true, info: 'Die Innenseite leitet Ladung ab, die Abschirmung hält Entladungen von außen vom Inhalt fern. Geeignet für den Weg aus der EPA hinaus.' }
  ];
  /* Einordnung: 'innen' nur innerhalb der EPA, 'aussen' auch außerhalb, 'ungeeignet', 'nachweis' (Eignung nicht belegt) */
  function verpackungKlasse(p) {
    if (!p.nachweis) return 'nachweis';
    if (p.ableit && p.abschirm) return 'aussen';
    if (p.ableit) return 'innen';
    return 'ungeeignet';
  }
  /* ort: 'innen' (innerhalb der EPA) oder 'aussen' (außerhalb) -> 'ok', 'nein', 'nachweis' */
  function verpackungEignung(p, ort) {
    const k = verpackungKlasse(p);
    if (k === 'nachweis') return 'nachweis';
    if (ort === 'innen') return k === 'innen' || k === 'aussen' ? 'ok' : 'nein';
    return k === 'aussen' ? 'ok' : 'nein';
  }
  const IONISATOR = {
    idee: 'Ein Ionisator erzeugt positive und negative Ionen in der Luft. Eine geladene Isolatoroberfläche zieht die entgegengesetzten Ionen an und wird dadurch neutral. Er ist eine Ergänzung dort, wo Erdung oder Befeuchtung nicht möglich sind, etwa bei Kunststoffteilen. Isolatoren, die sich vermeiden lassen, werden zuerst entfernt.',
    offset: 'Ein Ionisator ist nur dann gut, wenn er beide Ionenarten im Gleichgewicht liefert. Die Abweichung heißt Offset-Spannung. Man misst sie mit einem Prüfgerät, und sie soll klein bleiben: Ziel ist ein Betrag unter 35 V, damit isolierte Leiter in der Nähe nicht gefährdet werden.',
    arten: [
      { id: 'korona', name: 'Ionisator mit Hochspannung (Koronaentladung)', text: 'Spitzen unter Hochspannung von einigen Kilovolt erzeugen die Ionen. Ein Lüfter bläst sie zur Arbeitsfläche. Die Spitzen verschmutzen und müssen gereinigt werden.' },
      { id: 'selbst', name: 'Selbstentladender (passiver) Ionisator', text: 'Er nutzt die Aufladung des Bauteils selbst und braucht keine Spannungsversorgung. Für hochpräzise Anwendungen ist er nicht geeignet.' },
      { id: 'roentgen', name: 'Ionisator mit weicher Röntgenstrahlung', text: 'Die Strahlung ionisiert die Luft direkt. Zusätzlich zu den betrieblichen Vorgaben gelten die gesetzlichen Vorgaben des Strahlenschutzes, zum Beispiel zu Abschirmung und Zulassung.' }
    ]
  };
  const OFFSET_ZIEL = 35;
  const offsetAmpel = u => Math.abs(+u) < OFFSET_ZIEL ? 'gruen' : 'rot';
  const MESSREGELN = [
    { id: 'elektrode', regel: 'Die in der Prüfanweisung genannte Elektrode verwenden.', warum: 'Form, Gewicht und Auflagefläche der Elektrode bestimmen das Ergebnis. Eine andere Elektrode liefert andere Werte.' },
    { id: 'untergrund', regel: 'Lose Proben auf isolierendem Untergrund messen.', warum: 'Ein leitender Untergrund würde parallel zum Messobjekt Strom führen und den Wert verfälschen.' },
    { id: 'frei', regel: 'Das Messobjekt spannungsfrei und entladen messen.', warum: 'Fremdspannung und Restladung verfälschen die Messung und können das Gerät beschädigen.' },
    { id: 'leitung', regel: 'Messleitungen kurz halten, bei hohen Widerständen abgeschirmt und gut isoliert.', warum: 'Lange oder schlecht isolierte Leitungen leiten selbst und nehmen Störungen auf.' },
    { id: 'ruhe', regel: 'Die Leitungen während der Messung nicht bewegen.', warum: 'Bewegte Leitungen laden sich auf und erzeugen Störspannungen im Messwert.' },
    { id: 'warten', regel: 'Die vorgegebene Wartezeit bis zum Ablesen einhalten.', warum: 'Bei hohen Widerständen stellt sich der Wert erst nach einigen Sekunden ein.' },
    { id: 'klima', regel: 'Luftfeuchte und Temperatur messen und im Protokoll festhalten.', warum: 'Der Widerstand vieler Werkstoffe hängt stark von der Luftfeuchte ab. Ohne diese Angabe ist ein Wert nicht vergleichbar.' }
  ];

  /* ---------- Fehlerbilder rund um den ESD-Schutz ---------- */
  const STELLEN = { person: 'Person', flaeche: 'Arbeitsfläche', boden: 'Boden und Schuhe', verpackung: 'Verpackung', ionisator: 'Ionisator' };
  const FEHLER = [
    { id: 'e01', stelle: 'person', titel: 'Handgelenkband nicht eingesteckt',
      symptom: 'Du arbeitest sitzend an Baugruppen und trägst das Handgelenkband. Das Spiralkabel liegt aber lose auf dem Tisch, der Stecker steckt nicht am Erdungspunkt. Du bist nicht geerdet und merkst nichts. Später fällt eine Baugru.pes ohne erkennbaren Grund aus.',
      ursache: ['Das Band wurde nach der Pause nicht wieder eingesteckt.', 'Vor Arbeitsbeginn gibt es keinen Test des Bandes.', 'Der Erdungspunkt am Platz ist locker oder verschmutzt.'],
      pruef: ['Sichtprüfung: Rastet der Stecker ein, sitzt das Band direkt auf der Haut?', 'Mit dem Bandprüfgerät Band und Kabel zusammen testen.', 'Im Zweifel die Körperspannung am Platz messen.'],
      gegen: ['Band vor jedem Arbeitsbeginn prüfen und erst dann Baugruppen anfassen.', 'Stecker einrasten lassen, Erdungspunkt sauber halten.', 'Einen festen Prüfablauf am Platz einführen, zum Beispiel eine Checkliste.'],
      merk: 'Erst einstecken, dann testen, dann arbeiten: Ein loses Band schützt nicht.' },
    { id: 'e02', stelle: 'person', titel: 'Ausgeleiertes Spiralkabel',
      symptom: 'Das Kabel des Bandes sieht außen heil aus, ist aber stark gedehnt und mehrfach geknickt. Der Stecker wackelt. Der Bandtest klappt nur manchmal, der Messwert springt, wenn du das Kabel bewegst.',
      ursache: ['Die Litze im Kabel ist innen durch ständigen Zug gebrochen.', 'Stecker oder Druckknopf sind oxidiert oder locker.', 'Das Kabel ist zu kurz und wird beim Arbeiten dauernd gespannt.'],
      pruef: ['Bandtest durchführen und dabei das Kabel bewegen: Springt der Wert, ist das Kabel defekt.', 'Stecker und Druckknopf ansehen: Verfärbung, Spiel, Risse?', 'Prüfen, ob das Kabel frei und ohne Zug zum Erdungspunkt läuft.'],
      gegen: ['Kabel tauschen statt reparieren.', 'Kabel ausreichend lang wählen und so führen, dass es nie unter Zug steht.', 'Verschleißteile nach dem Prüfplan regelmäßig erneuern.'],
      merk: 'Ein wackliges Kabel ist ein defektes Kabel: Wenn der Wert beim Bewegen springt, wird getauscht.' },
    { id: 'e03', stelle: 'verpackung', titel: 'Verpackung falsch gewählt',
      symptom: 'Eine bestückte Baugru.pes wird in einem rosa Folienbeutel ohne Kennzeichnung aus der EPA ins nächste Gebäude gebracht. Beim Einbau fallen mehrere Baugruppen aus.',
      ursache: ['Die Farbe wurde mit einer Eigenschaft verwechselt: „Rosa ist ableitfähig“ stimmt nicht automatisch.', 'Außerhalb der EPA fehlt die abschirmende Verpackung.', 'Der Beutel hat keine Kennzeichnung und keinen Nachweis.'],
      pruef: ['Kennzeichnung und Datenblatt der Verpackung prüfen.', 'Oberfläche nach Prüfanweisung messen: Ist sie ableitfähig?', 'Klären: Bleibt die Baugru.pes in der EPA, oder verlässt sie diese, und gibt es dann eine Abschirmung?'],
      gegen: ['Für Wege außerhalb der EPA abschirmende, gekennzeichnete Verpackung verwenden.', 'Im Lager nur freigegebene und gekennzeichnete Verpackung bereithalten.', 'Fragwürdige Verpackung sperren und den Inhalt prüfen lassen.'],
      merk: 'Die Farbe sagt nichts: Kennzeichnung und Nachweis zählen.' },
    { id: 'e04', stelle: 'ionisator', titel: 'Ionisator zugestellt',
      symptom: 'Neben einer Bestückstation steht ein Ionisator. Davor lehnt ein Karton, und der Luftstrom erreicht den Platz nicht. Isolierende Kunststoffteile bleiben geladen, Staub haftet daran, und das Prüfgerät zeigt hohe Spannungen auf der Messplatte.',
      ursache: ['Der Luftweg zwischen Ionisator und Arbeitsfläche ist zugestellt.', 'Die Emitterspitzen sind verschmutzt, die Offset-Spannung ist verstellt.', 'Abstand oder Richtung passen nicht zur Anleitung.'],
      pruef: ['Luftweg, Abstand und Ausrichtung mit der Anleitung vergleichen.', 'Offset-Spannung mit dem Prüfgerät messen: Ist der Betrag im Zielbereich?', 'Emitterspitzen ansehen und nach Plan reinigen.'],
      gegen: ['Luftweg frei halten, nichts davor abstellen.', 'Spitzen nach Plan reinigen, Offset nachstellen lassen.', 'Isolatoren am Platz trotzdem vermeiden: Der Ionisator ist nur eine Ergänzung.'],
      merk: 'Ein Ionisator hilft nur, wo seine Luft hinkommt, und nur, wenn der Offset stimmt.' },
    { id: 'e05', stelle: 'boden', titel: 'Frisch gewachster Boden und falsche Schuhe',
      symptom: 'Der ableitfähige Boden wurde frisch gewachst, und eine Kollegin trägt normale Straßenschuhe mit Gummisohle. Beim Begehtest zeigt das Prüfgerät eine hohe Körperspannung. Im trockenen Winter ist es noch schlimmer.',
      ursache: ['Eine isolierende Wachs- oder Politurschicht liegt auf dem Boden.', 'Die Schuhe sind keine ESD-Schuhe oder die Sohlen sind verschmutzt und abgenutzt.', 'Trockene Luft verschärft den Effekt.'],
      pruef: ['Begehtest: Körperspannung beim Gehen messen.', 'Widerstand von Schuh und Boden zusammen als System bewerten, nicht nur einzeln.', 'Luftfeuchte und Temperatur notieren.'],
      gegen: ['Den Boden nur mit freigegebenen Mitteln pflegen.', 'ESD-Schuhe tragen und die Sohlen sauber halten.', 'Bis zur Klärung sitzend mit Handgelenkband arbeiten.'],
      merk: 'System testen: Schuh und Boden gehören zusammen.' }
  ];
  const fehlerBild = id => FEHLER.find(f => f.id === id) || null;

  /* ---------- Quiz: 12 Aufgaben, drei Arten ---------- */
  const o = (id, t) => ({ id, t });
  /* Rechnungen der Rechenaufgaben, alle im Kern */
  const widerstandAusUI = (u, i) => (i > 0 ? u / i : NaN);
  const energieJ = (c, u) => 0.5 * c * u * u;
  const mittelwert = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  const rq4 = [8e5, 1.2e7, 6.2e6];                    /* Person, Schuh, Boden in Ω */
  const sol4 = systemWiderstand(rq4) / 1e6;           /* MΩ */
  const sol8 = widerstandAusUI(100, 2e-6) / 1e6;      /* MΩ */
  const sol10 = energieJ(150e-12, 2000) * 1e6;        /* µJ */
  const off12 = [38, 30, 46];
  const sol12 = mittelwert(off12);                    /* V */

  const QUIZ = [
    { id: 'eq1', art: 'match', level: 1, cat: 'ESD-Schutz', title: 'Wie entsteht die Ladung?',
      text: 'Ordne jeder Situation die Art der Aufladung zu.',
      items: [o('a', 'Du läufst in Gummisohlen über einen Teppich und bekommst danach an der Türklinke einen Schlag.'), o('b', 'Eine Folie wird von einer Kunststoffplatte abgezogen und knistert.'), o('c', 'Ein isolierter Metallstift liegt neben einem stark geladenen Gegenstand und wird dadurch elektrisch beeinflusst, ohne dass beide sich berühren.')],
      pool: [o('reibung', 'Reibung und Trennen'), o('influenz', 'Influenz')],
      sol: { a: 'reibung', b: 'reibung', c: 'influenz' },
      hint: ['Frage dich: Berühren sich die Körper und werden sie dann wieder getrennt?', 'Bei Reibung und Trennen wechseln Elektronen die Oberfläche. Bei Influenz verschiebt ein geladenes Teil nur Ladungen im Nachbarn.', 'Nur in einer Situation gibt es keine Berührung zwischen den beiden Körpern.'],
      weg: ['a) Gehen heißt Berühren und Wieder-Lösen der Sohle am Boden: Reibung und Trennen.', 'b) Beim Abziehen werden zwei Oberflächen getrennt: Reibung und Trennen.', 'c) Es gibt keine Berührung, die Ladungen werden nur über das elektrische Feld verschoben: Influenz.'] },
    { id: 'eq2', art: 'match', level: 1, cat: 'ESD-Schutz', title: 'Drei Modelle, drei Situationen',
      text: 'Ordne jeder Situation das passende ESD-Modell zu.',
      items: [o('a', 'Eine aufgeladene Person fasst eine Baugru.pes an.'), o('b', 'Ein Bauteil hat sich in einer Kunststoffschiene aufgeladen und entlädt sich, als ein Anschluss eine Metallfläche berührt.'), o('c', 'Ein aufgeladenes, isoliertes Metallteil, zum Beispiel ein Werkzeug, berührt den Anschluss eines Bauteils.')],
      pool: [o('hbm', 'HBM (Körpermodell)'), o('cdm', 'CDM (geladenes Bauteil)'), o('mm', 'MM (isolierter Leiter)')],
      sol: { a: 'hbm', b: 'cdm', c: 'mm' },
      hint: ['Frage dich in jeder Zeile: Was ist aufgeladen, der Mensch, das Bauteil oder ein Metallteil?', 'HBM steht für den Körper, CDM für das geladene Bauteil selbst.', 'Das Maschinenmodell (MM) beschreibt einen aufgeladenen, isolierten Leiter.'],
      weg: ['a) Geladen ist der Mensch: Körpermodell (HBM).', 'b) Geladen ist das Bauteil selbst: Modell des geladenen Bauteils (CDM).', 'c) Geladen ist ein isolierter Leiter: Maschinenmodell (MM).'] },
    { id: 'eq3', art: 'multi', level: 1, cat: 'ESD-Schutz', title: 'Bausteine eines geschützten Arbeitsplatzes',
      text: 'Wähle alle Dinge, die zu einem EPA-Arbeitsplatz gehören.',
      options: [o('band', 'Handgelenkband mit Spiralkabel, am gemeinsamen Erdungspunkt eingesteckt'), o('flaeche', 'Geerdete, ableitfähige Arbeitsfläche'), o('behaelter', 'Ableitfähige Behälter für Bauteile und Baugruppen'), o('becher', 'Kunststoffbecher und Folienma.pes direkt neben der Baugruppe'), o('schaum', 'Isolierende Schaumstoffunterlage unter der Baugruppe'), o('leiste', 'Eine beliebige Steckdosenleiste als Erdungspunkt')],
      sol: ['band', 'flaeche', 'behaelter'],
      hint: ['Gesucht sind Dinge, die Ladung ableiten, nicht welche, die Ladung erzeugen oder halten.', 'Kunststoff und Schaumstoff sind Isolatoren und gehören nicht auf den Platz.', 'Ein Erdungspunkt ist eine fest eingerichtete, geprüfte Verbindung, keine beliebige Steckdosenleiste.'],
      weg: ['Richtig sind Band, ableitfähige Fläche und ableitfähige Behälter: Diese Dinge führen Ladung kontrolliert ab.', 'Becher, Folienma.pes und Schaumstoff sind Isolatoren, sie laden sich auf und gehören nicht an den Platz.', 'Der Erdungspunkt wird vom Betrieb eingerichtet; eine beliebige Steckdosenleiste ist dafür nicht geeignet.'] },
    { id: 'eq4', art: 'calc', level: 1, cat: 'ESD-Schutz', title: 'Widerstände in Reihe',
      text: 'Rechenübung zur Reihenschaltung: Person 800 kΩ, Schuh 12 MΩ, Boden 6,2 MΩ, alle in Reihe. Berechne die Summe in MΩ. Wichtig: In der Praxis wird der Systemwiderstand als Ganzes gemessen; Einzelwerte darfst du nicht einfach addieren.',
      einheit: 'MΩ', tol: 0.05, sol: sol4,
      hint: ['Bei einer Reihenschaltung addierst du die Widerstände.', 'Rechne zuerst alles in dieselbe Einheit um: 800 kΩ sind 0,8 MΩ.', 'Addiere jetzt 0,8 plus 12 plus 6,2 und lies das Ergebnis ab.'],
      weg: ['Umrechnen: 800 kΩ = 0,8 MΩ.', 'Summe: 0,8 MΩ + 12 MΩ + 6,2 MΩ = ' + zahl(sol4, 2) + ' MΩ.', 'Einordnung: Das liegt unter dem typischen Zielwert von 35 MΩ. Entscheidend bleibt der Test des ganzen Systems.'] },
    { id: 'eq5', art: 'match', level: 2, cat: 'ESD-Schutz', title: 'Fußbodenklassen',
      text: 'Ordne jedem gemessenen Bodenwiderstand die Klasse zu. Orientierung: bis 10⁶ Ω leitend, darüber bis 10⁹ Ω ableitfähig, darüber zu hochohmig für einen ESD-Boden (typische Zielwerte der Norm, im Betrieb gilt die eigene Prüfanweisung).',
      items: [o('a', '4,0 · 10⁴ Ω'), o('b', '3,0 · 10⁷ Ω'), o('c', '2,0 · 10¹¹ Ω'), o('d', '8,0 · 10⁸ Ω')],
      pool: [o('leitend', 'leitend'), o('ableitfaehig', 'ableitfähig'), o('isolierend', 'isolierend')],
      sol: { a: 'leitend', b: 'ableitfaehig', c: 'isolierend', d: 'ableitfaehig' },
      hint: ['Vergleiche die Hochzahl mit den Grenzen 6 und 9.', '10⁴ liegt unter 10⁶, 10¹¹ liegt über 10⁹.', '10⁷ und 8 · 10⁸ liegen zwischen 10⁶ und 10⁹.'],
      weg: ['a) 4,0 · 10⁴ Ω ist kleiner als 10⁶ Ω: leitend.', 'b) 3,0 · 10⁷ Ω liegt zwischen 10⁶ und 10⁹ Ω: ableitfähig.', 'c) 2,0 · 10¹¹ Ω ist größer als 10⁹ Ω: zu hochohmig (isolierend).', 'd) 8,0 · 10⁸ Ω ist kleiner als 10⁹ Ω und größer als 10⁶ Ω: ableitfähig.'] },
    { id: 'eq6', art: 'match', level: 2, cat: 'ESD-Schutz', title: 'Verpackung richtig einordnen',
      text: 'Ordne jeder Verpackung zu, wo sie eingesetzt werden darf.',
      items: [o('a', 'Ableitfähiger, gekennzeichneter Tray ohne Abschirmung'), o('b', 'Gekennzeichneter Abschirmbeutel mit ableitfähiger Innenseite'), o('c', 'Gewöhnliche Kunststofftüte'), o('d', 'Rosa Folienbeutel ohne Kennzeichnung und ohne Nachweis')],
      pool: [o('innen', 'nur innerhalb der EPA'), o('aussen', 'auch außerhalb der EPA'), o('ungeeignet', 'ungeeignet'), o('nachweis', 'Eignung nicht belegt, erst Nachweis oder Prüfung')],
      sol: { a: 'innen', b: 'aussen', c: 'ungeeignet', d: 'nachweis' },
      hint: ['Innerhalb der EPA reicht Ableitfähigkeit. Außerhalb kommt eine Abschirmung dazu.', 'Ein Isolator ist nirgends geeignet.', 'Bei der rosa Folie fehlt jeder Beleg: Die Farbe allein beweist nichts.'],
      weg: ['a) Ableitfähig, aber ohne Abschirmung: nur innerhalb der EPA.', 'b) Ableitfähige Innenseite plus Abschirmung: auch außerhalb der EPA.', 'c) Ein Isolator lädt sich auf: ungeeignet.', 'd) Ohne Kennzeichnung oder Nachweis ist die Eigenschaft nicht belegt: erst prüfen.'] },
    { id: 'eq7', art: 'multi', level: 2, cat: 'ESD-Schutz', title: 'Warum wird die Spannung am Menschen so hoch?',
      text: 'Welche Bedingungen lassen die Aufladung einer Person besonders hoch werden?',
      options: [o('trocken', 'Sehr trockene Luft, unter 20 % relative Luftfeuchte'), o('sohle', 'Schuhe mit isolierender Sohle auf isolierendem Boden'), o('faser', 'Kunstfaserkleidung, die beim Bewegen an Stuhl und Körper reibt'), o('feucht', 'Hohe Luftfeuchte über 65 %'), o('esdboden', 'ESD-Schuhe auf ableitfähigem Boden'), o('band', 'Handgelenkband am Erdungspunkt')],
      sol: ['trocken', 'sohle', 'faser'],
      hint: ['Hohe Aufladung entsteht, wenn viel Ladung erzeugt wird und sie nicht abfließen kann.', 'Trockene Luft und Isolatoren verstärken die Aufladung.', 'Alles, was die Person ableitend mit der Erde verbindet, senkt die Spannung.'],
      weg: ['Trockene Luft, isolierende Schuhe und Boden sowie reibende Kunstfaser erzeugen viel Ladung oder lassen sie nicht abfließen.', 'Hohe Luftfeuchte senkt die Spannung stark (unter etwa 1.500 V).', 'ESD-Schuhe auf ableitfähigem Boden und das Band leiten die Ladung ab.'] },
    { id: 'eq8', art: 'calc', level: 2, cat: 'ESD-Schutz', title: 'Bodenwiderstand aus Spannung und Strom',
      text: 'Bei der Messung eines Bodens liegen 100 V an, und es fließt ein Strom von 2,0 µA. Berechne den Widerstand in MΩ.',
      einheit: 'MΩ', tol: 0.5, sol: sol8,
      hint: ['Benutze das ohmsche Gesetz: R = U geteilt durch I.', 'Rechne den Strom in Ampere: 2,0 µA = 2,0 · 10⁻⁶ A.', '100 V geteilt durch 2,0 · 10⁻⁶ A ergibt einen Wert in Ohm. Danach in MΩ umrechnen.'],
      weg: ['R = U / I = 100 V / 2,0 · 10⁻⁶ A = ' + zahl(sol8, 1) + ' MΩ.', 'Zur Kontrolle in Ohm: ' + zahl(sol8, 1) + ' MΩ sind ' + zahl(sol8 / 10, 1) + ' · 10⁷ Ω.', 'Einordnung: Das liegt zwischen 10⁶ und 10⁹ Ω, der Boden ist also ableitfähig.'] },
    { id: 'eq9', art: 'multi', level: 2, cat: 'ESD-Schutz', title: 'Regeln beim Messen von Widerständen',
      text: 'Du misst den Oberflächenwiderstand einer Arbeitsfläche. Welche Regeln gelten?',
      options: [o('elektrode', 'Die in der Prüfanweisung genannte Elektrode verwenden'), o('warten', 'Die vorgegebene Wartezeit bis zum Ablesen einhalten'), o('klima', 'Luftfeuchte und Temperatur messen und ins Protokoll schreiben'), o('bewegen', 'Die Messleitungen beim Ablesen bewegen, damit der Kontakt besser wird'), o('metall', 'Auf einer leitenden Metallplatte als Untergrund messen'), o('egal', 'Eine beliebige Elektrode nehmen, Hauptsache sie passt auf die Fläche')],
      sol: ['elektrode', 'warten', 'klima'],
      hint: ['Gute Messungen sind wiederholbar: gleiche Elektrode, gleiche Wartezeit, dokumentierte Bedingungen.', 'Bewegte Leitungen und leitende Untergründe verfälschen den Wert.', 'Der Untergrund soll isolieren, nicht leiten.'],
      weg: ['Die vorgeschriebene Elektrode, die Wartezeit und das Protokollieren von Luftfeuchte und Temperatur sind Pflicht.', 'Bewegte Leitungen erzeugen Störspannungen.', 'Ein leitender Untergrund führt Strom parallel zur Messung; der Untergrund soll isolieren.'] },
    { id: 'eq10', art: 'calc', level: 2, cat: 'ESD-Schutz', title: 'Energie einer Körperentladung',
      text: 'Der Körper wird in dieser Übung durch einen Kondensator mit C = 150 pF beschrieben. Die Person ist auf U = 2000 V aufgeladen, gerade so, dass du eine Entladung spürst. Berechne die gespeicherte Energie E = ½ · C · U² in µJ.',
      einheit: 'µJ', tol: 1, sol: sol10,
      hint: ['Die Energie eines Kondensators: E = ½ · C · U².', 'Rechne in Grundeinheiten: 150 pF = 150 · 10⁻¹² F.', 'U² = 2000² = 4 · 10⁶ V². Das Ergebnis kommt in Joule heraus; 1 J = 10⁶ µJ.'],
      weg: ['E = ½ · 150 · 10⁻¹² F · (2000 V)² = ½ · 150 · 10⁻¹² · 4 · 10⁶.', 'E = ' + zahl(sol10 / 1e6, 4) + ' J = ' + zahl(sol10, 0) + ' µJ.', 'Das ist wenig Energie, aber sie wird in weniger als einer Millionstel Sekunde an einer winzigen Stelle frei.'] },
    { id: 'eq11', art: 'multi', level: 3, cat: 'ESD-Schutz', title: 'Erdung richtig aufbauen',
      text: 'Welche Aussagen zur Erdung am ESD-Arbeitsplatz stimmen?',
      options: [o('stern', 'Alle Erdungsleitungen laufen sternförmig zu einem gemeinsamen Erdungspunkt'), o('hart', 'Hochleitfähige Metallteile werden ohne zusätzlichen Vorwiderstand direkt geerdet'), o('fachkraft', 'Änderungen am Erdungsanschluss führt nur eine Elektrofachkraft aus'), o('reihe', 'Die Plätze werden der Reihe nach von einem zum nächsten durchverbunden'), o('vor1m', 'In die Erdung jedes Metallgestells wird zur Sicherheit ein Widerstand von 1 MΩ eingebaut'), o('bandhart', 'Das Handgelenkband wird ohne Widerstand direkt am Erdungspunkt angeschlossen')],
      sol: ['stern', 'hart', 'fachkraft'],
      hint: ['Denke an Ausfälle: Was passiert hinter einer unterbrochenen Stelle in einer Reihe?', 'Bei Metallteilen soll der Weg zur Erde so sicher wie möglich sein, bei Personen soll der Strom begrenzt sein.', 'Eingriffe in elektrische Anschlüsse sind nicht Sache der Nutzer.'],
      weg: ['Sternförmig: Fällt eine Leitung aus, bleiben die anderen geerdet. In einer Reihe fällt alles hinter der Unterbrechung aus.', 'Metallteile werden hart geerdet. Ein Vorwiderstand wäre ein Sicherheitsrisiko. Beim Handgelenkband ist der Widerstand dagegen gewollt, er begrenzt den Strom durch den Körper.', 'Erdungsanschlüsse verändert nur eine Elektrofachkraft.'] },
    { id: 'eq12', art: 'calc', level: 3, cat: 'ESD-Schutz', title: 'Offset-Spannung eines Ionisators',
      text: 'Bei einem Ionisator misst du an der Prüfplatte dreimal die Offset-Spannung: +38 V, +30 V und +46 V. Berechne den Mittelwert in V. Der typische Zielwert für den Betrag liegt bei 35 V.',
      einheit: 'V', tol: 0.5, sol: sol12,
      hint: ['Der Mittelwert ist die Summe der Messwerte geteilt durch ihre Anzahl.', 'Alle drei Werte haben dasselbe Vorzeichen, du kannst sie direkt addieren.', 'Summe: 38 plus 30 plus 46, geteilt durch 3.'],
      weg: ['Summe: 38 V + 30 V + 46 V = ' + zahl(off12[0] + off12[1] + off12[2], 0) + ' V.', 'Mittelwert: ' + zahl(off12[0] + off12[1] + off12[2], 0) + ' V / 3 = ' + zahl(sol12, 1) + ' V.', 'Der Betrag liegt über 35 V: Der Offset muss nachgestellt werden, und die Ionisierung ist bis dahin nicht verlässlich.'] }
  ];
  const quizById = id => QUIZ.find(q => q.id === id) || null;

  /* antwort: match -> { itemId: poolId }, multi -> [optionId], calc -> Zahl oder Text; liefert { pct, ok, zeilen:[{ok,text}] } */
  function pruefeQuiz(task, antwort) {
    if (!task) return { pct: 0, ok: false, zeilen: [] };
    const zeilen = [];
    if (task.art === 'match') {
      const a = antwort && typeof antwort === 'object' ? antwort : {};
      task.items.forEach(it => { const ok = a[it.id] === task.sol[it.id]; const p = task.pool.find(x => x.id === a[it.id]); zeilen.push({ ok, text: it.t + ': ' + (p ? p.t : 'keine Antwort') }); });
      const n = zeilen.filter(z => z.ok).length, pct = Math.round(100 * n / task.items.length);
      return { pct, ok: pct === 100, zeilen };
    }
    if (task.art === 'multi') {
      const a = Array.isArray(antwort) ? antwort : [];
      let hit = 0, wrong = 0;
      task.options.forEach(op => { const want = task.sol.indexOf(op.id) >= 0, got = a.indexOf(op.id) >= 0; if (want && got) hit++; if (!want && got) wrong++; zeilen.push({ ok: want === got, text: op.t }); });
      const pct = Math.max(0, Math.round(100 * (hit - wrong) / task.sol.length));
      return { pct, ok: hit === task.sol.length && wrong === 0, zeilen };
    }
    if (task.art === 'calc') {
      const v = parseZahl(antwort), ok = isFinite(v) && Math.abs(v - task.sol) <= task.tol;
      zeilen.push({ ok, text: 'Ergebnis: ' + (isFinite(v) ? zahl(v, 3) + ' ' + task.einheit : 'keine gültige Zahl') });
      /* ungueltig: leer oder keine Zahl. Die Oberfläche bittet dann um eine Zahl und wertet das nicht als Fehlversuch. */
      return isFinite(v) ? { pct: ok ? 100 : 0, ok, zeilen } : { pct: 0, ok: false, zeilen, ungueltig: true };
    }
    return { pct: 0, ok: false, zeilen };
  }

  /* ---------- Quiz-Stand ----------
     Der Stand liegt in lm4.pcbquiz = { eq1: 100, fq3: 67, ... } (gemeinsam mit dem Fehlerbild-Quiz). Das Präfix lm4. gehört zur Lernstand-Sicherung der App
     (lernstand.js, Datei-Sicherung; Zahlen werden beim Einlesen mit dem höchsten Wert zusammengeführt). Der alte Schlüssel pcb.esd.quiz wurde nicht
     gesichert: Er wird einmal übernommen (höchster Wert zählt) und erst gelöscht, wenn der neue Stand sicher geschrieben ist. speicher = localStorage oder Ersatz. */
  const QUIZ_KEY = 'lm4.pcbquiz', QUIZ_ALT = 'pcb.esd.quiz', QUIZ_ID = /^eq\d+$/;
  function standRoh(speicher) {
    let d = null; try { d = JSON.parse(speicher.getItem(QUIZ_KEY) || '{}'); } catch (e) { d = null; }
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  }
  function quizUebernehmen(speicher) {
    try {
      const alt = speicher.getItem(QUIZ_ALT); if (alt == null) return false;
      let a = null; try { a = JSON.parse(alt); } catch (e) { a = null; }
      const d = standRoh(speicher); let neu = false;
      if (a && typeof a === 'object' && !Array.isArray(a)) Object.keys(a).forEach(k => { const v = +a[k]; if (QUIZ_ID.test(k) && isFinite(v) && v > (+d[k] || 0)) { d[k] = Math.min(100, Math.round(v)); neu = true; } });
      if (neu) { const txt = JSON.stringify(d); speicher.setItem(QUIZ_KEY, txt); if (speicher.getItem(QUIZ_KEY) !== txt) return false; }
      speicher.removeItem(QUIZ_ALT); return true;
    } catch (e) { return false; }
  }
  /* liefert { eq1: pct, ... } nur für die Fragen dieses Quiz */
  function quizStand(speicher) {
    const out = {}; if (!speicher) return out;
    quizUebernehmen(speicher);
    const d = standRoh(speicher); QUIZ.forEach(q => { const v = +d[q.id]; if (isFinite(v) && v > 0) out[q.id] = v; });
    return out;
  }
  function quizMerken(speicher, id, pct) {
    if (!speicher || !quizById(id) || !(pct > 0)) return false;
    try { const d = standRoh(speicher); if ((+d[id] || 0) >= pct) return false; d[id] = Math.min(100, Math.round(pct)); speicher.setItem(QUIZ_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }
  function quizLeeren(speicher) {
    if (!speicher) return;
    try { const d = standRoh(speicher); QUIZ.forEach(q => { delete d[q.id]; }); speicher.setItem(QUIZ_KEY, JSON.stringify(d)); } catch (e) { /* egal */ }
  }
  /* Lösung zeigen (wie im Linien-Lab, fliui.js): Wer die Lösung aufdeckt, bevor die Frage voll gelöst ist, bekommt für das nächste richtige Lösen
     AUF_PCT Prozent. Der Merker lm4.pcbquiz.auf = { id: 1 } wird nur gesetzt, solange der beste Wert unter 100 liegt, und beim nächsten richtigen Lösen
     gelöscht (danach zählt die Frage wieder voll). Der beste Wert bleibt immer erhalten. Tipps kosten im Quiz nichts. */
  const AUF_KEY = 'lm4.pcbquiz.auf', AUF_PCT = 25;
  function aufRoh(speicher) {
    let d = null; try { d = JSON.parse(speicher.getItem(AUF_KEY) || '{}'); } catch (e) { d = null; }
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  }
  const quizAufgedeckt = (speicher, id) => { try { return !!(speicher && aufRoh(speicher)[id]); } catch (e) { return false; } };
  function quizAufdecken(speicher, id) {
    if (!speicher || !quizById(id)) return false;
    try { if ((+standRoh(speicher)[id] || 0) >= 100) return false; const m = aufRoh(speicher); m[id] = 1; speicher.setItem(AUF_KEY, JSON.stringify(m)); return true; } catch (e) { return false; }
  }
  /* Ergebnis r = pruefeQuiz(...) werten: liefert { pct (gezählter Wert), auf (Lösung war aufgedeckt) } und speichert den besten Wert */
  function quizZaehlen(speicher, id, r) {
    const auf = quizAufgedeckt(speicher, id), pct = auf ? Math.min(r.pct, AUF_PCT) : r.pct;
    if (pct > 0) quizMerken(speicher, id, pct);
    if (auf && r.ok) { try { const m = aufRoh(speicher); delete m[id]; speicher.setItem(AUF_KEY, JSON.stringify(m)); } catch (e) { /* egal */ } }
    return { pct, auf };
  }
  /* nächste noch nicht gelöste Frage nach id (am Ende wieder von vorn), sonst null */
  function quizNaechste(stand, id) {
    const i = QUIZ.findIndex(q => q.id === id);
    for (let k = 1; k < QUIZ.length; k++) { const q = QUIZ[(i + k) % QUIZ.length]; if (!((stand && stand[q.id]) >= 100)) return q.id; }
    return null;
  }
  /* Sprechtext einer Frage wie bei den Aufgabenkarten (Vorlesen.Texte.au): Titel und Auftrag, ohne Antworten, Tipps und Lösungsweg. Schlüssel AU_pcb_<id>. */
  const sprechKey = id => 'AU_pcb_' + id;

  const api = {
    version: '1.1', QUIZ_KEY, QUIZ_ALT, quizStand, quizMerken, quizLeeren, quizUebernehmen, quizNaechste, sprechKey, AUF_KEY, AUF_PCT, quizAufgedeckt, quizAufdecken, quizZaehlen, ZIEL, SICHER, zahl, ohmText, parseZahl,
    AUFLADUNG, FEUCHTE, spannungMensch, spuerbar, SCHAEDEN, MODELLE,
    EPA_TEXT, ELEMENTE, SYSTEM, SYSTEM_REGLER, systemWiderstand, systemAmpel, BODEN, bodenKlasse, ASTATISCH, ERDUNG, erdungAusfall,
    VERPACKUNG, verpackungKlasse, verpackungEignung, IONISATOR, OFFSET_ZIEL, offsetAmpel, MESSREGELN,
    STELLEN, FEHLER, fehlerBild, QUIZ, quizById, pruefeQuiz, widerstandAusUI, energieJ, mittelwert
  };
  root.PCB_ESD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ====================================================================================
     TEIL B: OBERFLÄCHE (nur im Browser)
     ==================================================================================== */
  function installUi() {
    root.PCB_VIEWS = root.PCB_VIEWS || { views: {}, register(id, def) { this.views[id] = def; } };
    const doc = root.document;
    const lsGet = (k, d) => { try { const v = root.localStorage.getItem('pcb.esd.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
    const lsSet = (k, v) => { try { root.localStorage.setItem('pcb.esd.' + k, JSON.stringify(v)); } catch (e) { /* egal */ } };
    function h(tag, attrs, kids) {
      const e = doc.createElement(tag);
      if (attrs) for (const k in attrs) {
        const v = attrs[k]; if (v == null || v === false) continue;
        if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
      }
      (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(c => { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
      return e;
    }
    const SVGNS = 'http://www.w3.org/2000/svg';
    function s(tag, attrs) { const e = doc.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
    const CSS = `
.pes{position:relative;display:flex;flex-direction:column;height:100%;min-height:380px;background:var(--bg,#14181c);color:var(--fg,#e8ecf0);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;-webkit-user-select:text;user-select:text}
.pes *{box-sizing:border-box}
.pes-tabs{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;gap:6px;padding:8px;background:var(--panel,#222830);border-bottom:1px solid var(--line,#38424d);flex:0 0 auto}
.pes-tab{flex:0 0 auto;min-height:44px;padding:0 16px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);border-radius:22px;font-weight:600;font-size:15px;line-height:1.2;font-family:inherit;cursor:pointer;touch-action:manipulation}
.pes-tabs::-webkit-scrollbar{display:none}
.pes-tab{white-space:nowrap}
.pes-vl{min-height:56px;display:flex;align-items:center}
.pes-vl[hidden],.pes-btn[hidden]{display:none}
.pes-vl .vl-btn{margin:6px 0}
.pes-opts{margin:0;padding:0;border:0}
@media (max-width:480px){.pes-tabs{padding:6px 8px}}
.pes-tab.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.pes-body{flex:1 1 auto;overflow:auto;overflow-x:hidden;padding:10px 12px 28px;-webkit-overflow-scrolling:touch}
.pes-wrap{width:100%;max-width:980px;margin:0 auto}
.pes-card{background:var(--panel,#222830);border:1px solid var(--line,#38424d);border-radius:12px;padding:12px 14px;margin-bottom:12px;min-width:0}
.pes-card h3{margin:0 0 6px;font-size:17px;line-height:1.3}
.pes-card h4,.pes-acc h4{margin:12px 0 4px;font-size:15px;color:var(--mute,#8d99a6)}
.pes-card p{margin:0 0 8px}
.pes-card ul,.pes-acc ul{margin:0 0 8px;padding-left:20px}
.pes-card li,.pes-acc li{margin:2px 0}
.pes-mute{color:var(--mute,#8d99a6);font-size:14px}
.pes-note{border-left:4px solid var(--accent-bg,#1a6fd4);background:var(--panel2,#2c343e);padding:8px 12px;border-radius:0 8px 8px 0;margin:8px 0}
.pes-note.ok{border-color:var(--ok,#4cd964)}.pes-note.warn{border-color:var(--warn,#ffb340)}.pes-note.err{border-color:var(--danger,#ff5c5c)}
.pes-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:0 16px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);border-radius:12px;font-weight:600;font-size:15px;line-height:1.2;font-family:inherit;cursor:pointer;touch-action:manipulation}
.pes-btn.pri,.pes-btn.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.pes-btn:disabled{opacity:1;cursor:default;background:transparent;color:var(--mute,#8d99a6);border-style:dashed}
.pes-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
.pes-acc{border:1px solid var(--line,#38424d);border-radius:12px;background:var(--panel,#222830);margin-bottom:10px}
.pes-acc>summary{min-height:48px;display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;padding:6px 12px;font-weight:700}
.pes-acc>summary::-webkit-details-marker{display:none}
.pes-acc>summary::before{content:"\\203A";font-size:22px;width:14px;text-align:center;color:var(--accent,#3b9eff);transition:transform .15s;flex:none}
.pes-acc[open]>summary::before{transform:rotate(90deg)}
.pes-acc .sum{flex:1;min-width:0}
.pes-acc .sum small{display:block;font-weight:500;color:var(--mute,#8d99a6);font-size:14px}
.pes-acc>.in{padding:0 14px 12px}
.pes-pill{display:inline-block;border-radius:12px;padding:1px 10px;font-size:14px;font-weight:700;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d);color:var(--fg,#e8ecf0);flex:none}
.pes-pill.ok{color:var(--ok,#4cd964);border-color:var(--ok,#4cd964)}
.pes-pill.warn{color:var(--warn,#ffb340);border-color:var(--warn,#ffb340)}
.pes-pill.bad{color:var(--bad,#ff8a7a);border-color:var(--danger,#ff5c5c)}
.pes select,.pes-in{width:100%;min-height:44px;font-size:16px;font-family:inherit;color:var(--fg,#e8ecf0);background:var(--bg,#14181c);border:1px solid var(--line,#38424d);border-radius:10px;padding:6px 10px}
.pes-it{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding:8px 0;border-top:1px solid var(--line,#38424d)}
.pes-it:first-of-t.pes{border-top:0}
.pes-opt{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;min-height:44px;margin:6px 0 0;padding:8px 12px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);border-radius:10px;font-size:15px;line-height:1.4;font-family:inherit;cursor:pointer;touch-action:manipulation}
.pes-opt .bx{flex:none;width:22px;height:22px;border:2px solid var(--mute,#8d99a6);border-radius:6px;display:inline-grid;place-items:center;font-size:15px;line-height:1;margin-top:1px}
.pes-opt.sel{border-color:var(--accent-bg,#1a6fd4);background:var(--panel,#222830)}
.pes-opt.sel .bx{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.pes-mark{font-weight:700}.pes-mark.ok{color:var(--ok,#4cd964)}.pes-mark.bad{color:var(--danger,#ff5c5c)}
.pes-sl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:6px 0;border-top:1px solid var(--line,#38424d)}
.pes-sl:first-of-t.pes{border-top:0}
.pes-sl label{font-weight:600}
.pes-sl output{font-weight:700;font-variant-numeric:tabular-nums;color:var(--accent,#3b9eff);min-width:72px;text-align:right}
.pes-sl input[type=range]{grid-column:1/3;width:100%;height:44px;margin:0;touch-action:pan-y;accent-color:var(--accent-bg,#1a6fd4)}
.pes-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px;margin:8px 0}
.pes-k{background:var(--bg,#14181c);border:1px solid var(--line,#38424d);border-radius:10px;padding:8px 10px}
.pes-k b{display:block;font-size:20px;color:var(--accent,#3b9eff);font-variant-numeric:tabular-nums}
.pes-k span{font-size:14px;color:var(--mute,#8d99a6)}
.pes-bar{height:12px;border-radius:6px;background:var(--bg,#14181c);overflow:hidden;border:1px solid var(--line,#38424d)}
.pes-bar i{display:block;height:100%;background:var(--accent-bg,#1a6fd4)}
.pes-tbl{width:100%;border-collapse:collapse;font-size:14px}
.pes-tbl th,.pes-tbl td{text-align:left;padding:6px;border-top:1px solid var(--line,#38424d);vertical-align:middle}
.pes-tbl th{color:var(--mute,#8d99a6);font-weight:700}
.pes-tbl td.n,.pes-tbl th.n{text-align:right;font-variant-numeric:tabular-nums}
.pes-tbl tr.cur td{background:rgba(59,158,255,.2);font-weight:700}
.pes-svg{display:block;width:100%;height:auto;max-height:230px;background:var(--bg,#14181c);border:1px solid var(--line,#38424d);border-radius:10px}
.pes-chk{display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:6px 0;border-top:1px solid var(--line,#38424d)}
.pes-chk:first-of-t.pes{border-top:0}
.pes-chk input{flex:none;width:24px;height:24px;margin-top:6px;accent-color:var(--accent-bg,#1a6fd4)}
.pes-chk small{display:block;color:var(--mute,#8d99a6);font-size:14px}
.pes-pt{display:flex;align-items:center;justify-content:center;min-height:44px;padding:6px 12px;border-radius:10px;border:2px solid var(--accent-bg,#1a6fd4);background:var(--panel2,#2c343e);font-weight:700;text-align:center}
.pes-ln{width:4px;height:18px;background:var(--mute,#8d99a6);margin:0 auto}
.pes-star{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr));gap:10px;margin-top:0}
.pes-nd{display:flex;flex-direction:column;align-items:stretch;gap:0}
.pes-node{min-height:44px;display:flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:10px;border:1px solid var(--ok,#4cd964);background:var(--panel2,#2c343e);text-align:center;font-size:14px}
.pes-node.aus{border-color:var(--danger,#ff5c5c);border-style:dashed}
.pes-ch{display:flex;flex-direction:column;max-width:360px;margin:0 auto}
@media (max-width:480px){.pes-body{padding:8px 8px 24px}.pes-card{padding:10px 10px}.pes-acc>.in{padding:0 10px 10px}}
`;
    /* ---------- Vorlesen (vorlesen.js: Aufnahme AU_pcb_<id>, wenn ihr Hash zum Text passt, sonst Gerätestimme) ----------
       Der Platz für den Knopf ist fest reserviert (.pes-vl), damit beim Nachladen von vorlesen.js nichts springt. */
    const vlWarten = []; let vlLaedt = false, vlTakt = 0;
    function vlFuellen() {
      /* Wie bei den Aufgabenkarten (aufgabe-vorlesen.js): Knopf nur, wenn es zu AU_pcb_<id> eine Aufnahme gibt UND ihr Hash zum heutigen Text passt
         (nurAufnahme: nie die Gerätestimme). Ohne Aufnahme bleibt der Platz ausgeblendet, es gibt keinen leeren Raum. */
      const V = root.Vorlesen, A = root.SpeakAudio; if (!V || !V.knopf || !V.Texte || !A) return false;
      while (vlWarten.length) {
        const w = vlWarten.shift(); if (w.slot.firstChild) continue;
        const basis = V.Texte.au(w.q.title, w.q.text), key = sprechKey(w.q.id), auf = A[key];
        if (!basis || !auf || auf.h !== V.Texte.hash(basis)) continue;
        try { w.slot.appendChild(V.knopf(doc, key, basis, { nurAufnahme: true, vorladen: false, titel: 'Frage vorlesen' })); w.slot.hidden = false; } catch (e) { /* ohne Knopf weiter */ }
      }
      return true;
    }
    function vlSlot(q) {
      const slot = h('div', { class: 'pes-vl vl-wrap', 'data-key': sprechKey(q.id) }); slot.hidden = true;
      vlWarten.push({ slot, q });
      if (vlFuellen()) return slot;
      if (!vlLaedt) {
        vlLaedt = true;
        const laden = () => { try { if (root.Vorlesen && root.Vorlesen.vorladen) root.Vorlesen.vorladen(doc); } catch (e) { /* egal */ } };   // lädt sprache/index.js (Aufnahmen-Index) und speak.js nach
        try { if (root.Vorlesen) laden(); else if (!doc.querySelector('script[src="vorlesen.js"]')) { const sc = doc.createElement('script'); sc.src = 'vorlesen.js'; sc.async = true; sc.onload = () => { laden(); vlFuellen(); }; doc.head.appendChild(sc); } } catch (e) { /* egal */ }
        let n = 0; vlTakt = root.setInterval(() => { if (root.Vorlesen && !root.SpeakAudio && n === 2) laden(); if (vlFuellen() || ++n > 80) root.clearInterval(vlTakt); }, 250);
      }
      return slot;
    }
    function ensureCss() { if (doc.getElementById('pcbesd-css')) return; const st = doc.createElement('style'); st.id = 'pcbesd-css'; st.textContent = CSS; doc.head.appendChild(st); }
    const liste = arr => h('ul', null, arr.map(t => h('li', { text: t })));
    const ampelPill = (k, txt) => h('span', { class: 'pes-pill ' + (k === 'gruen' ? 'ok' : k === 'gelb' ? 'warn' : 'bad'), text: (k === 'gruen' ? '✓ ' : k === 'gelb' ? '! ' : '✗ ') + txt });
    const zielNote = () => h('p', { class: 'pes-mute', text: ZIEL });
    function slider(id, label, min, max, step, val, fmt, onChange) {
      const out = h('output', { 'for': id }), inp = h('input', { type: 'range', id, min: String(min), max: String(max), step: String(step), 'aria-label': label });
      inp.value = String(val); out.textContent = fmt(+inp.value);
      inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onChange(+inp.value); });
      return { el: h('div', { class: 'pes-sl' }, [h('label', { 'for': id, text: label }), out, inp]), inp, out };
    }
    function fehlerCard(f, st) {
      const d = h('details', { class: 'pes-acc', 'data-f': f.id });
      if (st.open === f.id) d.open = true;
      d.addEventListener('toggle', () => { if (d.open) { st.open = f.id; lsSet('fb', { open: f.id }); } else if (st.open === f.id) { st.open = null; lsSet('fb', { open: null }); } });
      d.appendChild(h('summary', null, h('span', { class: 'sum' }, [f.titel, h('small', { text: 'Fehlerbild · ' + STELLEN[f.stelle] })])));
      d.appendChild(h('div', { class: 'in' }, [
        h('h4', { text: 'Beobachtung (Symptom)' }), h('p', { text: f.symptom }),
        h('h4', { text: 'Mögliche Ursachen' }), liste(f.ursache),
        h('h4', { text: 'Prüfweg' }), liste(f.pruef),
        h('h4', { text: 'Gegenmaßnahme' }), liste(f.gegen),
        h('div', { class: 'pes-note ok' }, [h('b', { text: 'Merkregel: ' }), f.merk])
      ]));
      return d;
    }
    function fehlerBlock(host, ids, titel) {
      const st = Object.assign({ open: null }, lsGet('fb', {}));
      host.appendChild(h('div', { class: 'pes-card' }, [h('h3', { text: titel }), h('p', { class: 'pes-mute', text: 'Gehe von der Beobachtung zur Ursache: Was siehst du, was kann dahinterstecken, wie prüfst du es, was änderst du?' })]));
      ids.forEach(id => host.appendChild(fehlerCard(fehlerBild(id), st)));
    }

    /* ---------- Reiter 1: Grundlagen ---------- */
    function viewGrund(host) {
      host.appendChild(h('div', { class: 'pes-card' }, [
        h('h3', { text: 'ESD: Was ist das und warum ist es wichtig?' }),
        h('p', { text: 'ESD steht für elektrostatische Entladung: Zwischen zwei Körpern liegt eine große Spannung, und die Ladung gleicht sich in einem winzigen Augenblick aus. Dabei fließt kurzzeitig ein sehr hoher Strom. Für dich ist das oft kaum zu spüren, ein empfindliches Bauteil kann dabei aber zerstört oder vorgeschädigt werden.' }),
        h('div', { class: 'pes-note warn' }, [h('b', { text: 'Hinweis: ' }), 'In explosionsgefährdeten Bereichen gelten zusätzliche Regeln, die hier nicht behandelt werden. Alle Zahlen in diesem Reiter sind Übungswerte oder typische Zielwerte der Norm (DIN EN IEC 61340-5-1). Im Betrieb gilt die eigene Prüfanweisung.'])
      ]));
      const ac = h('div', { class: 'pes-card' }, [h('h3', { text: 'Wie entsteht Aufladung?' })]);
      AUFLADUNG.forEach(a => { ac.appendChild(h('h4', { text: a.titel })); ac.appendChild(h('p', { text: a.text })); });
      host.appendChild(ac);

      /* Regler Luftfeuchte */
      const st = Object.assign({ rf: 40 }, lsGet('grund', {}));
      if (!(st.rf >= 10 && st.rf <= 80)) st.rf = 40;
      const card = h('div', { class: 'pes-card' }), kpi = h('div', { class: 'pes-kpi', 'aria-live': 'polite' }), svgHost = h('div'), tbl = h('div');
      card.appendChild(h('h3', { text: 'Spannung am Menschen und Luftfeuchte' }));
      card.appendChild(h('p', { text: 'Bei feuchter Luft liegt auf Oberflächen ein dünner Feuchtefilm: Es entsteht weniger Ladung, und sie fließt schneller ab. Stelle die relative Luftfeuchte ein und beobachte die Spannung, die ein Mensch durch Gehen aufbauen kann.' }));
      const sl = slider('pes-rf', 'Relative Luftfeuchte', 10, 80, 1, st.rf, v => v + ' %', v => { st.rf = v; lsSet('grund', { rf: v }); upd(); });
      card.appendChild(sl.el); card.appendChild(kpi); card.appendChild(svgHost);
      card.appendChild(h('p', { class: 'pes-mute', text: 'Diagramm: waagerecht die relative Luftfeuchte von 10 bis 80 Prozent, senkrecht die Spannung (logarithmisch, von 100 V bis 50.000 V). Gestrichelt: die Spürgrenze bei etwa 2.000 V und das Ziel von 100 V am Arbeitsplatz.' }));
      card.appendChild(tbl);
      card.appendChild(h('p', { class: 'pes-mute', text: 'Eckwerte der Übung: unter 20 % relativer Luftfeuchte bis etwa 35.000 V, über 65 % unter 1.500 V. Dazwischen ist der Verlauf eine glatte Näherung, kein Messwert. Typische Zielwerte der Norm für die Spannung am Menschen: unter ±100 V.' }));
      host.appendChild(card);
      const W = 320, H = 160, X0 = 8, X1 = 312, Y0 = 8, Y1 = 152, LMIN = Math.log(100), LMAX = Math.log(50000);
      const px = rf => X0 + (rf - 10) / 70 * (X1 - X0), py = u => Y1 - (Math.log(Math.max(100, Math.min(50000, u))) - LMIN) / (LMAX - LMIN) * (Y1 - Y0);
      function drawSvg() {
        const g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'pes-svg', role: 'img', 'aria-label': 'Kurve: Spannung am Menschen fällt mit steigender Luftfeuchte' });
        const ln = (y, col) => g.appendChild(s('line', { x1: X0, x2: X1, y1: py(y), y2: py(y), stroke: col, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
        ln(FEUCHTE.spuerbarU, 'var(--warn,#ffb340)'); ln(FEUCHTE.zielU, 'var(--ok,#4cd964)');
        let pts = ''; for (let rf = 10; rf <= 80; rf += 1) pts += px(rf).toFixed(1) + ',' + py(spannungMensch(rf)).toFixed(1) + ' ';
        g.appendChild(s('polyline', { points: pts.trim(), fill: 'none', stroke: 'var(--accent,#3b9eff)', 'stroke-width': 3 }));
        const u = spannungMensch(st.rf);
        g.appendChild(s('line', { x1: px(st.rf), x2: px(st.rf), y1: Y0, y2: Y1, stroke: 'var(--mute,#8d99a6)', 'stroke-width': 1 }));
        g.appendChild(s('circle', { cx: px(st.rf), cy: py(u), r: 7, fill: spuerbar(u) ? 'var(--danger,#ff5c5c)' : 'var(--ok,#4cd964)', stroke: 'var(--bg,#14181c)', 'stroke-width': 2 }));
        svgHost.innerHTML = ''; svgHost.appendChild(g);
      }
      function upd() {
        const u = spannungMensch(st.rf), uz = Math.round(u / 10) * 10;
        kpi.innerHTML = '';
        kpi.appendChild(h('div', { class: 'pes-k' }, [h('b', { text: '≈ ' + zahl(uz, 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' V' }), h('span', { text: 'Spannung am Menschen (Übungswert)' })]));
        kpi.appendChild(h('div', { class: 'pes-k' }, [h('b', { text: spuerbar(u) ? 'ja' : 'nein' }), h('span', { text: 'Entladung spürbar (ab etwa 2.000 V)' })]));
        kpi.appendChild(h('div', { class: 'pes-k' }, [h('b', { text: zahl(u / 100, 0) + ' mal' }), h('span', { text: 'so viel wie das Ziel von 100 V' })]));
        drawSvg();
      }
      const rows = []; for (let rf = 10; rf <= 80; rf += 10) rows.push(rf);
      tbl.appendChild(h('table', { class: 'pes-tbl' }, [h('thead', null, h('tr', null, [h('th', { text: 'Luftfeuchte' }), h('th', { class: 'n', text: 'Spannung etwa' })])), h('tbody', null, rows.map(rf => h('tr', null, [h('td', { text: rf + ' %' }), h('td', { class: 'n', text: zahl(Math.round(spannungMensch(rf) / 100) * 100, 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' V' })])))]));
      upd();

      const sc = h('div', { class: 'pes-card' }, [h('h3', { text: 'Schadensbilder' })]);
      SCHAEDEN.forEach(a => { sc.appendChild(h('h4', { text: a.titel })); sc.appendChild(h('p', { text: a.text })); });
      host.appendChild(sc);
      const mc = h('div', { class: 'pes-card' }, [h('h3', { text: 'Drei Modelle in einfachen Worten' }), h('p', { class: 'pes-mute', text: 'Die Modelle beschreiben, woher die Ladung kommt. Danach richten sich Prüfungen und Schutzmaßnahmen.' })]);
      MODELLE.forEach(m => mc.appendChild(h('details', { class: 'pes-acc' }, [h('summary', null, h('span', { class: 'sum' }, [m.kurz + ': ' + m.name])), h('div', { class: 'in' }, [h('p', { text: m.text }), h('div', { class: 'pes-note' }, [h('b', { text: 'Zielwert: ' }), m.ziel + ' '], null), zielNote()])])));
      host.appendChild(mc);
    }

    /* ---------- Reiter 2: EPA und Erdung ---------- */
    function viewEpa(host) {
      host.appendChild(h('div', { class: 'pes-card' }, [h('h3', { text: 'Die EPA: der geschützte Arbeitsbereich' }), h('p', { text: EPA_TEXT }), h('div', { class: 'pes-note warn' }, [h('b', { text: 'Sicherheit: ' }), SICHER])]));
      const el = h('div', { class: 'pes-card' }, [h('h3', { text: 'Aufbau: fünf Bausteine' }), h('p', { class: 'pes-mute', text: 'Ti.pes einen Baustein an.' })]);
      ELEMENTE.forEach(e => el.appendChild(h('details', { class: 'pes-acc' }, [h('summary', null, h('span', { class: 'sum' }, e.name)), h('div', { class: 'in' }, h('p', { text: e.text }))])));
      host.appendChild(el);

      /* Systemwiderstand */
      const st = Object.assign({ e: {}, bo: 7 }, lsGet('sys', {}));
      const ex = id => { const r = SYSTEM_REGLER.find(x => x.id === id), v = st.e[id]; return typeof v === 'number' && v >= r.min && v <= r.max ? v : r.start; };
      const sc = h('div', { class: 'pes-card' }), out = h('div', { 'aria-live': 'polite' });
      sc.appendChild(h('h3', { text: 'Systemwiderstand Person, Schuh und Boden' }));
      sc.appendChild(h('p', { text: 'Wer steht oder geht, wird über Schuh und Boden geerdet: Der Strom fließt von der Person durch den Schuh in den Boden. Die drei Widerstände liegen also in Reihe. Stelle sie ein (jeweils als Zehnerpotenz) und sieh, wie sich die Summe verhält.' }));
      SYSTEM_REGLER.forEach(r => sc.appendChild(slider('pes-sys-' + r.id, r.name, r.min, r.max, 0.1, ex(r.id), v => ohmText(Math.pow(10, v)), v => { st.e[r.id] = v; lsSet('sys', { e: st.e }); calc(); }).el));
      sc.appendChild(out);
      sc.appendChild(h('div', { class: 'pes-note warn' }, [h('b', { text: 'System testen, Einzelwerte nicht addieren: ' }), 'Die Summe hier ist eine Rechenübung zur Reihenschaltung. In der Praxis messen Fachleute das ganze System, zum Beispiel mit dem Begehtest, denn Übergangswiderstände und Luftfeuchte spielen mit.']));
      sc.appendChild(zielNote());
      host.appendChild(sc);
      function calc() {
        const vals = SYSTEM_REGLER.map(r => Math.pow(10, ex(r.id))), sum = systemWiderstand(vals), k = systemAmpel(sum);
        out.innerHTML = '';
        out.appendChild(h('div', { class: 'pes-kpi' }, [h('div', { class: 'pes-k' }, [h('b', { text: ohmText(sum) }), h('span', { text: 'Summe in Reihe' })]), h('div', { class: 'pes-k' }, [ampelPill(k, k === 'gruen' ? 'im Zielbereich' : k === 'gelb' ? 'nur mit Begehtest' : 'zu hoch')])]));
        out.appendChild(h('p', { class: 'pes-mute', text: k === 'gruen' ? 'Unter 35 MΩ: typischer Zielwert für das System erreicht.' : k === 'gelb' ? 'Zwischen 35 MΩ und 1 GΩ: nur zulässig, wenn der Begehtest eine Körperspannung unter 100 V zeigt.' : 'Ab 1 GΩ: zu hoch. Schuh oder Boden prüfen, Sohlen reinigen, Luftfeuchte beachten.' }));
      }
      calc();

      /* Fußbodenklassen */
      const bc = h('div', { class: 'pes-card' }), bOut = h('div', { 'aria-live': 'polite' }), bt = h('div');
      bc.appendChild(h('h3', { text: 'Fußbodenklassen nach Widerstand' }));
      bc.appendChild(h('p', { text: 'Ein Boden wird nach seinem Widerstand eingeordnet. Stelle den Widerstand ein und sieh die Klasse.' }));
      bc.appendChild(slider('pes-bo', 'Bodenwiderstand', 3, 12, 0.1, st.bo >= 3 && st.bo <= 12 ? st.bo : 7, v => ohmText(Math.pow(10, v)), v => { st.bo = v; lsSet('sys', { e: st.e, bo: v }); bcalc(); }).el);
      bc.appendChild(bOut); bc.appendChild(bt);
      bc.appendChild(h('p', { class: 'pes-mute', text: ASTATISCH }));
      bc.appendChild(zielNote());
      host.appendChild(bc);
      function bcalc() {
        const r = Math.pow(10, +(st.bo >= 3 && st.bo <= 12 ? st.bo : 7)), k = bodenKlasse(r), b = BODEN.find(x => x.id === k);
        bOut.innerHTML = ''; bOut.appendChild(h('div', { class: 'pes-row' }, [h('b', { text: ohmText(r) }), h('span', { class: 'pes-pill ' + (k === 'ableitfaehig' ? 'ok' : k === 'leitend' ? 'warn' : 'bad'), text: (k === 'ableitfaehig' ? '✓ ' : k === 'leitend' ? '! ' : '✗ ') + b.name })]));
        bOut.appendChild(h('p', { text: b.text }));
        bt.innerHTML = ''; bt.appendChild(h('table', { class: 'pes-tbl' }, [h('thead', null, h('tr', null, [h('th', { text: 'Klasse' }), h('th', { text: 'Bereich' })])), h('tbody', null, BODEN.map(x => h('tr', { class: x.id === k ? 'cur' : '' }, [h('td', { text: x.name }), h('td', { text: x.bereich })])))]));
      }
      bcalc();

      /* Erdung */
      const eg = h('div', { class: 'pes-card' }), es = Object.assign({ form: 'stern', pos: 0 }, lsGet('erd', {})), diag = h('div', { 'aria-live': 'polite' });
      if (es.form !== 'stern' && es.form !== 'reihe') es.form = 'stern'; if (!(es.pos >= 0 && es.pos <= 4)) es.pos = 0;
      eg.appendChild(h('h3', { text: 'Erdung: sternförmig statt in Reihe' }));
      eg.appendChild(h('p', { text: ERDUNG.stern }));
      const btnS = h('button', { class: 'pes-btn', 'aria-pressed': 'false', text: 'Sternförmig', onclick: () => { es.form = 'stern'; sv(); drawE(); } });
      const btnR = h('button', { class: 'pes-btn', 'aria-pressed': 'false', text: 'In Reihe', onclick: () => { es.form = 'reihe'; sv(); drawE(); } });
      const sel = h('select', { 'aria-label': 'Wo ist die Leitung unterbrochen?' }, [h('option', { value: '0', text: 'Keine Unterbrechung' })].concat([1, 2, 3, 4].map(i => h('option', { value: String(i), text: 'Unterbrechung bei Platz ' + i }))));
      sel.value = String(es.pos); sel.addEventListener('change', () => { es.pos = +sel.value; sv(); drawE(); });
      eg.appendChild(h('div', { class: 'pes-row' }, [btnS, btnR])); eg.appendChild(h('div', { class: 'pes-row' }, h('div', { style: 'flex:1 1 240px' }, sel))); eg.appendChild(diag);
      const sv = () => lsSet('erd', { form: es.form, pos: es.pos });
      function drawE() {
        btnS.className = 'pes-btn' + (es.form === 'stern' ? ' on' : ''); btnS.setAttribute('aria-pressed', es.form === 'stern' ? 'true' : 'false');
        btnR.className = 'pes-btn' + (es.form === 'reihe' ? ' on' : ''); btnR.setAttribute('aria-pressed', es.form === 'reihe' ? 'true' : 'false');
        const g = erdungAusfall(es.form, es.pos, 4);
        const node = i => h('div', { class: 'pes-node' + (g[i] ? '' : ' aus'), text: 'Platz ' + (i + 1) + (g[i] ? ': geerdet' : ': ohne Erdung') });
        diag.innerHTML = '';
        if (es.form === 'stern') {
          diag.appendChild(h('div', { class: 'pes-ch' }, h('div', { class: 'pes-pt', text: 'Gemeinsamer Erdungspunkt' })));
          diag.appendChild(h('div', { class: 'pes-ch' }, h('div', { class: 'pes-ln' })));
          diag.appendChild(h('div', { class: 'pes-star' }, [0, 1, 2, 3].map(i => h('div', { class: 'pes-nd' }, [node(i)]))));
        } else {
          const ch = h('div', { class: 'pes-ch' }, h('div', { class: 'pes-pt', text: 'Gemeinsamer Erdungspunkt' }));
          [0, 1, 2, 3].forEach(i => { ch.appendChild(h('div', { class: 'pes-ln' })); ch.appendChild(node(i)); });
          diag.appendChild(ch);
        }
        const bad = g.filter(x => !x).length;
        diag.appendChild(h('p', { class: 'pes-mute', text: es.pos === 0 ? 'Ohne Unterbrechung sind beide Formen geerdet. Wähle eine Unterbrechung, um den Unterschied zu sehen.' : bad + (bad === 1 ? ' Platz ist' : ' Plätze sind') + ' ohne Erdung. ' + (es.form === 'stern' ? 'Im Stern trifft es nur den einen Platz.' : 'In der Reihe fällt alles hinter der Unterbrechung aus.') }));
      }
      drawE();
      eg.appendChild(h('div', { class: 'pes-note' }, [h('b', { text: 'Zielwerte der Erdung: ' }), ERDUNG.ziel]));
      eg.appendChild(h('p', { text: ERDUNG.arten }));
      eg.appendChild(h('h4', { text: 'Hart geerdet oder mit Vorwiderstand?' }));
      eg.appendChild(h('p', { text: ERDUNG.hart }));
      eg.appendChild(h('p', { text: ERDUNG.person }));
      eg.appendChild(h('div', { class: 'pes-note warn' }, [h('b', { text: 'Sicherheit: ' }), SICHER]));
      eg.appendChild(zielNote());
      host.appendChild(eg);
      fehlerBlock(host, ['e01', 'e02', 'e05'], 'Fehlerbilder: Person, Band, Schuhe und Boden');
    }

    /* ---------- Reiter 3: Verpacken und Messen ---------- */
    function viewVM(host) {
      const st = Object.assign({ ort: 'innen', off: 20, chk: {} }, lsGet('vm', {}));
      if (st.ort !== 'innen' && st.ort !== 'aussen') st.ort = 'innen'; if (!(st.off >= -80 && st.off <= 80)) st.off = 20; if (!st.chk || typeof st.chk !== 'object') st.chk = {};
      const save = () => lsSet('vm', { ort: st.ort, off: st.off, chk: st.chk });
      /* Verpackung */
      const pc = h('div', { class: 'pes-card' }), pl = h('div', { 'aria-live': 'polite' });
      pc.appendChild(h('h3', { text: 'Verpackung: innerhalb und außerhalb der EPA' }));
      pc.appendChild(h('p', { text: 'Innerhalb der EPA muss Verpackung ableitfähig sein, wenn sie das Bauteil direkt berührt. Außerhalb der EPA kommt eine Abschirmung gegen Entladungen von außen dazu. Die Norm dafür ist IEC 61340-5-3. Wähle, wo die Verpackung eingesetzt wird.' }));
      const bI = h('button', { class: 'pes-btn', text: 'Innerhalb der EPA', onclick: () => { st.ort = 'innen'; save(); drawP(); } }), bA = h('button', { class: 'pes-btn', text: 'Außerhalb der EPA', onclick: () => { st.ort = 'aussen'; save(); drawP(); } });
      pc.appendChild(h('div', { class: 'pes-row' }, [bI, bA])); pc.appendChild(pl);
      pc.appendChild(h('div', { class: 'pes-note warn' }, [h('b', { text: 'Rosa heißt nicht automatisch ableitfähig. ' }), 'Die Farbe sagt nichts über die Eigenschaft. Verlass dich auf Kennzeichnung und Nachweis.']));
      host.appendChild(pc);
      function drawP() {
        bI.className = 'pes-btn' + (st.ort === 'innen' ? ' on' : ''); bI.setAttribute('aria-pressed', st.ort === 'innen' ? 'true' : 'false');
        bA.className = 'pes-btn' + (st.ort === 'aussen' ? ' on' : ''); bA.setAttribute('aria-pressed', st.ort === 'aussen' ? 'true' : 'false');
        pl.innerHTML = '';
        VERPACKUNG.forEach(p => {
          const e = verpackungEignung(p, st.ort);
          pl.appendChild(h('div', { class: 'pes-it' }, [h('div', null, [h('b', { text: p.name })]), h('div', null, h('span', { class: 'pes-pill ' + (e === 'ok' ? 'ok' : e === 'nachweis' ? 'warn' : 'bad'), text: e === 'ok' ? '✓ geeignet' : e === 'nachweis' ? '! Nachweis fehlt' : '✗ nicht geeignet' })), h('div', { class: 'pes-mute', text: p.info })]));
        });
      }
      drawP();
      /* Ionisator */
      const ic = h('div', { class: 'pes-card' }), io = h('div', { 'aria-live': 'polite' });
      ic.appendChild(h('h3', { text: 'Ionisator: die Grundidee' }));
      ic.appendChild(h('p', { text: IONISATOR.idee }));
      IONISATOR.arten.forEach(a => ic.appendChild(h('details', { class: 'pes-acc' }, [h('summary', null, h('span', { class: 'sum' }, a.name)), h('div', { class: 'in' }, h('p', { text: a.text }))])));
      ic.appendChild(h('h4', { text: 'Offset-Spannung' })); ic.appendChild(h('p', { text: IONISATOR.offset }));
      ic.appendChild(slider('pes-off', 'Offset-Spannung (Übung)', -80, 80, 1, st.off, v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' V', v => { st.off = v; save(); drawO(); }).el);
      ic.appendChild(io); ic.appendChild(zielNote());
      host.appendChild(ic);
      function drawO() {
        const k = offsetAmpel(st.off); io.innerHTML = '';
        io.appendChild(h('div', { class: 'pes-row' }, [ampelPill(k, k === 'gruen' ? 'Betrag unter 35 V: im Zielbereich' : 'Betrag ab 35 V: nachstellen lassen')]));
        io.appendChild(h('p', { class: 'pes-mute', text: 'Positiv bedeutet: zu viele positive Ionen. Negativ: zu viele negative Ionen. Beides lädt isolierte Teile in der Nähe wieder auf.' }));
      }
      drawO();
      /* Messen */
      const mc = h('div', { class: 'pes-card' }), mp = h('p', { class: 'pes-mute', 'aria-live': 'polite' });
      mc.appendChild(h('h3', { text: 'Messregeln für Widerstandsmessungen' }));
      mc.appendChild(h('p', { text: 'Wer Boden, Arbeitsfläche oder Verpackung misst, muss reproduzierbar messen. Hake ab, was du vor der Messung geklärt hast.' }));
      MESSREGELN.forEach(r => {
        const inp = h('input', { type: 'checkbox', id: 'pes-m-' + r.id }); inp.checked = !!st.chk[r.id];
        inp.addEventListener('change', () => { st.chk[r.id] = inp.checked; save(); prog(); });
        mc.appendChild(h('label', { class: 'pes-chk', 'for': 'pes-m-' + r.id }, [inp, h('span', null, [r.regel, h('small', { text: 'Warum: ' + r.warum })])]));
      });
      mc.appendChild(mp);
      mc.appendChild(h('p', { class: 'pes-mute', text: 'Für die Qualifikation von Produkten werden oft kontrollierte, trockene Bedingungen gefordert (zum Beispiel etwa 12 % relative Luftfeuchte bei 23 °C, mit Toleranz und einer Vorlagerung der Proben von mehreren Stunden bis Tagen). Welche Bedingungen im Betrieb gelten, steht in der Prüfanweisung.' }));
      host.appendChild(mc);
      function prog() { const n = MESSREGELN.filter(r => st.chk[r.id]).length; mp.textContent = n + ' von ' + MESSREGELN.length + ' Punkten geklärt.' + (n === MESSREGELN.length ? ' Du kannst messen.' : ''); }
      prog();
      fehlerBlock(host, ['e03', 'e04'], 'Fehlerbilder: Verpackung und Ionisator');
    }

    /* ---------- Reiter 4: Quiz ---------- */
    function viewQuiz(host, env) {
      const speicher = (() => { try { return root.localStorage; } catch (e) { return null; } })();
      const done = quizStand(speicher), tips = {}, karten = {};
      const melde = () => { try { if (env.ctx && env.ctx.quizChanged) env.ctx.quizChanged(); } catch (e) { /* egal */ } };
      const head = h('div', { class: 'pes-card' }), listHost = h('div');
      host.appendChild(head); host.appendChild(listHost);
      function heads() {
        const n = QUIZ.filter(q => (done[q.id] || 0) >= 100).length;
        head.innerHTML = '';
        head.appendChild(h('h3', { text: 'Quiz: ESD-Schutz' }));
        head.appendChild(h('p', { text: 'Zwölf Aufgaben: Zuordnen, Mehrfachwahl und Rechnen. Jede Aufgabe hat drei Tipps. Den Lösungsweg siehst du nach dem Lösen. Gelöst: ' + n + ' von ' + QUIZ.length + '.' }));
        head.appendChild(h('div', { class: 'pes-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(QUIZ.length), 'aria-valuenow': String(n), 'aria-label': 'Gelöste Aufgaben' }, h('i', { style: 'width:' + Math.round(100 * n / QUIZ.length) + '%' })));
        head.appendChild(h('div', { class: 'pes-row' }, h('button', { class: 'pes-btn', text: 'Fortschritt zurücksetzen', onclick: () => { Object.keys(done).forEach(k => delete done[k]); quizLeeren(speicher); melde(); heads(); build(); } })));
      }
      const ART = { match: 'Zuordnung', multi: 'Mehrfachwahl', calc: 'Rechnung' };
      function oeffne(id) {
        const d = karten[id]; if (!d) return false;
        Object.keys(karten).forEach(k => { if (k !== id) karten[k].open = false; });
        d.open = true;
        try { d.scrollIntoView({ block: 'start' }); const su = d.querySelector('summary'); if (su) su.focus({ preventScroll: true }); } catch (e) { /* egal */ }
        return true;
      }
      function taskCard(q) {
        const ans = q.art === 'match' ? {} : q.art === 'multi' ? [] : { v: '' };
        let inp = null;
        const d = h('details', { class: 'pes-acc', 'data-q': q.id }); karten[q.id] = d;
        const stars = '★'.repeat(q.level) + '☆'.repeat(3 - q.level);
        const pill = () => (done[q.id] >= 100 ? h('span', { class: 'pes-pill ok', text: 'gelöst' }) : null);
        d.appendChild(h('summary', null, [h('span', { class: 'sum' }, [q.id.replace('eq', '') + ' · ' + q.title, h('small', { text: ART[q.art] + ' · Stufe ' + stars })]), pill()]));
        const inn = h('div', { class: 'in' }); d.appendChild(inn);
        const res = h('div', { 'aria-live': 'polite' }), tip = h('div'), weg = h('div'), sel = [];
        inn.appendChild(h('p', { text: q.text }));
        inn.appendChild(vlSlot(q));
        if (q.art === 'match') {
          q.items.forEach(it => {
            const sl = h('select', { 'aria-label': 'Zuordnung für: ' + it.t }, [h('option', { value: '', text: '– bitte wählen –' })].concat(q.pool.map(p => h('option', { value: p.id, text: p.t }))));
            sl.addEventListener('change', () => { ans[it.id] = sl.value; });
            const mk = h('span', { class: 'pes-mark' });
            inn.appendChild(h('div', { class: 'pes-it' }, [h('div', { text: it.t }), sl, mk])); sel.push({ id: it.id, mk });
          });
        } else if (q.art === 'multi') {
          const grp = h('div', { class: 'pes-opts', role: 'group', 'aria-label': 'Antworten, mehrere können richtig sein' }); inn.appendChild(grp);
          q.options.forEach(op => {
            const bx = h('span', { class: 'bx', 'aria-hidden': 'true' }), b = h('button', { type: 'button', class: 'pes-opt', role: 'checkbox', 'aria-checked': 'false', 'data-k': op.id }, [bx, h('span', { text: op.t })]);
            b.addEventListener('click', () => { const i = ans.indexOf(op.id); if (i >= 0) ans.splice(i, 1); else ans.push(op.id); const on = ans.indexOf(op.id) >= 0; b.classList.toggle('sel', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); bx.textContent = on ? '✓' : ''; });
            grp.appendChild(b);
          });
        } else {
          inp = h('input', { class: 'pes-in', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Ergebnis in ' + q.einheit, placeholder: 'Ergebnis in ' + q.einheit });
          inp.addEventListener('input', () => { ans.v = inp.value; });
          inn.appendChild(h('div', { class: 'pes-row' }, [h('div', { style: 'flex:1 1 200px' }, inp), h('b', { text: q.einheit })]));
        }
        const bCheck = h('button', { class: 'pes-btn pri', text: 'Prüfen', onclick: () => {
          const r = pruefeQuiz(q, q.art === 'calc' ? ans.v : ans), rect = bCheck.getBoundingClientRect();
          if (r.ungueltig) {   /* leer oder keine Zahl: kein Fehlversuch, kein Ton, nichts wird gespeichert */
            res.innerHTML = ''; res.appendChild(h('div', { class: 'pes-note warn', 'data-art': 'zahl', text: 'Bitte eine Zahl eingeben, zum Beispiel 12,5.' }));
            try { if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); } } catch (e) { /* egal */ }
            return;
          }
          if (inp) inp.removeAttribute('aria-invalid');
          if (q.art === 'match') sel.forEach(o2 => { const z = r.zeilen[q.items.findIndex(it => it.id === o2.id)]; o2.mk.textContent = z.ok ? '✓ richtig' : '✗ noch nicht'; o2.mk.className = 'pes-mark ' + (z.ok ? 'ok' : 'bad'); });
          res.innerHTML = '';
          const z = quizZaehlen(speicher, q.id, r);
          res.appendChild(h('div', { class: 'pes-note ' + (r.ok ? 'ok' : 'warn'), text: r.ok ? (z.auf ? 'Richtig! Gezählt: ' + z.pct + ' %, weil die Lösung aufgedeckt war. Löse die Frage später noch einmal ohne Lösung, dann zählt sie voll.' : 'Richtig! 100 %') : 'Noch nicht ganz' + (q.art === 'calc' ? '' : ': ' + r.pct + ' %') + '. Nutze einen Tipp oder versuche es noch einmal. Kommst du gar nicht weiter, kannst du dir die Lösung zeigen lassen. Dann zählt die Frage in dieser Runde nur ' + AUF_PCT + ' %.' }));
          if ((done[q.id] || 0) < z.pct) { done[q.id] = z.pct; melde(); }
          if (r.ok) { bWeg.hidden = true; zeigeWeg(''); } else if (!weg.firstChild) bWeg.hidden = false;
          if (r.ok) {
            const nx = quizNaechste(done, q.id);
            if (nx) res.appendChild(h('div', { class: 'pes-row' }, h('button', { type: 'button', class: 'pes-btn pri', 'data-weiter': nx, text: 'Weiter →', 'aria-label': 'Weiter zur nächsten offenen Frage', onclick: () => oeffne(nx) })));
            else res.appendChild(h('p', { class: 'pes-mute', text: 'Alle zwölf Fragen sind gelöst.' }));
          }
          env.fx(r.ok ? 'ding' : 'sad', rect.left + rect.width / 2, rect.top, r.ok ? 'Richtig!' : 'Fast');
          const ps = d.querySelector('summary .pes-pill'); if (r.ok && !ps) d.querySelector('summary').appendChild(pill()); heads();
        } });
        const bTip = h('button', { class: 'pes-btn', text: 'Tipp (0/3)', onclick: () => {
          tips[q.id] = Math.min(3, (tips[q.id] || 0) + 1); tip.innerHTML = '';
          for (let i = 0; i < tips[q.id]; i++) tip.appendChild(h('div', { class: 'pes-note', text: 'Tipp ' + (i + 1) + ': ' + q.hint[i] }));
          bTip.textContent = 'Tipp (' + tips[q.id] + '/3)'; if (tips[q.id] >= 3) bTip.disabled = true;
        } });
        const zeigeWeg = zusatz => { weg.innerHTML = ''; weg.appendChild(h('div', { class: 'pes-note' }, [h('b', { text: 'Lösungsweg' })].concat(q.weg.map(t => h('p', { style: 'margin:4px 0', text: t })), zusatz ? [h('p', { class: 'pes-mute', style: 'margin:8px 0 0', text: zusatz })] : []))); };
        /* Lösung zeigen: erst nach einer falschen Antwort sichtbar (wie im Linien-Lab) */
        const bWeg = h('button', { type: 'button', class: 'pes-btn', 'data-sol': q.id, text: 'Lösung zeigen', onclick: () => {
          const neu = quizAufdecken(speicher, q.id); bWeg.hidden = true;
          zeigeWeg(neu || quizAufgedeckt(speicher, q.id) ? 'Lösung aufgedeckt: Löst du die Frage jetzt, zählt sie ' + AUF_PCT + ' %. Löse sie später noch einmal ohne Lösung, dann zählt sie voll.' : 'Lösung aufgedeckt. Diese Frage hast du schon einmal voll gelöst, dein bester Wert bleibt.');
        } });
        bWeg.hidden = true;
        inn.appendChild(h('div', { class: 'pes-row' }, [bCheck, bTip, bWeg])); inn.appendChild(res); inn.appendChild(tip); inn.appendChild(weg);
        return d;
      }
      function build() { listHost.innerHTML = ''; QUIZ.forEach(q => listHost.appendChild(taskCard(q))); }
      heads(); build();
      return { oeffne };
    }

    /* ====================================================================================
       Mount: Reiter innerhalb der Ansicht
       ==================================================================================== */
    function mountEsd(elHost, ctx) {
      ensureCss();
      const fx = (k, x, y, t) => { try { if (ctx && ctx.fx) ctx.fx(k, x, y, t); } catch (e) { /* egal */ } };
      const TABS = [['grund', 'Grundlagen'], ['epa', 'EPA und Erdung'], ['vm', 'Verpacken und Messen'], ['quiz', 'Quiz']];
      let tab = lsGet('tab', 'grund'); if (!TABS.some(t => t[0] === tab)) tab = 'grund';
      const rootEl = h('div', { class: 'pes' }), tabsEl = h('div', { class: 'pes-tabs', role: 'tablist' }), body = h('div', { class: 'pes-body' }), wrap = h('div', { class: 'pes-wrap' });
      body.appendChild(wrap); rootEl.appendChild(tabsEl); rootEl.appendChild(body); elHost.innerHTML = ''; elHost.appendChild(rootEl);
      const env = { ctx, fx };
      let sicht = null;
      function tabs() { tabsEl.innerHTML = ''; TABS.forEach(t => tabsEl.appendChild(h('button', { type: 'button', class: 'pes-tab' + (tab === t[0] ? ' on' : ''), role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', 'data-pt': t[0], text: t[1], onclick: () => { tab = t[0]; lsSet('tab', tab); render(); } }))); }
      function render() {
        tabs(); wrap.innerHTML = ''; body.scrollTop = 0;
        try { const on = tabsEl.querySelector('.pes-tab.on'); if (on && tabsEl.scrollWidth > tabsEl.clientWidth) tabsEl.scrollLeft = Math.max(0, on.offsetLeft - 8); } catch (e) { /* egal */ }
        sicht = null;
        try { sicht = ({ grund: viewGrund, epa: viewEpa, vm: viewVM, quiz: viewQuiz })[tab](wrap, env) || null; }
        catch (e) { console.error('ESD:', e); wrap.innerHTML = ''; wrap.appendChild(h('div', { class: 'pes-note err', text: 'Dieser Reiter konnte nicht gestartet werden: ' + (e && e.message || e) })); }
      }
      render();
      /* zeigeFrage('eq3'): Reiter Quiz öffnen und die Frage aufklappen (Aufgabenliste des Labs, Aufruf ?aufgabe=eq3) */
      return { refresh() {}, onShow() {}, onResize() {}, destroy() { rootEl.remove(); }, zeigeFrage(id) { if (!quizById(id)) return false; if (tab !== 'quiz') { tab = 'quiz'; lsSet('tab', tab); render(); } return !!(sicht && sicht.oeffne && sicht.oeffne(id)); } };
    }
    quizUebernehmen((() => { try { return root.localStorage; } catch (e) { return { getItem() { return null; } }; } })());
    root.PCB_VIEWS.register('esd', { title: 'ESD', mount: mountEsd });
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') installUi();
})(typeof window !== 'undefined' ? window : globalThis);
