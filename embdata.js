/* embdata.js - Embedded vertieft: Metadaten, Erklaertexte (EMB_DATA) und Aufgabenregister (EMB_TASKS), ohne Browser lauffaehig.
 * EMB_META  = { id:'emb', name, stufe:'studium', ver, card, icon, blocks:[{id,title,icon,short}] }
 * EMB_DATA  = { blocks:[{ id, title, icon, lead, explain:[{h, p:[...]}] }] }
 * EMB_TASKS = { tasks:[...], byId(id), byBlock(id), check(task, answers) -> { rows:[{key,ok}], all, pct }, show(task,key) }
 *   Aufgabe: { id, block, title, level 1..3, text, table?, scene?, fields:[{key,label,unit,kind:'num'|'hex'|'str'|'choice',tol,exact,choices}],
 *              sol (Getter: Schluessel -> Wert, vom Kern gerechnet), steps (Getter: Rechenweg), hint (Getter: 3 Stufen) }
 *   Regel: Alle Ergebnisse und alle Zahlen im Rechenweg und in den Tipps kommen aus EMB_CORE. Nur Eingabewerte der Aufgabe stehen als Literale hier. */
(function (root) {
  'use strict';
  const K = () => root.EMB_CORE;
  const sg = (x, n) => K().sig(x, n || 4);
  const hx = (n, d) => K().hex(n, d);
  const fHz = f => f >= 1e6 ? sg(f / 1e6) + ' MHz' : f >= 1e3 ? sg(f / 1e3) + ' kHz' : sg(f) + ' Hz';

  const META = {
    id: 'emb', name: 'Embedded vertieft', stufe: 'studium', ver: '63.186',
    card: 'Timer, ADC, UART/SPI/I²C, Zustandsautomaten und Echtzeit: erst messen und simulieren, dann rechnen.',
    icon: 'Chip mit Zeitachse (Mikrocontroller-Gehäuse, darüber ein kleines Signaldiagramm)',
    blocks: [
      { id: 'timer', title: 'Interrupts und Timer', icon: '⏱', short: 'Timer' },
      { id: 'adc', title: 'ADC und Abtastung', icon: '〰', short: 'ADC' },
      { id: 'bus', title: 'Serielle Busse', icon: '⇄', short: 'Busse' },
      { id: 'fsm', title: 'Zustandsautomaten', icon: '◎', short: 'Automaten' },
      { id: 'mem', title: 'Speicher und Echtzeit', icon: '▤', short: 'Echtzeit' }
    ]
  };

  const EXPLAIN = {
    timer: {
      lead: 'Ein Timer ist ein Zähler, der vom Quarztakt angetrieben wird. Alles Zeitliche im Controller – Überlauf, Vergleich, PWM – ist Zählen und Vergleichen.',
      explain: [
        { h: 'Vorteiler und Überlauf', p: ['Der Systemtakt ist oft zu schnell. Ein Vorteiler lässt den Zähler nur bei jedem 8., 64., 256. … Takt weiterzählen. Ein Zählschritt dauert dann Vorteiler geteilt durch Taktfrequenz.', 'Ein n-Bit-Zähler hat 2^n Zustände. Nach dem größten Wert springt er auf 0 zurück: Das ist der Überlauf. Er kann einen Interrupt auslösen.'] },
        { h: 'CTC: genau auf den Takt', p: ['Im CTC-Modus (Clear Timer on Compare) stellt man ein Vergleichsregister OCR ein. Erreicht der Zähler diesen Wert, setzt er sich zurück und meldet sich. Die Periode hat OCR + 1 Schritte, weil die 0 mitzählt.', 'Nicht jede Wunschfrequenz lässt sich genau treffen. Man probiert alle Vorteiler durch und nimmt den mit dem kleinsten Fehler, bei Gleichstand den kleinsten Vorteiler (feinere Zeitauflösung).'] },
        { h: 'PWM: Tastverhältnis und Frequenz', p: ['Bei Fast-PWM zählt der Zähler von 0 bis TOP und beginnt neu. Der Ausgang ist High, solange der Zähler nicht über OCR liegt. Das Tastverhältnis ist (OCR + 1) / (TOP + 1).', 'Phasenkorrekt zählt der Zähler hoch und wieder herunter, die Periode ist doppelt so lang (2 · TOP Schritte), das Tastverhältnis ist OCR / TOP. Der Mittelwert der Spannung ist Tastverhältnis mal Versorgung.'] },
        { h: 'Interrupt-Ablauf, Latenz und Verlust', p: ['Ein Ereignis setzt ein Merkerbit. Der Controller beendet den laufenden Befehl, sichert die Rücksprungadresse (je nach Controller auch Register) und springt in die ISR; die ISR sichert selbst, was sie verändert. Bis dahin vergeht die Latenz. Gesperrte Abschnitte (cli … sei) verlängern sie.', 'Kommt ein weiteres Ereignis, solange das Merkerbit noch gesetzt ist, geht es verloren. Läuft die ISR länger als der Abstand der Ereignisse, ist die Last über 100 Prozent – die Hauptschleife bekommt keine Zeit mehr.'] },
        { h: 'Prellen', p: ['Ein mechanischer Taster schließt nicht sauber, sondern federt. Eine Flankeninterrupt-ISR wird dadurch mehrfach ausgelöst. Abhilfe: Sperrzeit länger als die Prellzeit oder Entprellen im Takt (siehe Zustandsautomaten). Eine Sperrzeit, die kürzer ist als die Prellzeit, hilft nur scheinbar.'] }
      ]
    },
    adc: {
      lead: 'Ein ADC macht aus einer Spannung eine ganze Zahl. Dabei geht Information verloren: durch die Stufung (Quantisierung) und durch das Zeitraster (Abtastung).',
      explain: [
        { h: 'Auflösung und LSB', p: ['Ein N-Bit-Wandler teilt den Bereich 0 bis Vref in 2^N gleich große Stufen. Eine Stufe heißt LSB und ist Vref / 2^N. Der Code ist die Nummer der Stufe, in der die Eingangsspannung liegt.', 'Rechnet man aus dem Code zurück, kennt man die Spannung nur bis auf eine Stufe: Sie liegt zwischen Code mal LSB und (Code + 1) mal LSB.'] },
        { h: 'Referenz und Messbereich', p: ['Der Code bezieht sich immer auf die Referenz. Stimmt die tatsächliche Referenz nicht mit der angenommenen überein, ist jede Messung um dasselbe Verhältnis falsch. Mit einer kleineren Referenz wird die Stufe feiner, der Messbereich aber kleiner. Spannungsteiler holen große Spannungen in den Bereich, kosten aber Auflösung.'] },
        { h: 'Quantisierungsfehler', p: ['Rundet der Wandler auf die nächste Stufe, ist der Fehler höchstens ein halbes LSB. Für einen voll ausgesteuerten Sinus gilt als Faustformel ein Signal-Rausch-Abstand von 6,02 · N + 1,76 dB. Jedes zusätzliche Bit bringt rund 6 dB.'] },
        { h: 'Abtastrate und Aliasing', p: ['Man darf höchstens Signale unterhalb der halben Abtastrate sauber erfassen (Nyquist). Alles darüber erscheint gespiegelt als Alias im Bereich bis fs/2, und man kann es hinterher nicht mehr vom echten Signal unterscheiden. Hilfe: Tiefpass vor dem Wandler.', 'Beim AVR braucht eine laufende Wandlung 13 ADC-Takte (die erste nach dem Einschalten 25); der ADC-Takt ist der Systemtakt durch den Vorteiler. Daraus folgt die maximale Abtastrate.'] },
        { h: 'Oversampling', p: ['Summiert man 4^k Messwerte und schiebt die Summe um k Bit nach rechts, gewinnt man k Bit Auflösung, vorausgesetzt, im Signal steckt etwas Rauschen (mindestens etwa ein LSB), das die Werte über die Stufen streut. Dafür sinkt die Ausgaberate um den Faktor 4^k.'] },
        { h: 'Wandlertypen: SAR und Sigma-Delta', p: ['Der SAR-Wandler (sukzessive Approximation) hält die Eingangsspannung fest und entscheidet dann Bit für Bit von oben nach unten: Bit versuchsweise setzen, vergleichen, behalten oder löschen. Jeder Schritt halbiert den Bereich. Eine Wandlung dauert die Abtastzeit plus einen Takt je Bit. SAR-Wandler sind schnell und stecken in den meisten Mikrocontrollern.', 'Der Sigma-Delta-Wandler tastet mit einem sehr schnellen, groben Modulator ab und mittelt danach in einem Digitalfilter. Das Überabtastverhältnis (OSR) sagt, wie viele Modulatorwerte in einen Ausgabewert eingehen: Datenrate = Modulatortakt / OSR. Viel OSR bringt viele Bits und wenig Rauschen, aber eine langsame Ausgabe. Typisch für Waagen, Temperatur und Audio.'] },
        { h: 'Offset, Verstärkung und Fehlerbudget', p: ['Ein Offsetfehler verschiebt die ganze Kennlinie um einen festen Betrag, ein Verstärkungsfehler ändert ihre Steigung. Beide lassen sich mit zwei genau bekannten Spannungen abgleichen: Aus den zwei Punkten folgt die Gerade U = m · Code + U0, und damit rechnest du jeden Code in die richtige Spannung um.', 'Ratiometrisch messen heißt: Sensor und Referenz hängen an derselben Spannung. Der Code ist das Verhältnis von Eingang zu Referenz, eine schwankende Versorgung kürzt sich heraus. Das passt für Potis und Messbrücken.', 'Im Fehlerbudget stehen alle Fehlerquellen einer Messkette nebeneinander: Referenz, Verstärkung, Offset, Quantisierung. Für den ungünstigsten Fall zählt man die Beträge einfach zusammen. Der größte Posten zeigt, wo eine Verbesserung lohnt. Mehr Bits helfen nicht, wenn die Referenz ungenau ist.'] }
      ]
    },
    bus: {
      lead: 'Drei Wege, Bytes seriell zu übertragen: UART braucht keinen Takt und eine Absprache, SPI hat eine Taktleitung und schnelle Vollduplex-Übertragung, I²C teilt zwei Leitungen unter vielen Teilnehmern.',
      explain: [
        { h: 'UART', p: ['Die Leitung ruht auf High. Ein Zeichen beginnt mit einem Startbit (Low), dann folgen die Datenbits mit dem niederwertigsten zuerst, optional ein Paritätsbit, dann ein oder zwei Stoppbits (High). Eine Bitzeit ist 1 / Baudrate.', 'Gerade Parität heißt: Die Zahl der Einsen in Daten plus Paritätsbit ist gerade. Ein einzelner gekippter Bit-Wert fällt auf, zwei gleichzeitig nicht. Ein Stoppbit auf Low meldet der Empfänger als Rahmenfehler.', 'Die Gegenstellen haben keinen gemeinsamen Takt. Der Empfänger tastet jedes Bit in der Mitte ab; die Uhren dürfen daher nur so weit auseinanderliegen, dass das letzte Bit noch in seiner Zeitspanne liegt.'] },
        { h: 'SPI', p: ['Vier Leitungen: SCK (Takt), MOSI (Master zu Slave), MISO (Slave zu Master), CS (wählt den Slave, aktiv Low). Beide Seiten schieben gleichzeitig ein Bit hinaus und eines hinein.', 'Der Modus besteht aus zwei Angaben: CPOL ist der Ruhepegel von SCK, CPHA sagt, ob bei der ersten oder der zweiten Flanke abgetastet wird. Modus 0: Ruhe Low, Abtasten steigend. Modus 1: Ruhe Low, Abtasten fallend. Modus 2: Ruhe High, Abtasten fallend. Modus 3: Ruhe High, Abtasten steigend. Merke: steigend, wenn CPOL gleich CPHA.'] },
        { h: 'I²C', p: ['Zwei Leitungen mit Pull-up-Widerständen (SDA, SCL), jeder Teilnehmer zieht sie nur nach Low. Start: SDA fällt, während SCL High ist. Stopp: SDA steigt, während SCL High ist. Sonst darf SDA nur wechseln, solange SCL Low ist.', 'Nach Start kommen sieben Adressbits und das Richtungsbit (0 = schreiben, 1 = lesen), dann zieht der Empfänger in einem neunten Takt SDA auf Low: ACK. Bleibt SDA High, ist es ein NACK: niemand hat geantwortet oder das Byte wurde nicht angenommen. Beim Lesen quittiert der Master jedes Byte mit ACK und das letzte absichtlich mit NACK, damit der Slave die Leitung freigibt.', 'Wie schnell die Leitung ansteigt, bestimmt der Pull-up: Die Anstiegszeit von 30 auf 70 Prozent ist rund 0,85 · R · C. Zu großer Widerstand: zu langsam. Zu kleiner: Der Ausgangstransistor schafft den Strom nicht.'] },
        { h: 'Logikanalysator lesen', p: ['Vorgehen: Erst die Ruhepegel und den Start finden, dann die Bitmitten oder Abtastflanken markieren, dann die Bits der Reihe nach aufschreiben. Ein Bitfehler zeigt sich beim Vergleich mit dem erwarteten Wert oder durch eine Prüfung (Parität, ACK).'] },
        { h: 'RS-232 und RS-485', p: ['RS-232 überträgt den UART-Rahmen mit anderen Pegeln: Eine negative Spannung (unter −3 V) ist logisch 1 und zugleich der Ruhepegel, eine positive (über +3 V) ist logisch 0. Das Startbit ist also positiv. Ein Pegelwandler setzt zwischen Controller und Leitung um. RS-232 verbindet genau zwei Geräte über kurze Strecken.', 'RS-485 nutzt zwei Adern A und B und wertet nur die Differenz aus. Liegt sie über +200 mV oder unter −200 mV, ist der Zustand eindeutig, dazwischen unbestimmt. Die Bezeichnungen A und B sind nicht einheitlich: Viele Datenblätter nennen A − B über +200 mV logisch 1, die Norm benennt die Adern umgekehrt. Störungen treffen beide Adern gleich und fallen aus der Differenz heraus. Darum sind lange Leitungen und viele Teilnehmer möglich.', 'Die Leitung wird an beiden Enden mit 120 Ω abgeschlossen, sonst gibt es Reflexionen. Zwischen A und B misst du bei abgeschalteter Anlage dann rund 60 Ω. Faustregel für die Länge: Bitrate mal Länge höchstens 10^8 (Bit/s mal m), nie mehr als 1200 m.', 'Ein 5-V-Ausgang darf nicht direkt an einen 3,3-V-Eingang. Für eine Richtung und mäßige Baudraten reicht ein Spannungsteiler. Prüfe dabei zwei Grenzen: die höchste Spannung, die der Eingang verträgt, und die Schwelle, ab der er High sicher erkennt.'] },
        { h: 'CAN', p: ['CAN arbeitet wie RS-485 mit zwei Adern (CAN-H und CAN-L) und 120 Ω an beiden Enden. Es gibt zwei Buszustände: dominant (logisch 0) und rezessiv (logisch 1). Sendet ein Knoten dominant, setzt er sich gegen alle rezessiven durch.', 'Arbitrierung: Jede Nachricht beginnt mit ihrem Identifier, höchstwertiges Bit zuerst. Jeder Sender liest den Bus mit. Wer eine 1 sendet und eine 0 liest, hört auf. So gewinnt der kleinste Identifier, und seine Nachricht bleibt unbeschädigt.', 'Bitstopfen: Nach fünf gleichen Bits fügt der Sender ein Bit mit dem anderen Wert ein, der Empfänger nimmt es wieder heraus. So bleiben genug Flanken zum Nachsynchronisieren. Das Stopfbit zählt für die nächste Folge mit.', 'Weil alle Knoten während der Arbitrierung dasselbe Bit sehen müssen, begrenzt die Signallaufzeit die Buslänge: Hin- und Rückweg müssen vor dem Abtastpunkt erledigt sein. Darum sind bei 1 MBit/s nur einige zehn Meter möglich, bei 125 kBit/s einige hundert.'] }
      ]
    },
    fsm: {
      lead: 'Ein Zustandsautomat merkt sich in einer kleinen Zahl von Zuständen, was bisher geschah. Aus Zustand und Eingang folgen der nächste Zustand und der Ausgang.',
      explain: [
        { h: 'Moore und Mealy', p: ['Beim Moore-Automaten hängt der Ausgang nur vom Zustand ab; er ändert sich also erst nach dem Takt. Beim Mealy-Automaten hängt er vom Zustand und vom aktuellen Eingang ab und kann sofort reagieren. Dafür braucht Mealy oft weniger Zustände.'] },
        { h: 'Tabelle und Diagramm', p: ['Die Zustandstabelle nennt für jeden Zustand und jeden Eingang den Folgezustand (und den Ausgang). Das Diagramm zeichnet dieselbe Information: Kreise für Zustände, Pfeile mit Beschriftung Eingang (bei Mealy: Eingang/Ausgang). Eine brauchbare Tabelle ist vollständig (keine Lücke) und alle Zustände sind erreichbar.', 'Für n Zustände braucht man mindestens ⌈log₂ n⌉ Flipflops zur Codierung.'] },
        { h: 'Sequenzdetektor', p: ['Ein Detektor meldet, wenn die letzten Eingangsbits ein Muster bilden. Der Zustand merkt sich, wie viel vom Muster gerade zutrifft. Bei überlappender Erkennung führt ein Treffer nicht zurück auf Null, sondern in den Zustand für den längsten Rand des Musters.'] },
        { h: 'Entprellen im Takt', p: ['Man tastet den Taster in festen Abständen ab und schaltet den entprellten Ausgang erst um, wenn N Proben in Folge vom bisherigen Wert abweichen. Das ist ein kleiner Automat mit Zählzuständen. Faustregel: N mal Abtastperiode größer als die Prellzeit. Der Ausgang folgt dann spätestens N Abtastperioden nach dem letzten Preller.'] },
        { h: 'Ampelsteuerung', p: ['Eine Ampel ist ein Automat, dessen Übergänge von einem Zeitgeber kommen. Die Zykluszeit ist die Summe aller Phasen. Sicherheit heißt: Es gibt keine Phase, in der beide Richtungen gleichzeitig nicht Rot haben. Dafür sorgt eine Alles-Rot-Phase zwischen den Richtungen.'] }
      ]
    },
    mem: {
      lead: 'Wenig RAM, Unterbrechungen zu jeder Zeit und feste Fristen: Hier entscheiden Speicherplan, Atomarität und Planung darüber, ob ein Gerät zuverlässig läuft.',
      explain: [
        { h: 'Speicherplan: Stack und Heap', p: ['Im RAM liegen von unten nach oben die initialisierten Variablen (.data), die Null-initialisierten (.bss) und der Heap, der beim Anfordern wächst. Der Stack liegt oben und wächst nach unten. Dazwischen liegt freier Platz. Berühren sich Heap und Stack, werden Daten still zerstört.', 'Jeder Funktionsaufruf legt einen Rahmen auf den Stack: Rücksprungadresse, gesicherte Register, lokale Variablen. Eine ISR legt zusätzlich ihren Rahmen oben drauf. Der Worst-Case ist Hauptprogramm-Kette plus verschachtelte ISRs.'] },
        { h: 'Heap-Fragmentierung', p: ['Gibt man Blöcke in anderer Reihenfolge frei, als man sie angefordert hat, entstehen Lücken. Es kann genug freier Platz da sein und trotzdem kein zusammenhängender Block für die nächste Anforderung. Benachbarte freie Blöcke verschmelzen wieder. Auf kleinen Controllern verzichtet man deshalb oft ganz auf dynamischen Speicher.'] },
        { h: 'volatile und Atomarität', p: ['volatile sagt dem Compiler: Der Wert kann sich ohne sein Zutun ändern – bei jedem Zugriff wirklich lesen. Ohne volatile darf er ein Flag einmal in ein Register laden, und die Schleife wartet dann ewig.', 'volatile macht aber nichts atomar. Ein 16-Bit-Wert wird auf einem 8-Bit-Controller in zwei Zugriffen gelesen. Schlägt eine ISR dazwischen zu, entsteht ein zerrissener Wert. Abhilfe: Interrupts kurz sperren (kritischer Abschnitt) oder den Wert doppelt lesen und vergleichen. Jeder kritische Abschnitt verlängert die Latenz.'] },
        { h: 'Prioritätsinversion', p: ['Eine Aufgabe mit niedriger Priorität hält eine Sperre. Eine hochpriore wird von ihr blockiert. Läuft nun eine mittlere Aufgabe, verdrängt sie die niedrige – und die hohe wartet, solange die mittlere rechnet. Das ist die Inversion. Prioritätsvererbung hebt die haltende Aufgabe vorübergehend auf die Priorität der wartenden, die mittlere kommt dann nicht dazwischen.'] },
        { h: 'Planbarkeit', p: ['Bei periodischen Aufgaben mit Frist gleich Periode vergibt man die Priorität nach Periode (kleinere Periode, höhere Priorität). Die Auslastung ist die Summe aus Rechenzeit durch Periode. Liegt sie unter der Schranke n · (2^(1/n) − 1), ist alles planbar. Darüber entscheidet die Antwortzeit-Analyse: R = C + Summe über höherpriore Aufgaben von ⌈R / T⌉ · C, iteriert bis zum Fixpunkt.'] }
      ]
    }
  };

  /* ---------------------------------------------------------------- Aufgaben-Werkzeuge ---------------------------------------------------------------- */
  const LIST = [], REG = [];
  const reg = fn => { REG.push(fn); };
  const N = (key, label, unit, o) => Object.assign({ key, label, unit: unit || '', kind: 'num' }, o || {});
  const NI = (key, label, unit, o) => N(key, label, unit, Object.assign({ exact: true }, o || {}));
  const S = (key, label, o) => Object.assign({ key, label, unit: '', kind: 'str' }, o || {});
  const HX = (key, label) => ({ key, label, unit: '', kind: 'hex' });
  const CH = (key, label, choices) => ({ key, label, unit: '', kind: 'choice', choices });
  const JN = [{ v: 'ja', t: 'ja' }, { v: 'nein', t: 'nein' }];
  const memo = (o, key, fn) => { let v, done = false; Object.defineProperty(o, key, { enumerable: true, configurable: true, get() { if (!done) { v = fn(); done = true; } return v; } }); };

  function build() {
    if (LIST.length) return;
    REG.forEach(fn => {
      const d = fn(), t = { id: d.id, block: d.block, title: d.title, level: d.level, text: d.text, fields: d.fields };
      if (d.table) t.table = d.table;
      if (d.scene) t.scene = d.scene;
      memo(t, 'sol', d.sol);
      memo(t, 'steps', () => d.steps(t.sol));
      memo(t, 'hint', () => d.hint(t.sol));
      LIST.push(t);
    });
  }

  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[\s,;]/g, '').replace(/[“”"'‚]/g, '').replace(/–|−/g, '-');
  function checkField(f, sol, given) {
    const e = sol[f.key], C = K();
    if (f.kind === 'num') {
      const x = C.parseNum(given);
      if (!isFinite(x)) return false;
      if (f.exact) return Math.abs(x - e) < 1e-9;
      const tol = f.tol != null ? f.tol : 0.01, a = f.abs || 0;
      return Math.abs(x - e) <= Math.max(tol * Math.abs(e), a, e === 0 ? 1e-9 : 0);
    }
    if (f.kind === 'hex') { const x = C.parseHex(given); return isFinite(x) && x === e; }
    if (f.kind === 'choice') return given === e;
    return norm(given) === norm(e);
  }
  function check(task, answers) {
    const rows = task.fields.map(f => ({ key: f.key, ok: checkField(f, task.sol, answers[f.key]), given: answers[f.key] }));
    const okn = rows.filter(r => r.ok).length;
    return { rows, all: okn === rows.length, pct: Math.round(100 * okn / Math.max(rows.length, 1)) };
  }
  function show(task, key) {
    const f = task.fields.find(x => x.key === key), v = task.sol[key];
    if (f.kind === 'num') return (f.exact ? String(v) : sg(v, f.dig || 4)) + (f.unit ? ' ' + f.unit : '');
    if (f.kind === 'hex') return hx(v, v > 255 ? 4 : 2);
    if (f.kind === 'choice') { const c = f.choices.find(x => x.v === v); return c ? c.t : String(v); }
    return String(v);
  }

  /* =========================================================  Block 1: Interrupts und Timer  ========================================================= */
  reg(() => { const f = 16e6, ps = 64, bits = 8;
    return { id: 't1', block: 'timer', title: 'Überlaufzeit eines 8-Bit-Timers', level: 1,
      text: `Ein 8-Bit-Timer zählt mit dem Systemtakt ${fHz(f)} über den Vorteiler ${ps}. Wie lange dauert ein Zählschritt, und nach welcher Zeit läuft der Timer über (255 → 0)?`,
      fields: [N('tick', 'Dauer eines Zählschritts', 'µs'), N('ovf', 'Überlaufzeit', 'ms')],
      sol: () => ({ tick: K().timerTick(f, ps) * 1e6, ovf: K().timerOverflow(f, ps, bits) * 1e3 }),
      steps: s => [`Zählschritt = Vorteiler / f_CPU = ${ps} / ${fHz(f)} = ${sg(s.tick)} µs`, `Ein ${bits}-Bit-Zähler hat 2^${bits} = ${Math.pow(2, bits)} Zustände.`, `Überlauf nach ${Math.pow(2, bits)} · ${sg(s.tick)} µs = ${sg(s.ovf)} ms`],
      hint: s => ['Der Timer zählt nicht mit dem vollen Takt, sondern mit f_CPU geteilt durch den Vorteiler. Erst die Dauer eines Schritts, dann alle Zustände.', `Schritt = ${ps} / ${fHz(f)}. Anzahl der Zustände bei ${bits} Bit: ${Math.pow(2, bits)}.`, `Ein Schritt dauert ${sg(s.tick)} µs. Das mal ${Math.pow(2, bits)} nehmen.`] }; });
  reg(() => { const f = 8e6, ps = 256, bits = 16;
    return { id: 't2', block: 'timer', title: 'Langsamer Takt, 16-Bit-Zähler', level: 1,
      text: `Ein 16-Bit-Timer läuft mit ${fHz(f)} und dem Vorteiler ${ps}. Bestimme die Dauer eines Zählschritts und die Zeit bis zum Überlauf.`,
      fields: [N('tick', 'Dauer eines Zählschritts', 'µs'), N('ovf', 'Überlaufzeit', 's')],
      sol: () => ({ tick: K().timerTick(f, ps) * 1e6, ovf: K().timerOverflow(f, ps, bits) }),
      steps: s => [`Zählschritt = ${ps} / ${fHz(f)} = ${sg(s.tick)} µs`, `Zustände: 2^${bits} = ${Math.pow(2, bits)}`, `Überlauf nach ${Math.pow(2, bits)} · ${sg(s.tick)} µs = ${sg(s.ovf, 6)} s`],
      hint: s => ['Gleicher Rechenweg wie beim 8-Bit-Timer, nur mit mehr Zuständen.', `Zählschritt in µs, dann mal 2^${bits}. Umrechnung µs nach s am Schluss.`, `Schritt: ${sg(s.tick)} µs. Überlauf: das mal ${Math.pow(2, bits)}, ergibt etwa ${sg(s.ovf, 4)} s.`] }; });
  reg(() => { const f = 16e6, fT = 1000, bits = 8;
    return { id: 't3', block: 'timer', title: 'CTC: 1 kHz mit dem 8-Bit-Timer', level: 2,
      text: `Ein 8-Bit-Timer (OCR 0 bis 255) soll im CTC-Modus bei ${fHz(f)} genau alle 1 ms einen Interrupt auslösen (${fHz(fT)}). Wähle den Vorteiler aus 1, 8, 64, 256, 1024 und bestimme OCR.`,
      fields: [NI('ps', 'Vorteiler', ''), NI('ocr', 'OCR-Wert', '')],
      sol: () => { const b = K().ctcSearch(f, fT, bits).best; return { ps: b.ps, ocr: b.ocr }; },
      steps: s => { const r = K().ctcSearch(f, fT, bits).rows; return [`Bedingung: f_CPU / (Vorteiler · (OCR + 1)) = ${fHz(fT)}, also OCR + 1 = f_CPU / (Vorteiler · f).`].concat(r.map(x => `Vorteiler ${x.ps}: OCR + 1 = ${sg(x.exact + 1, 6)} → OCR = ${x.ocr}${x.fits ? (Math.abs(x.errPct) < 1e-9 ? ' (passt, exakt)' : ' (passt, Fehler ' + sg(x.errPct, 3) + ' %)') : ' (zu groß oder zu klein für 8 Bit)'}`)).concat([`Einziger exakter Treffer: Vorteiler ${s.ps}, OCR = ${s.ocr}.`]); },
      hint: s => ['Die Periode hat OCR + 1 Schritte. Rechne für jeden Vorteiler aus, wie viele Schritte 1 ms sind.', `Schritte pro Millisekunde = f_CPU / (Vorteiler · ${fT}). Das muss eine ganze Zahl zwischen 1 und 256 sein.`, `Vorteiler ${s.ps} liefert ${s.ocr + 1} Schritte; OCR ist um 1 kleiner.`] }; });
  reg(() => { const f = 16e6, ps = 8, fT = 50;
    return { id: 't4', block: 'timer', title: 'CTC: 50 Hz mit 16 Bit', level: 2,
      text: `Ein 16-Bit-Timer soll bei ${fHz(f)} und Vorteiler ${ps} einen Interrupt mit ${fT} Hz erzeugen (zum Beispiel für einen Servo-Zyklus von 20 ms). Berechne OCR1A und die Dauer eines Zählschritts.`,
      fields: [NI('ocr', 'OCR1A', ''), N('tick', 'Dauer eines Zählschritts', 'µs')],
      sol: () => ({ ocr: K().ctcOcr(f, ps, fT).ocr, tick: K().timerTick(f, ps) * 1e6 }),
      steps: s => [`Zählschritt = ${ps} / ${fHz(f)} = ${sg(s.tick)} µs`, `Periode = 1 / ${fT} Hz = ${sg(1 / fT * 1e3)} ms`, `Schritte = ${sg(1 / fT * 1e6)} µs / ${sg(s.tick)} µs = ${s.ocr + 1}`, `OCR1A = ${s.ocr + 1} − 1 = ${s.ocr}  (passt in 16 Bit, Höchstwert 65535)`],
      hint: s => ['Wie viele Zählschritte passen in eine Periode? Davon eins abziehen.', `Ein Schritt dauert ${sg(s.tick)} µs, die Periode 20 000 µs.`, `Schritte = ${s.ocr + 1}. OCR1A = Schritte − 1.`] }; });
  reg(() => { const f = 16e6, ps = 256, fT = 3000;
    return { id: 't5', block: 'timer', title: 'CTC: Wunschfrequenz trifft nicht genau', level: 2,
      text: `Bei ${fHz(f)} und Vorteiler ${ps} soll ein 8-Bit-Timer im CTC-Modus ${fHz(fT)} erzeugen. OCR muss eine ganze Zahl sein. Welcher OCR-Wert ist am nächsten, welche Frequenz entsteht tatsächlich, und wie groß ist der Fehler in Prozent (tatsächlich minus Wunsch, bezogen auf den Wunsch, mit Vorzeichen)?`,
      fields: [NI('ocr', 'OCR', ''), N('fact', 'tatsächliche Frequenz', 'Hz'), N('err', 'Fehler (mit Vorzeichen)', '%', { tol: 0.02 })],
      sol: () => { const r = K().ctcOcr(f, ps, fT); return { ocr: r.ocr, fact: r.fAct, err: r.errPct }; },
      steps: s => [`OCR + 1 = f_CPU / (Vorteiler · f) = ${sg(K().ctcOcr(f, ps, fT).exact + 1, 6)}`, `Gerundet: OCR + 1 = ${s.ocr + 1}, also OCR = ${s.ocr}`, `f_tatsächlich = ${fHz(f)} / (${ps} · ${s.ocr + 1}) = ${sg(s.fact, 6)} Hz`, `Fehler = (${sg(s.fact, 6)} − ${fT}) / ${fT} = ${sg(s.err, 3)} %`],
      hint: s => ['Erst die „krumme“ Zahl OCR + 1 ausrechnen, dann auf eine ganze Zahl runden.', `OCR + 1 = ${sg(K().ctcOcr(f, ps, fT).exact + 1, 5)}`, `Gerundet ${s.ocr + 1}. Damit die Frequenz neu berechnen und mit dem Wunsch vergleichen.`] }; });
  reg(() => { const f = 16e6, ps = 64, top = 255, ocr = 64, vcc = 5;
    return { id: 't6', block: 'timer', title: 'Fast-PWM: Frequenz und Mittelwert', level: 2,
      text: `Ein 8-Bit-Timer läuft im Fast-PWM-Modus (TOP = ${top}, nicht invertierend, High solange Zähler ≤ OCR) bei ${fHz(f)} und Vorteiler ${ps}. OCR = ${ocr}, Versorgung ${vcc} V. Berechne PWM-Frequenz, Tastverhältnis und die mittlere Ausgangsspannung.`,
      fields: [N('f', 'PWM-Frequenz', 'Hz'), N('duty', 'Tastverhältnis', '%'), N('vavg', 'Mittelwert', 'V')],
      sol: () => { const r = K().pwmFast(f, ps, top, ocr); return { f: r.freq, duty: r.duty * 100, vavg: r.duty * vcc }; },
      steps: s => [`Periode = ${top + 1} Schritte · ${ps} / ${fHz(f)}; f = ${fHz(f)} / (${ps} · ${top + 1}) = ${sg(s.f, 6)} Hz`, `High-Schritte = OCR + 1 = ${ocr + 1} von ${top + 1}`, `Tastverhältnis = ${ocr + 1} / ${top + 1} = ${sg(s.duty, 5)} %`, `Mittelwert = ${sg(s.duty, 5)} % · ${vcc} V = ${sg(s.vavg, 4)} V`],
      hint: s => ['Die Periode hat TOP + 1 Schritte, der Ausgang ist (OCR + 1) davon High.', `f = f_CPU / (Vorteiler · ${top + 1}); Tastverhältnis = ${ocr + 1} / ${top + 1}.`, `Tastverhältnis ≈ ${sg(s.duty, 4)} %. Mal Versorgung ergibt den Mittelwert.`] }; });
  reg(() => { const f = 16e6, ps = 64, top = 255, ocr = 191, d2 = 0.4;
    return { id: 't7', block: 'timer', title: 'Phasenkorrekte PWM', level: 3,
      text: `Phasenkorrekte PWM, TOP = ${top}, ${fHz(f)}, Vorteiler ${ps}. Der Zähler läuft von 0 bis TOP und wieder zurück. OCR = ${ocr}. Berechne Frequenz und Tastverhältnis. Welcher OCR-Wert ergibt etwa ${d2 * 100} % Tastverhältnis (ganzzahlig gerundet)?`,
      fields: [N('f', 'PWM-Frequenz', 'Hz'), N('duty', 'Tastverhältnis', '%'), NI('ocr2', 'OCR für 40 %', '')],
      sol: () => { const r = K().pwmPhase(f, ps, top, ocr); return { f: r.freq, duty: r.duty * 100, ocr2: K().pwmOcrPhase(d2, top) }; },
      steps: s => [`Periode = 2 · TOP = ${2 * top} Schritte (hoch und wieder herunter)`, `f = ${fHz(f)} / (${ps} · ${2 * top}) = ${sg(s.f, 6)} Hz`, `Tastverhältnis = OCR / TOP = ${ocr} / ${top} = ${sg(s.duty, 5)} %`, `OCR für ${d2 * 100} % = ${sg(d2)} · ${top} = ${sg(d2 * top, 6)} → ${s.ocr2}`],
      hint: s => ['Der Zähler braucht für einen Durchlauf 0 → TOP → 0 doppelt so viele Schritte wie bei Fast-PWM.', `Periode = 2 · ${top} = ${2 * top} Schritte. Tastverhältnis = OCR / ${top}.`, `Frequenz ≈ ${sg(s.f, 5)} Hz; OCR für 40 % = 0,4 · ${top}.`] }; });
  reg(() => { const per = 500, ex = 120;
    return { id: 't8', block: 'timer', title: 'Last durch eine ISR', level: 1,
      text: `Ein Ereignis kommt alle ${per} µs. Die zugehörige ISR braucht ${ex} µs. Wie hoch ist die CPU-Last durch die ISR in Prozent, wie viel Zeit bleibt der Hauptschleife, und bei welcher Ereignisfrequenz wäre die ISR allein zu 100 % ausgelastet?`,
      fields: [N('load', 'Last durch die ISR', '%'), N('free', 'Anteil für die Hauptschleife', '%'), N('fmax', 'Frequenz bei 100 % Last', 'Hz')],
      sol: () => ({ load: K().isrLoad(ex, per) * 100, free: 100 - K().isrLoad(ex, per) * 100, fmax: 1e6 / ex }),
      steps: s => [`Last = ISR-Dauer / Periode = ${ex} µs / ${per} µs = ${sg(s.load)} %`, `Rest = 100 % − ${sg(s.load)} % = ${sg(s.free)} %`, `100 % Last: Periode = ISR-Dauer = ${ex} µs, also f = 1 / ${ex} µs = ${sg(s.fmax, 5)} Hz`],
      hint: s => ['Last ist der Anteil der Zeit, in der die ISR läuft.', `${ex} µs von ${per} µs.`, `Last ${sg(s.load)} %. Für die Grenzfrequenz muss die Periode so kurz wie die ISR sein.`] }; });
  reg(() => { const mi = 4, en = 4, cr = 40, f = 16e6, cr2 = 10;
    return { id: 't9', block: 'timer', title: 'Interrupt-Latenz im ungünstigsten Fall', level: 2,
      text: `Bei ${fHz(f)} gilt (vereinfachtes Modell): längster Einzelbefehl ${mi} Takte, längster kritischer Abschnitt (cli … sei) ${cr} Takte, Einsprung in die ISR ${en} Takte. Wie lang ist die Latenz im ungünstigsten Fall in Takten und in µs? Wie viele Takte sind es, wenn man den kritischen Abschnitt auf ${cr2} Takte verkürzt?`,
      fields: [NI('cyc', 'Latenz', 'Takte'), N('us', 'Latenz', 'µs'), NI('cyc2', 'Latenz mit kürzerem Abschnitt', 'Takte')],
      sol: () => { const r = K().irqLatency(mi, en, cr, f); return { cyc: r.cycles, us: r.us, cyc2: K().irqLatency(mi, en, cr2, f).cycles }; },
      steps: s => [`Schlimmster Fall: Das Ereignis kommt gleich zu Beginn des gesperrten Abschnitts. Gewartet wird auf das Maximum aus Befehl (${mi}) und Abschnitt (${cr}) = ${Math.max(mi, cr)} Takte.`, `Dazu der Einsprung: ${Math.max(mi, cr)} + ${en} = ${s.cyc} Takte`, `Zeit = ${s.cyc} / ${fHz(f)} = ${sg(s.us)} µs`, `Mit ${cr2} Takten Abschnitt: ${Math.max(mi, cr2)} + ${en} = ${s.cyc2} Takte`, `Hinweis: Beim AVR wird nach sei noch ein Befehl ausgeführt, bevor der Interrupt angenommen wird. Im ungünstigsten Fall wären es also Abschnitt + ein Befehl + Einsprung = ${cr} + ${mi} + ${en} = ${cr + mi + en} Takte (das Modell oben ist vereinfacht).`],
      hint: s => ['Es zählt, was am längsten dauert: ein einzelner Befehl oder der gesperrte Abschnitt. Dann kommt der Einsprung dazu.', `Maximum von ${mi} und ${cr} Takten, plus ${en}.`, `${s.cyc} Takte, geteilt durch ${fHz(f)}.`] }; });
  reg(() => { const ev = [0, 300, 350, 900, 1000, 1100, 1900, 2500, 2600], ex = 400, lat = 10, tEnd = 3500;
    return { id: 't10', block: 'timer', title: 'Zeitachse: verlorene Interrupts', level: 3,
      text: `Das Diagramm zeigt neun Ereignisse (Zeiten in µs). Die ISR braucht ${ex} µs, die Latenz beträgt ${lat} µs. Ein Ereignis, das ankommt, während das Merkerbit noch gesetzt ist (die ISR hat noch nicht begonnen), geht verloren. Kommt es dagegen, während die ISR läuft, wird es nach deren Ende nachgeholt. Wie viele ISR-Aufrufe gibt es, wie viele Ereignisse gehen verloren, und was ist die größte Verzögerung zwischen Ereignis und ISR-Start?`,
      scene: { type: 'isr', events: ev, exec: ex, latency: lat, tEnd },
      fields: [NI('calls', 'ISR-Aufrufe', ''), NI('lost', 'verlorene Ereignisse', ''), N('maxLat', 'größte Verzögerung', 'µs', { tol: 0 }), N('load', 'ISR-Last bis 3500 µs', '%')],
      sol: () => { const r = K().isrSim({ events: ev, exec: ex, latency: lat, tEnd }); return { calls: r.calls.length, lost: r.lost.length, maxLat: r.maxLat, load: r.load * 100 }; },
      steps: s => { const r = K().isrSim({ events: ev, exec: ex, latency: lat, tEnd }); return r.calls.map(c => `Ereignis bei ${c.te} µs → ISR von ${c.start} bis ${c.end} µs (Verzögerung ${c.lat} µs)`).concat(r.lost.map(i => `Ereignis bei ${r.events[i]} µs: Merkerbit schon gesetzt → verloren`)).concat([`Ergebnis: ${s.calls} Aufrufe, ${s.lost} verloren, größte Verzögerung ${s.maxLat} µs, Last = ${s.calls} · ${ex} µs / ${tEnd} µs = ${sg(s.load)} %`]); },
      hint: s => ['Gehe die Ereignisse der Reihe nach durch: Wann kann die ISR frühestens starten (Ereignis + Latenz, aber nicht vor dem Ende der letzten ISR)?', 'Ein Ereignis geht nur verloren, wenn das vorige noch auf seinen Start wartet, also zwischen dessen Ereignis und dessen ISR-Start liegt.', `Es sind ${s.calls} Aufrufe und ${s.lost} Verluste. Die größte Verzögerung tritt auf, wenn ein Ereignis auf das Ende der vorigen ISR wartet.`] }; });
  reg(() => { const times = [0, 400, 900, 1300, 1600, 2800, 3000], edges = times.map((t, i) => ({ t, lvl: i % 2 === 0 ? 0 : 1 }));
    return { id: 't11', block: 'timer', title: 'Prellen: wie oft löst die ISR aus?', level: 3,
      text: 'Ein Taster wird gedrückt; der Pegel springt von High nach Low und prellt (Zeiten in µs, siehe Diagramm). Der Interrupt-Pin ist einmal auf „fallende Flanke“, einmal auf „jede Änderung“ eingestellt. Zusätzlich sperrt eine Software nach einer angenommenen Flanke die weiteren für 2000 µs beziehungsweise für 5000 µs. Wie viele ISR-Aufrufe entstehen bei „fallende Flanke“, wie viele bei „jede Änderung“ (beide ohne Sperre)? Und wie viele bei „fallende Flanke“ mit 2000 µs beziehungsweise 5000 µs Sperre?',
      scene: { type: 'bounce', edges },
      fields: [NI('nFall', 'nur fallende Flanke', ''), NI('nChange', 'jede Änderung', ''), NI('n2', 'fallend mit 2000 µs Sperre', ''), NI('n5', 'fallend mit 5000 µs Sperre', '')],
      sol: () => ({ nFall: K().edgeCount(edges, 'fall'), nChange: K().edgeCount(edges, 'change'), n2: K().lockoutCount(edges, 'fall', 2000), n5: K().lockoutCount(edges, 'fall', 5000) }),
      steps: s => [`Fallende Flanken (Pegel wechselt auf Low): bei ${edges.filter(e => e.lvl === 0).map(e => e.t).join(', ')} µs → ${s.nFall}`, `Alle Wechsel: ${s.nChange}`, `Mit 2000 µs Sperre: Angenommen wird die erste Flanke bei 0 µs und jede weitere fallende Flanke, die mindestens 2000 µs nach der letzten angenommenen liegt → ${s.n2}. Die Sperre ist kürzer als die Prellzeit (${edges[edges.length - 1].t} µs), das Prellen rutscht also durch.`, `Mit 5000 µs Sperre: nur die erste Flanke → ${s.n5}`],
      hint: s => ['Zähle erst alle fallenden Flanken, dann alle Wechsel. Danach die Sperrzeit anwenden: Eine Flanke zählt nur, wenn seit der letzten angenommenen genug Zeit vergangen ist.', 'Die Sperrzeit läuft ab der zuletzt angenommenen Flanke, nicht ab der letzten Flanke überhaupt.', `Ohne Sperre ${s.nFall} / ${s.nChange}. Mit 2 ms rutscht die letzte Prellflanke noch durch.`] }; });

  /* =========================================================  Block 2: ADC  ========================================================= */
  reg(() => { const vref = 5, bits = 10;
    return { id: 'a1', block: 'adc', title: 'LSB und Zahl der Stufen', level: 1,
      text: `Ein ${bits}-Bit-ADC hat die Referenz ${vref} V. Wie viele Codes gibt es, und wie groß ist ein LSB in Millivolt?`,
      fields: [NI('levels', 'Anzahl der Codes', ''), N('lsb', 'LSB', 'mV')],
      sol: () => ({ levels: Math.pow(2, bits), lsb: K().adcLsb(vref, bits) * 1e3 }),
      steps: s => [`Codes = 2^${bits} = ${s.levels}`, `LSB = Vref / 2^N = ${vref} V / ${s.levels} = ${sg(s.lsb, 5)} mV`],
      hint: s => ['Die Zahl der Stufen ist 2 hoch Bitzahl. Der Bereich wird in so viele gleiche Stücke geteilt.', `2^${bits} = ${s.levels}. Teile ${vref} V durch diese Zahl.`, `Ergebnis in mV: ${sg(s.lsb, 4)}.`] }; });
  reg(() => { const v = 3.3, vref = 5, bits = 10;
    return { id: 'a2', block: 'adc', title: 'Spannung zu Code und zurück', level: 1,
      text: `Am Eingang eines ${bits}-Bit-ADC (Referenz ${vref} V, der Wandler schneidet ab) liegen ${sg(v)} V. Welchen Code liefert er? Welche Spannung ergibt die Rückrechnung (Code · LSB), und wie groß ist die Abweichung in mV?`,
      fields: [NI('code', 'Code', ''), N('vback', 'Rückgerechnete Spannung', 'V'), N('err', 'Abweichung zur echten Spannung', 'mV')],
      sol: () => { const q = K().adcQuant(v, vref, bits); return { code: q.code, vback: q.vq, err: q.err * 1e3 }; },
      steps: s => [`Code = ⌊U / Vref · 2^N⌋ = ⌊${sg(v)} / ${vref} · ${Math.pow(2, bits)}⌋ = ⌊${sg(v / vref * Math.pow(2, bits), 6)}⌋ = ${s.code}`, `Rückrechnung = ${s.code} · ${sg(K().adcLsb(vref, bits) * 1e3, 5)} mV = ${sg(s.vback, 5)} V`, `Abweichung = ${sg(v, 4)} V − ${sg(s.vback, 5)} V = ${sg(s.err, 3)} mV (kleiner als 1 LSB)`],
      hint: s => ['Teile die Eingangsspannung durch die Referenz, multipliziere mit der Zahl der Stufen, schneide die Nachkommastellen ab.', `${sg(v)} / ${vref} · ${Math.pow(2, bits)} = ${sg(v / vref * Math.pow(2, bits), 5)}`, `Code ${s.code}. Zurück: Code mal LSB.`] }; });
  reg(() => { const code = 700, vref = 1.1, bits = 10;
    return { id: 'a3', block: 'adc', title: 'Code zu Spannungsbereich', level: 1,
      text: `Ein ${bits}-Bit-ADC mit Referenz ${sg(vref)} V liefert den Code ${code}. In welchem Spannungsbereich lag die Eingangsspannung? Gib die untere und die obere Grenze in Millivolt an.`,
      fields: [N('lo', 'untere Grenze', 'mV', { tol: 0, abs: 0.1, dig: 5 }), N('hi', 'obere Grenze', 'mV', { tol: 0, abs: 0.1, dig: 5 })],
      sol: () => ({ lo: K().adcVolt(code, vref, bits) * 1e3, hi: K().adcVolt(code + 1, vref, bits) * 1e3 }),
      steps: s => [`LSB = ${sg(vref)} V / ${Math.pow(2, bits)} = ${sg(K().adcLsb(vref, bits) * 1e3, 5)} mV`, `untere Grenze = ${code} · LSB = ${sg(s.lo, 5)} mV`, `obere Grenze = ${code + 1} · LSB = ${sg(s.hi, 5)} mV (die beiden Werte liegen nur ein LSB auseinander, vertauschen gilt nicht)`],
      hint: s => ['Ein Code steht für eine ganze Stufe, nicht für einen Punkt.', 'Untere Grenze: Code mal LSB. Obere Grenze: (Code + 1) mal LSB.', `LSB ≈ ${sg(K().adcLsb(vref, bits) * 1e3, 4)} mV.`] }; });
  reg(() => { const vref = 1.1, bits = 10, sens = 0.01, code = 237;
    return { id: 'a4', block: 'adc', title: 'Temperatursensor am ADC', level: 2,
      text: `Ein Temperatursensor liefert 10 mV pro Kelvin (0 V bei 0 °C). Er hängt an einem ${bits}-Bit-ADC mit der internen Referenz ${sg(vref)} V. Welche Temperaturauflösung hat ein LSB, und welche Temperatur gehört zum Code ${code}?`,
      fields: [N('res', 'Auflösung', 'K pro LSB'), N('temp', 'Temperatur', '°C')],
      sol: () => ({ res: K().adcLsb(vref, bits) / sens, temp: K().adcVolt(code, vref, bits) / sens }),
      steps: s => [`LSB = ${sg(vref)} V / ${Math.pow(2, bits)} = ${sg(K().adcLsb(vref, bits) * 1e3, 5)} mV`, `Auflösung = LSB / Empfindlichkeit = ${sg(K().adcLsb(vref, bits) * 1e3, 5)} mV / 10 mV/K = ${sg(s.res, 4)} K`, `Spannung = ${code} · LSB = ${sg(K().adcVolt(code, vref, bits), 5)} V`, `Temperatur = ${sg(K().adcVolt(code, vref, bits), 5)} V / 0,01 V/K = ${sg(s.temp, 4)} °C`],
      hint: s => ['Erst den Code in eine Spannung umrechnen, dann die Spannung in eine Temperatur.', 'Auflösung: wie viele Kelvin entsprechen einem LSB? LSB geteilt durch 10 mV/K.', `Ein LSB entspricht ${sg(s.res, 3)} K.`] }; });
  reg(() => { const vin = 24, r1 = 47000, r2 = 10000, vref = 5, bits = 10;
    return { id: 'a5', block: 'adc', title: 'Spannungsteiler vor dem ADC', level: 2,
      text: `Eine Spannung bis ${vin} V soll mit einem ${bits}-Bit-ADC (Referenz ${vref} V) gemessen werden, davor ein Teiler mit R1 = 47 kΩ und R2 = 10 kΩ (R2 liegt an Masse). Bei ${vin} V: Welche Spannung sieht der ADC, welchen Code liefert er, und welcher Spannungsschritt am Eingang des Teilers entspricht einem LSB?`,
      fields: [N('vadc', 'Spannung am ADC', 'V'), NI('code', 'Code', ''), N('res', 'Schritt je LSB am Teilereingang', 'mV')],
      sol: () => ({ vadc: K().dividerOut(vin, r1, r2), code: K().adcCode(K().dividerOut(vin, r1, r2), vref, bits), res: K().adcLsb(vref, bits) * (r1 + r2) / r2 * 1e3 }),
      steps: s => [`Teilerverhältnis = R2 / (R1 + R2) = 10 / 57`, `U_ADC = ${vin} V · 10 / 57 = ${sg(s.vadc, 5)} V`, `Code = ⌊${sg(s.vadc, 5)} / ${vref} · ${Math.pow(2, bits)}⌋ = ${s.code}`, `LSB am ADC = ${sg(K().adcLsb(vref, bits) * 1e3, 5)} mV; am Teilereingang mal 57/10 = ${sg(s.res, 4)} mV`],
      hint: s => ['Der Teiler verkleinert die Spannung. Rechne erst die Spannung am ADC, dann den Code.', 'U_ADC = U · R2 / (R1 + R2).', `Spannung am ADC ≈ ${sg(s.vadc, 4)} V. Ein LSB am ADC mal den Teilerfaktor ergibt den Schritt am Eingang.`] }; });
  reg(() => { const vref = 3.3, bits = 12;
    return { id: 'a6', block: 'adc', title: 'Quantisierungsfehler und SQNR', level: 2,
      text: `Ein ${bits}-Bit-ADC mit Referenz ${sg(vref)} V rundet auf den nächsten Code. Wie groß ist ein LSB, wie groß ist der größte Quantisierungsfehler (± ½ LSB), und welchen Signal-Rausch-Abstand (SQNR) hat er für einen voll ausgesteuerten Sinus nach der Faustformel 6,02 · N + 1,76 dB?`,
      fields: [N('lsb', 'LSB', 'mV'), N('emax', 'größter Fehler (Betrag)', 'mV'), N('sqnr', 'SQNR', 'dB', { tol: 0.005 })],
      sol: () => { const l = K().adcLsb(vref, bits) * 1e3; return { lsb: l, emax: l / 2, sqnr: K().sqnrDb(bits) }; },
      steps: s => [`LSB = ${sg(vref)} V / ${Math.pow(2, bits)} = ${sg(s.lsb, 5)} mV`, `Fehler ≤ ½ LSB = ${sg(s.emax, 5)} mV`, `SQNR = 6,02 · ${bits} + 1,76 = ${sg(s.sqnr, 5)} dB`],
      hint: s => ['Beim Runden liegt der Wert höchstens eine halbe Stufe daneben.', 'LSB = Vref / 2^N. SQNR: Zahlen in die Faustformel einsetzen.', `LSB ${sg(s.lsb, 4)} mV; SQNR knapp über 74 dB.`] }; });
  reg(() => ({ id: 'a7', block: 'adc', title: 'Aliasing', level: 2,
    text: 'Ein Signal mit 1000 Hz wird mit 1500 Hz abgetastet. Ein zweites mit 7000 Hz mit 5000 Hz. Bei welcher Frequenz erscheint jeweils das Signal in den Messwerten (Alias, immer zwischen 0 und fs/2)?',
    fields: [N('fa1', 'Alias von 1000 Hz bei fs = 1500 Hz', 'Hz'), N('fa2', 'Alias von 7000 Hz bei fs = 5000 Hz', 'Hz')],
    sol: () => ({ fa1: K().aliasFreq(1000, 1500), fa2: K().aliasFreq(7000, 5000) }),
    steps: s => [`Alias = Abstand zum nächsten Vielfachen von fs: |f − k · fs|`, `1000 Hz: nächstes Vielfaches von 1500 Hz ist 1500 Hz → |1000 − 1500| = ${sg(s.fa1)} Hz (Nyquist wäre 750 Hz, also zu schnell)`, `7000 Hz: nächstes Vielfaches von 5000 Hz ist 5000 Hz → |7000 − 5000| = ${sg(s.fa2)} Hz`],
    hint: s => ['Wenn f größer als fs/2 ist, spiegelt es in den Bereich unter fs/2.', 'Suche das Vielfache von fs, das am nächsten an f liegt, und nimm den Abstand.', `Die Ergebnisse sind ${sg(s.fa1)} Hz und ${sg(s.fa2)} Hz.`] }));
  reg(() => { const f = 16e6, ps = 128;
    return { id: 'a8', block: 'adc', title: 'AVR: Abtastrate', level: 2,
      text: `Beim AVR braucht eine laufende Wandlung 13 ADC-Takte (die erste nach dem Einschalten dauert 25 Takte). Der ADC-Takt ist der Systemtakt (${fHz(f)}) geteilt durch den Vorteiler ${ps}. Berechne die Dauer einer Wandlung, die maximale Abtastrate und die Grenzfrequenz fs/2 (Signale müssen darunter liegen, damit man sie ohne Aliasing erfasst).`,
      fields: [N('tconv', 'Dauer einer Wandlung', 'µs'), N('fs', 'Abtastrate', 'Hz'), N('fmax', 'Grenzfrequenz fs/2 (Signale müssen darunter liegen)', 'Hz')],
      sol: () => { const r = K().adcRate(f, ps, 13); return { tconv: r.tconv * 1e6, fs: r.fs, fmax: r.nyq }; },
      steps: s => [`ADC-Takt = ${fHz(f)} / ${ps} = ${sg(K().adcRate(f, ps).fadc / 1e3)} kHz`, `Wandlung = 13 / ${sg(K().adcRate(f, ps).fadc / 1e3)} kHz = ${sg(s.tconv)} µs`, `fs = 1 / ${sg(s.tconv)} µs = ${sg(s.fs, 5)} Hz`, `f_max = fs / 2 = ${sg(s.fmax, 5)} Hz`],
      hint: s => ['Erst den ADC-Takt, dann die Zeit für 13 Takte.', 'fs ist der Kehrwert der Wandlungszeit. Nyquist: die Hälfte.', `Wandlung ≈ ${sg(s.tconv, 4)} µs.`] }; });
  reg(() => { const f = 16e6, ps = 128, fromB = 10, toB = 12;
    return { id: 'a9', block: 'adc', title: 'Oversampling: 10 Bit werden 12 Bit', level: 3,
      text: `Der ADC aus der Aufgabe zuvor (Vorteiler ${ps}, ${fHz(f)}) hat ${fromB} Bit. Durch Oversampling (Messwerte summieren, Summe um die zusätzlichen Bits nach rechts schieben) soll eine effektive Auflösung von ${toB} Bit entstehen; im Signal ist genug Rauschen. Wie viele Messwerte gehen in ein Ergebnis ein, und wie hoch ist die Ausgaberate?`,
      fields: [NI('n', 'Messwerte je Ergebnis', ''), N('rate', 'Ausgaberate', 'Hz')],
      sol: () => { const n = K().oversampleN(toB - fromB); return { n, rate: K().adcRate(f, ps).fs / n }; },
      steps: s => [`Zusätzliche Bits k = ${toB} − ${fromB} = ${toB - fromB}`, `Pro zusätzlichem Bit viermal so viele Werte: n = 4^${toB - fromB} = ${s.n}`, `Ausgaberate = fs / n = ${sg(K().adcRate(f, ps).fs, 5)} Hz / ${s.n} = ${sg(s.rate, 5)} Hz`],
      hint: s => ['Ein Bit mehr braucht viermal so viele Werte.', 'Zwei Bit mehr: 4 hoch 2.', `n = ${s.n}. Rate = fs / n.`] }; });
  reg(() => { const code = 512, vr = 4.8, va = 5.0, bits = 10;
    return { id: 'a10', block: 'adc', title: 'Referenz stimmt nicht', level: 2,
      text: `Ein Poti wird mit einem ${bits}-Bit-ADC gemessen, der Code ist ${code}. Die Software rechnet mit Vref = ${sg(va)} V, tatsächlich liegt die Referenz (zum Beispiel die Versorgung) bei ${sg(vr)} V. Welche Spannung zeigt die Software an, welche liegt wirklich an, und wie groß ist die Abweichung?`,
      fields: [N('shown', 'angezeigte Spannung', 'V'), N('real', 'tatsächliche Spannung', 'V'), N('err', 'Abweichung (Betrag)', 'mV'), N('rel', 'Abweichung relativ', '%')],
      sol: () => { const sh = K().adcVolt(code, va, bits), re = K().adcVolt(code, vr, bits); return { shown: sh, real: re, err: Math.abs(sh - re) * 1e3, rel: Math.abs(sh - re) / re * 100 }; },
      steps: s => [`angezeigt = ${code} / ${Math.pow(2, bits)} · ${sg(va)} V = ${sg(s.shown, 5)} V`, `real = ${code} / ${Math.pow(2, bits)} · ${sg(vr)} V = ${sg(s.real, 5)} V`, `Abweichung = ${sg(s.err, 4)} mV, bezogen auf den wahren Wert ${sg(s.rel, 4)} %`],
      hint: s => ['Der Code ist derselbe, nur das LSB ist ein anderes. Rechne zweimal.', 'Beide Male Code / 2^N mal Referenz.', `Beides ergibt etwa ${sg(s.shown, 3)} V und ${sg(s.real, 3)} V.`] }; });
  reg(() => { const span = 3.3, res = 0.001;
    return { id: 'a11', block: 'adc', title: 'Wie viele Bit braucht man?', level: 2,
      text: `Ein Sensorsignal von 0 bis ${sg(span)} V soll mit mindestens ${sg(res * 1e3)} mV Auflösung erfasst werden. Wie viele Bit braucht der ADC mindestens, und wie groß ist dann das LSB (Referenz ${sg(span)} V)?`,
      fields: [NI('bits', 'Bit', ''), N('lsb', 'LSB', 'mV')],
      sol: () => { const b = K().bitsNeeded(span, res); return { bits: b, lsb: K().adcLsb(span, b) * 1e3 }; },
      steps: s => [`Nötige Stufen = ${sg(span)} V / ${sg(res * 1e3)} mV = ${sg(span / res, 5)}`, `2^${s.bits - 1} = ${Math.pow(2, s.bits - 1)} reicht nicht, 2^${s.bits} = ${Math.pow(2, s.bits)} reicht → ${s.bits} Bit`, `LSB = ${sg(span)} V / ${Math.pow(2, s.bits)} = ${sg(s.lsb, 5)} mV`],
      hint: s => ['Wie viele Stufen müssen es sein? Kleinste Zweierpotenz, die mindestens so groß ist.', `${sg(span / res, 5)} Stufen werden gebraucht.`, `2^${s.bits - 1} ist zu klein, 2^${s.bits} reicht.`] }; });
  /* ---------- Erweiterung 186: Wandlertypen, Abgleich, Fehlerbudget (a12 bis a17) ---------- */
  reg(() => { const v = 1.5, vref = 2.56, bits = 10;
    const first4 = () => K().sarSteps(v, vref, bits).steps.slice(0, 4);
    return { id: 'a12', block: 'adc', title: 'SAR-Wandler: die ersten vier Vergleiche', level: 2,
      text: `Ein ${bits}-Bit-SAR-Wandler (sukzessive Approximation) mit der Referenz ${sg(vref)} V wandelt ${sg(v)} V. Er probiert die Bits von oben nach unten: Bit versuchsweise setzen, die Spannung des Versuchscodes mit dem Eingang vergleichen, Bit behalten, wenn der Eingang mindestens so groß ist. Mit welcher Spannung wird im 2., im 3. und im 4. Schritt verglichen, und wie lauten die ersten vier Bits (höchstwertiges zuerst)?`,
      fields: [N('v2', 'Vergleichsspannung im 2. Schritt', 'V'), N('v3', 'Vergleichsspannung im 3. Schritt', 'V'), N('v4', 'Vergleichsspannung im 4. Schritt', 'V'), S('bits', 'die ersten vier Bits', { ph: '4 Bit' })],
      sol: () => { const st = first4(); return { v2: st[1].vt, v3: st[2].vt, v4: st[3].vt, bits: st.map(x => x.keep ? 1 : 0).join('') }; },
      steps: s => first4().map((x, i) => `Schritt ${i + 1}: Bit ${x.bit} versuchsweise setzen, Vergleichsspannung ${sg(x.vt, 5)} V. Der Eingang (${sg(v)} V) ist ${x.keep ? 'mindestens so groß, das Bit bleibt 1' : 'kleiner, das Bit wird 0'}.`).concat([`Die ersten vier Bits lauten ${s.bits}. Nach jedem Schritt ist der Bereich, in dem der Eingang liegt, nur noch halb so groß.`]),
      hint: s => ['Der erste Vergleich liegt bei der halben Referenz. Danach halbiert sich die Schrittweite bei jedem Schritt.', `Der 1. Schritt vergleicht mit ${sg(first4()[0].vt, 5)} V. Bleibt ein Bit gesetzt, kommt die nächste Schrittweite dazu. Wird es gelöscht, rechnest du vom alten Stand aus weiter.`, `Im 2. Schritt wird mit ${sg(s.v2, 5)} V verglichen.`] }; });
  reg(() => { const fclk = 2e6, bits = 12, smp = 4, bits2 = 16;
    return { id: 'a13', block: 'adc', title: 'SAR-Wandler: Wandlungszeit', level: 1,
      text: `Ein ${bits}-Bit-SAR-Wandler läuft mit einem ADC-Takt von ${fHz(fclk)}. Eine Wandlung braucht ${smp} Takte zum Abtasten und Halten und danach einen Takt je Bit. Wie viele Takte dauert eine Wandlung, wie lange ist das, und wie hoch ist die größte Abtastrate? Wie lange dauert eine Wandlung bei gleichem Takt mit ${bits2} Bit?`,
      fields: [NI('n', 'Takte je Wandlung', ''), N('t', 'Dauer einer Wandlung', 'µs'), N('fs', 'größte Abtastrate', 'kHz'), N('t2', `Dauer mit ${bits2} Bit`, 'µs')],
      sol: () => { const r = K().sarConv(fclk, bits, smp), r2 = K().sarConv(fclk, bits2, smp); return { n: r.clocks, t: r.t * 1e6, fs: r.fs / 1e3, t2: r2.t * 1e6 }; },
      steps: s => [`Takte = ${smp} (Abtasten) + ${bits} (ein Takt je Bit) = ${s.n}`, `Ein Takt dauert 1 / ${fHz(fclk)} = ${sg(1 / fclk * 1e6)} µs, die Wandlung also ${s.n} · ${sg(1 / fclk * 1e6)} µs = ${sg(s.t)} µs`, `Abtastrate = 1 / ${sg(s.t)} µs = ${sg(s.fs)} kHz`, `Mit ${bits2} Bit: ${smp} + ${bits2} = ${K().sarConv(fclk, bits2, smp).clocks} Takte, also ${sg(s.t2)} µs. Mehr Auflösung kostet beim SAR-Wandler Zeit.`],
      hint: s => ['Ein SAR-Wandler entscheidet in jedem Takt genau ein Bit. Dazu kommt die Zeit zum Abtasten.', 'Takte zusammenzählen, dann durch den ADC-Takt teilen. Die Abtastrate ist der Kehrwert der Dauer.', `Eine Wandlung hat ${s.n} Takte.`] }; });
  reg(() => { const fmod = 1.024e6, osr = 256, want = 500;
    return { id: 'a14', block: 'adc', title: 'Sigma-Delta: Überabtastung und Datenrate', level: 2,
      text: `Ein Sigma-Delta-Wandler tastet mit seinem Modulator sehr schnell ab (${fHz(fmod)}) und mittelt danach in einem Digitalfilter. Das Überabtastverhältnis (OSR) ist ${osr}: Aus je ${osr} Modulatorwerten entsteht ein Ausgabewert. Wie hoch ist die Ausgabedatenrate, und bis zu welcher Signalfrequenz ist die Messung theoretisch höchstens brauchbar (halbe Datenrate)? Welches OSR brauchst du für ${want} Ausgabewerte je Sekunde?`,
      fields: [N('rate', 'Ausgabedatenrate', 'Hz'), N('bw', 'höchste nutzbare Signalfrequenz (Nyquist, halbe Datenrate)', 'Hz'), NI('osr2', `OSR für ${want} Werte je Sekunde`, '')],
      sol: () => { const r = K().sdRate(fmod, osr); return { rate: r, bw: r / 2, osr2: K().sdOsr(fmod, want) }; },
      steps: s => [`Datenrate = Modulatortakt / OSR = ${sg(fmod / 1e3)} kHz / ${osr} = ${sg(s.rate)} Hz`, `Halbe Datenrate (Nyquist): ${sg(s.rate)} Hz / 2 = ${sg(s.bw)} Hz. Das ist die theoretische Obergrenze, in der Praxis liegt die Grenze des Digitalfilters darunter.`, `OSR = Modulatortakt / Datenrate = ${sg(fmod)} Hz / ${want} Hz = ${s.osr2}`, 'Ein höheres OSR mittelt über mehr Werte: weniger Rauschen und mehr nutzbare Bits, dafür eine langsamere Ausgabe.'],
      hint: s => ['Das OSR sagt, wie viele schnelle Modulatorwerte zu einem Ausgabewert zusammengefasst werden.', 'Datenrate = Modulatortakt geteilt durch OSR. Für die zweite Frage stellst du die Formel nach dem OSR um.', `Die Datenrate liegt bei ${sg(s.rate / 1e3)} kHz.`] }; });
  reg(() => { const c1 = 640, u1 = 0.5, c2 = 3700, u2 = 3, code = 2900, bits = 12, vref = 3.3;
    return { id: 'a15', block: 'adc', title: 'Offset und Verstärkung abgleichen', level: 3,
      text: `Ein ${bits}-Bit-ADC (Referenz ${sg(vref)} V) hat einen Offsetfehler und einen Verstärkungsfehler. Zum Abgleich legst du zwei genau bekannte Spannungen an: Bei ${sg(u1)} V liefert er den Code ${c1}, bei ${sg(u2)} V den Code ${c2}. Die Kennlinie ist eine Gerade: U = m · Code + U0. Berechne die Steigung m in mV je Code, den Achsenabschnitt U0 in mV (mit Vorzeichen) und die korrigierte Spannung zum Code ${code}.`,
      fields: [N('m', 'Steigung m', 'mV je Code'), N('u0', 'U0 (mit Vorzeichen)', 'mV'), N('u', `korrigierte Spannung zum Code ${code}`, 'V', { tol: 0.0005, dig: 5 })],
      sol: () => { const k = K().calTwoPoint(c1, u1, c2, u2); return { m: k.m * 1e3, u0: k.u0 * 1e3, u: k.volt(code) }; },
      steps: s => [`m = (${sg(u2 * 1e3)} mV − ${sg(u1 * 1e3)} mV) / (${c2} − ${c1}) = ${sg((u2 - u1) * 1e3)} mV / ${c2 - c1} = ${sg(s.m, 5)} mV je Code`, `U0 = ${sg(u1 * 1e3)} mV − ${c1} · ${sg(s.m, 5)} mV = ${sg(s.u0, 4)} mV (der Offset)`, `U = ${sg(s.m, 5)} mV · ${code} + (${sg(s.u0, 4)} mV) = ${sg(s.u * 1e3, 5)} mV = ${sg(s.u, 5)} V`, `Ohne Abgleich (Code / ${Math.pow(2, bits)} · ${sg(vref)} V) kämen ${sg(K().adcVolt(code, vref, bits), 5)} V heraus, das sind rund ${sg(Math.abs(s.u - K().adcVolt(code, vref, bits)) * 1e3, 2)} mV daneben.`],
      hint: s => ['Zwei Punkte legen eine Gerade fest. Erst die Steigung aus den Differenzen, dann den Achsenabschnitt.', 'm = Spannungsdifferenz geteilt durch Codedifferenz. U0 = U1 − m · Code1.', `Die Steigung ist ${sg(s.m, 4)} mV je Code. Rechne mit mehr Stellen weiter, sonst wird das Ergebnis ungenau.`] }; });
  reg(() => { const pos = 0.42, bits = 10, vs1 = 5, vs2 = 4.6, vfix = 2.5;
    return { id: 'a16', block: 'adc', title: 'Ratiometrisch messen', level: 2,
      text: `Ein Poti liegt zwischen Versorgung und Masse, der Schleifer steht bei ${sg(pos * 100)} % und geht an einen ${bits}-Bit-ADC (der Wandler schneidet ab). Die Versorgung sinkt von ${sg(vs1)} V auf ${sg(vs2)} V. Fall 1, ratiometrisch: Die Referenz des ADC ist dieselbe Versorgung. Welchen Code liefert er bei ${sg(vs1)} V und welchen bei ${sg(vs2)} V? Fall 2: Die Referenz ist fest ${sg(vfix)} V. Welchen Code liefert er bei ${sg(vs2)} V, und welche Stellung in Prozent errechnet eine Software, die weiter mit ${sg(vs1)} V Versorgung rechnet?`,
      fields: [NI('cr1', `Fall 1: Code bei ${sg(vs1)} V`, ''), NI('cr2', `Fall 1: Code bei ${sg(vs2)} V`, ''), NI('cf', `Fall 2: Code bei ${sg(vs2)} V`, ''), N('ps', 'Fall 2: errechnete Stellung', '%')],
      sol: () => { const cf = K().adcCode(pos * vs2, vfix, bits); return { cr1: K().adcCode(pos * vs1, vs1, bits), cr2: K().adcCode(pos * vs2, vs2, bits), cf, ps: K().adcVolt(cf, vfix, bits) / vs1 * 100 }; },
      steps: s => [`Schleiferspannung: ${sg(pos * 100)} % von ${sg(vs1)} V = ${sg(pos * vs1)} V, nach dem Absinken ${sg(pos * 100)} % von ${sg(vs2)} V = ${sg(pos * vs2)} V`, `Fall 1: Code = ⌊U / Vref · ${Math.pow(2, bits)}⌋. Spannung und Referenz sinken im selben Verhältnis, der Bruch bleibt ${sg(pos)}: Code = ⌊${sg(pos * Math.pow(2, bits), 5)}⌋ = ${s.cr1} bei ${sg(vs1)} V und ${s.cr2} bei ${sg(vs2)} V. Der Fehler der Versorgung kürzt sich heraus.`, `Fall 2: Code = ⌊${sg(pos * vs2)} V / ${sg(vfix)} V · ${Math.pow(2, bits)}⌋ = ⌊${sg(pos * vs2 / vfix * Math.pow(2, bits), 5)}⌋ = ${s.cf} (bei ${sg(vs1)} V wären es ${K().adcCode(pos * vs1, vfix, bits)})`, `Die Software rechnet: ${s.cf} / ${Math.pow(2, bits)} · ${sg(vfix)} V = ${sg(K().adcVolt(s.cf, vfix, bits), 4)} V, geteilt durch ${sg(vs1)} V = ${sg(s.ps, 4)} % statt ${sg(pos * 100)} %`],
      hint: s => ['Der Code ist das Verhältnis von Eingangsspannung zu Referenz. Überlege, was mit diesem Verhältnis passiert, wenn beide aus derselben Quelle kommen.', 'Fall 1: Das Verhältnis ist immer der Schleiferanteil, die Versorgung fällt aus der Rechnung. Fall 2: erst die Schleiferspannung bei der gesunkenen Versorgung, dann den Code mit der festen Referenz.', `In Fall 1 ist der Code beide Male ${s.cr1}.`] }; });
  reg(() => { const vref = 2.5, bits = 12, u = 2, pRef = 0.2, pGain = 0.1, qLsb = 0.5;
    const parts = () => [u * pRef / 100 * 1e3, u * pGain / 100 * 1e3, qLsb * K().adcLsb(vref, bits) * 1e3];
    return { id: 'a17', block: 'adc', title: 'Fehlerbudget einer Messkette', level: 3,
      text: `Eine Messkette besteht aus einem Verstärker und einem ${bits}-Bit-ADC mit der Referenz ${sg(vref)} V. Am ADC-Eingang liegen ${sg(u)} V. Rechne den ungünstigsten Fall als einfache Summe der Beträge: Referenz ±${sg(pRef)} %, Verstärkung ±${sg(pGain)} % (beide wirken prozentual auf den Messwert), Quantisierung ±${sg(qLsb)} LSB. Wie groß sind die drei Anteile in mV, wie groß ist ihre Summe, und wie viel Prozent vom Messwert sind das? Welcher Anteil ist der größte?`,
      fields: [N('eref', 'Anteil Referenz', 'mV'), N('egain', 'Anteil Verstärkung', 'mV'), N('eq', 'Anteil Quantisierung', 'mV'), N('sum', 'Summe', 'mV'), N('rel', 'Summe bezogen auf den Messwert', '%'), CH('big', 'größter Anteil', [{ v: 'ref', t: 'Referenz' }, { v: 'gain', t: 'Verstärkung' }, { v: 'q', t: 'Quantisierung' }])],
      sol: () => { const b = K().errBudget(parts()); return { eref: b.parts[0], egain: b.parts[1], eq: b.parts[2], sum: b.sum, rel: b.sum / (u * 1e3) * 100, big: ['ref', 'gain', 'q'][b.biggest] }; },
      steps: s => [`Referenz: ${sg(pRef)} % von ${sg(u * 1e3)} mV = ${sg(s.eref)} mV`, `Verstärkung: ${sg(pGain)} % von ${sg(u * 1e3)} mV = ${sg(s.egain)} mV`, `Quantisierung: LSB = ${sg(vref * 1e3)} mV / ${Math.pow(2, bits)} = ${sg(K().adcLsb(vref, bits) * 1e3, 5)} mV, davon ${sg(qLsb)} LSB = ${sg(s.eq, 4)} mV`, `Summe = ${sg(s.eref)} mV + ${sg(s.egain)} mV + ${sg(s.eq, 4)} mV = ${sg(s.sum, 4)} mV`, `Bezogen auf den Messwert: ${sg(s.sum, 4)} mV / ${sg(u * 1e3)} mV = ${sg(s.rel, 4)} %. Der größte Anteil kommt von der Referenz: Mehr Bits würden hier fast nichts bringen.`],
      hint: s => ['Rechne jeden Anteil einzeln in mV aus und zähle die Beträge zusammen.', 'Die Prozentangaben beziehen sich auf den Messwert. Für die Quantisierung brauchst du das LSB: Referenz geteilt durch die Zahl der Stufen.', `Ein LSB ist ${sg(K().adcLsb(vref, bits) * 1e3, 4)} mV groß.`] }; });

  /* =========================================================  Block 3: Busse  ========================================================= */
  reg(() => { const baud = 115200, cfg = { data: 8, parity: 'N', stop: 1 }, nb = 100;
    return { id: 'b1', block: 'bus', title: 'UART: Bitzeit und Durchsatz', level: 1,
      text: `Eine UART läuft mit ${baud} Baud, 8N1 (8 Datenbits, keine Parität, 1 Stoppbit). Wie lang ist ein Bit, wie viele Zeichen werden je Sekunde übertragen, und wie lange dauern ${nb} Zeichen?`,
      fields: [N('tbit', 'Bitzeit', 'µs'), N('rate', 'Zeichen pro Sekunde', ''), N('t', 'Zeit für 100 Zeichen', 'ms')],
      sol: () => ({ tbit: K().uartBitTime(baud) * 1e6, rate: K().uartByteRate(baud, cfg), t: nb / K().uartByteRate(baud, cfg) * 1e3 }),
      steps: s => [`Bitzeit = 1 / ${baud} = ${sg(s.tbit, 5)} µs`, `Rahmen = 1 Start + 8 Daten + 1 Stopp = ${K().uartFrameBits(cfg)} Bit`, `Zeichen pro Sekunde = ${baud} / ${K().uartFrameBits(cfg)} = ${sg(s.rate, 6)}`, `${nb} Zeichen = ${nb} · ${K().uartFrameBits(cfg)} Bit · ${sg(s.tbit, 5)} µs = ${sg(s.t, 4)} ms`],
      hint: s => ['Nutzdaten sind nur 8 von 10 Bit im Rahmen. Zähle den ganzen Rahmen.', 'Bitzeit = 1 / Baudrate. Zeichenrate = Baudrate / Bits je Rahmen.', `Ein Rahmen hat ${K().uartFrameBits(cfg)} Bit; die Zeichenrate ist ${sg(s.rate, 5)} pro Sekunde.`] }; });
  reg(() => { const cfg = { data: 8, parity: 'E', stop: 1 }, by = 0x41;
    return { id: 'b2', block: 'bus', title: 'UART-Rahmen bauen (8E1)', level: 2,
      text: `Das Zeichen „A“ (${hx(by)}) wird mit 8E1 gesendet: 8 Datenbits, gerade Parität, 1 Stoppbit. Das niederwertigste Datenbit kommt zuerst. Gib den Rahmen als Bitfolge in Sendereihenfolge an (Start, Daten, Parität, Stopp, ohne Leerzeichen) und nenne das Paritätsbit.`,
      fields: [S('pbit', 'Paritätsbit', { ph: '0 oder 1' }), S('frame', 'Rahmen', { ph: '11 Bit' })],
      sol: () => { const b = K().uartBits(by, cfg); return { pbit: String(b[9]), frame: b.join('') }; },
      steps: s => { const b = K().uartBits(by, cfg); return [`${hx(by)} = ${K().bin(by, 8)}; niederwertigstes Bit zuerst: ${b.slice(1, 9).join('')}`, `Einsen in den Daten: ${K().popcount(by)} → gerade Parität: Paritätsbit = ${s.pbit} (Daten plus Paritätsbit sollen eine gerade Zahl Einsen haben)`, `Rahmen: Start 0, Daten ${b.slice(1, 9).join('')}, Parität ${s.pbit}, Stopp 1 → ${s.frame}`]; },
      hint: s => ['Schreibe das Byte binär auf und drehe die Reihenfolge um: Das niederwertigste Bit wird zuerst gesendet.', 'Zähle die Einsen. Bei gerader Parität ergänzt das Paritätsbit auf eine gerade Anzahl.', `Rahmenlänge ${s.frame.length} Bit; Paritätsbit ${s.pbit}.`] }; });
  reg(() => { const by = 0x5A;
    return { id: 'b3', block: 'bus', title: 'Ungerade Parität', level: 1,
      text: `Das Byte ${hx(by)} wird mit ungerader Parität gesendet (8O1). Wie viele Einsen hat das Byte, und welchen Wert hat das Paritätsbit?`,
      fields: [NI('ones', 'Einsen im Byte', ''), NI('pbit', 'Paritätsbit', '')],
      sol: () => ({ ones: K().popcount(by), pbit: K().parityBit(by, 8, 'O') }),
      steps: s => [`${hx(by)} = ${K().bin(by, 8)} hat ${s.ones} Einsen`, `Ungerade Parität: Daten plus Paritätsbit sollen eine ungerade Zahl Einsen haben. ${s.ones} ist ${s.ones % 2 ? 'ungerade' : 'gerade'}, also Paritätsbit = ${s.pbit}`],
      hint: s => ['Erst die Einsen zählen.', 'Ungerade Parität: Die Gesamtzahl der Einsen (mit Paritätsbit) soll ungerade sein.', `Das Byte hat ${s.ones} Einsen.`] }; });
  reg(() => { const f = 16e6, baud = 115200;
    return { id: 'b4', block: 'bus', title: 'Baudraten-Register (UBRR)', level: 3,
      text: `Ein AVR mit ${fHz(f)} soll ${baud} Baud erzeugen (U2X = 0, Teiler 16). Es gilt UBRR = Runden(f_CPU / (16 · Baud)) − 1. Berechne UBRR, die tatsächliche Baudrate und den Fehler in Prozent (tatsächlich minus Wunsch, bezogen auf den Wunsch, mit Vorzeichen). Ist der Fehler kleiner als 2 % (übliche Faustregel für zuverlässige Verbindung)?`,
      fields: [NI('ubrr', 'UBRR', ''), N('act', 'tatsächliche Baudrate', 'Baud'), N('err', 'Fehler (mit Vorzeichen)', '%', { tol: 0.02 }), CH('ok', 'Fehler unter 2 %?', JN)],
      sol: () => { const r = K().uartUbrr(f, baud, false); return { ubrr: r.ubrr, act: r.actual, err: r.errPct, ok: Math.abs(r.errPct) < 2 ? 'ja' : 'nein' }; },
      steps: s => [`f / (16 · Baud) = ${sg(f / (16 * baud), 6)}`, `gerundet ${s.ubrr + 1}, minus 1: UBRR = ${s.ubrr}`, `tatsächlich = ${fHz(f)} / (16 · ${s.ubrr + 1}) = ${sg(s.act, 6)} Baud`, `Fehler = (${sg(s.act, 6)} − ${baud}) / ${baud} = ${sg(s.err, 4)} % → ${s.ok === 'ja' ? 'unter' : 'über'} 2 %`],
      hint: s => ['Teile den Takt durch 16 mal Baudrate, runde, ziehe 1 ab.', `Quotient = ${sg(f / (16 * baud), 5)}.`, `UBRR = ${s.ubrr}. Rechne damit die Baudrate zurück und vergleiche.`] }; });
  reg(() => { const cfg = { data: 8, parity: 'E', stop: 1 }, by = 0x4B, bad = 3;
    return { id: 'b5', block: 'bus', title: 'Logikanalysator: Bitfehler im UART-Rahmen', level: 3,
      text: `Gesendet wird „K“ (${hx(by)}) mit 8E1. Der Logikanalysator zeigt unten den empfangenen Rahmen; ein Bit ist verändert. Welches Datenbit (0 = niederwertigstes) ist falsch, und was meldet der Empfänger?`,
      scene: { type: 'uart', cfg, byte: by, flip: 1 + bad },
      fields: [NI('bit', 'falsches Datenbit (Nummer)', ''), CH('err', 'Meldung des Empfängers', [{ v: 'par', t: 'Paritätsfehler' }, { v: 'frame', t: 'Rahmenfehler' }, { v: 'none', t: 'kein Fehler' }])],
      sol: () => { const b = K().uartBits(by, cfg); b[1 + bad] ^= 1; const r = K().uartDecodeWave(K().uartWave([b], 8, 2), 8, cfg)[0]; const x = r.byte ^ by; let i = 0; while (!((x >> i) & 1)) i++; return { bit: i, err: !r.framingOk ? 'frame' : !r.parityOk ? 'par' : 'none' }; },
      steps: s => { const b = K().uartBits(by, cfg); const bb = b.slice(); bb[1 + bad] ^= 1; const r = K().uartDecodeWave(K().uartWave([bb], 8, 2), 8, cfg)[0]; return [`Erwartet: ${hx(by)} = ${K().bin(by, 8)}, LSB zuerst gesendet ${b.slice(1, 9).join('')}`, `Gelesen (LSB zuerst): ${r.bits.slice(1, 9).join('')} → ${hx(r.byte)}`, `Unterschied im Datenbit ${s.bit}`, `Die Parität (${b[9]} gesendet) passt nicht mehr zu den gelesenen Daten → ${s.err === 'par' ? 'Paritätsfehler' : s.err}. Das Stoppbit ist High: kein Rahmenfehler.`]; },
      hint: s => ['Schreibe die Soll-Bitfolge LSB zuerst auf und vergleiche Stelle für Stelle mit der Aufnahme.', 'Die Parität ist der Test: Zähle die Einsen der gelesenen Daten plus Paritätsbit.', `Das falsche Bit ist ein Datenbit mit Nummer ${s.bit}.`] }; });
  reg(() => ({ id: 'b6', block: 'bus', title: 'UART: wie genau müssen die Takte sein?', level: 3,
    text: 'Der Empfänger tastet jedes Bit in der Bitmitte ab, ausgehend von der fallenden Flanke des Startbits. Wie groß darf die Taktabweichung (gesamt, Sender und Empfänger zusammen) höchstens sein, bis das letzte Bit nicht mehr sicher getroffen wird: bei einem 10-Bit-Rahmen (8N1) und bei einem 11-Bit-Rahmen (8E1)? Sender +2 %, Empfänger −3,5 %: Geht 8N1 noch?',
    fields: [N('e10', '10-Bit-Rahmen', '%'), N('e11', '11-Bit-Rahmen', '%'), CH('ok', '8N1 bei +2 % und −3,5 % noch sicher?', JN)],
    sol: () => ({ e10: K().uartMaxErrPct(10), e11: K().uartMaxErrPct(11), ok: Math.abs(2 - (-3.5)) <= K().uartMaxErrPct(10) ? 'ja' : 'nein' }),
    steps: s => ['Das letzte Bit (Nummer N−1 ab dem Startbit) wird bei (N − ½) Bitzeiten abgetastet und muss noch vor Ende der N-ten Bitzeit liegen.', `Zulässige Abweichung: ½ Bitzeit auf N − ½ Bitzeiten verteilt = 50 % / (N − ½)`, `N = 10: 50 / 9,5 = ${sg(s.e10, 4)} %`, `N = 11: 50 / 10,5 = ${sg(s.e11, 4)} %`, `Beide Seiten zusammen: |2 − (−3,5)| = 5,5 % > ${sg(s.e10, 4)} % → ${s.ok === 'ja' ? 'noch sicher' : 'nicht mehr sicher'}`, 'Das ist die theoretische Obergrenze (Abtastung genau in Bitmitte). In der Praxis bleibt wegen der Startflanken-Unsicherheit (1/16 Bit) weniger: rund 4 % gesamt, Faustregel höchstens 2 % je Seite.'],
    hint: s => ['Der Fehler summiert sich über den ganzen Rahmen; am schlimmsten trifft es das letzte Bit.', 'Im besten Fall darf die Abtastung bis zur Bitgrenze (halbe Bitzeit) wandern. Die Strecke ist N − ½ Bitzeiten lang.', `Die Grenze für 10 Bit liegt bei etwa ${sg(s.e10, 3)} %.`] }));
  reg(() => { const mode = 3, mosi = 0xA5, miso = 0x3C;
    return { id: 'b7', block: 'bus', title: 'Logikanalysator: SPI-Modus erkennen', level: 3,
      text: 'Der Analysator zeigt CS, SCK, MOSI und MISO eines SPI-Transfers (8 Bit, höchstwertiges Bit zuerst). Bestimme den Modus (0 bis 3) aus Ruhepegel von SCK und Lage der Datenwechsel und lies dann MOSI und MISO als Hexwert ab.',
      scene: { type: 'spi', mode, mosi, miso, decodeMode: null },
      fields: [NI('mode', 'SPI-Modus', ''), HX('mosi', 'MOSI-Byte (hex)'), HX('miso', 'MISO-Byte (hex)')],
      sol: () => { const w = K().spiWave({ mosi, miso, mode }), m = K().spiGuessMode(w), d = K().spiDecode(w, m); return { mode: m, mosi: d.mosi, miso: d.miso }; },
      steps: s => { const c = K().spiCfg(s.mode); return [`SCK ruht ${c.idle ? 'High' : 'Low'} → CPOL = ${c.cpol}`, `Die Daten wechseln ${c.cpha ? 'bei der ersten (führenden) Flanke, abgetastet wird bei der zweiten' : 'schon vor der ersten Flanke, abgetastet wird bei der ersten'} → CPHA = ${c.cpha}`, `Modus = 2 · CPOL + CPHA = ${s.mode}; Abtastung bei ${c.sampleRising ? 'steigender' : 'fallender'} Flanke`, `MOSI an den acht Abtastflanken: ${K().bin(s.mosi, 8)} = ${hx(s.mosi)}; MISO: ${K().bin(s.miso, 8)} = ${hx(s.miso)}`]; },
      hint: s => ['CPOL ist der Pegel von SCK, wenn nichts übertragen wird. CPHA erkennst du daran, wo die Datenleitung zum ersten Mal wechselt.', 'Schau, an welcher Flanke die Datenleitungen wechseln: an der ersten Flanke jedes Takts → CPHA = 1 (abgetastet wird an der zweiten); an der zweiten bzw. schon vor dem ersten Takt → CPHA = 0. Dann an der richtigen Flanke ablesen.', `Der Modus ist ${s.mode}. Lies die Bits in der Reihenfolge, MSB zuerst.`] }; });
  reg(() => ({ id: 'b8', block: 'bus', title: 'SPI-Modi zuordnen', level: 2,
    text: 'Ordne zu: Welche Modusnummer hat CPOL = 1 und CPHA = 0? Bei welcher Flanke tastet Modus 1 ab? Wie ruht SCK in Modus 2?',
    fields: [NI('m', 'Modus für CPOL = 1, CPHA = 0', ''), CH('edge', 'Abtastflanke Modus 1', [{ v: 'rise', t: 'steigend' }, { v: 'fall', t: 'fallend' }]), CH('idle', 'Ruhepegel SCK in Modus 2', [{ v: 'low', t: 'Low' }, { v: 'high', t: 'High' }])],
    sol: () => ({ m: 2 * 1 + 0, edge: K().spiCfg(1).sampleRising ? 'rise' : 'fall', idle: K().spiCfg(2).idle ? 'high' : 'low' }),
    steps: s => ['Modus = 2 · CPOL + CPHA: CPOL 1 und CPHA 0 gibt ' + s.m, `Modus 1: CPOL = ${K().spiCfg(1).cpol}, CPHA = ${K().spiCfg(1).cpha}: verschieden → fallend (steigend nur, wenn CPOL gleich CPHA)`, `Modus 2: CPOL = ${K().spiCfg(2).cpol} → Ruhepegel ${s.idle === 'high' ? 'High' : 'Low'}`],
    hint: s => ['Modus = 2 mal CPOL plus CPHA.', 'Abtastung steigend, wenn CPOL gleich CPHA, sonst fallend.', 'CPOL ist der Ruhepegel von SCK.'] }));
  reg(() => { const f = 16e6, div = 4, nb = 32;
    return { id: 'b9', block: 'bus', title: 'SPI: Taktrate und Übertragungszeit', level: 1,
      text: `Der SPI-Takt entsteht aus ${fHz(f)} durch den Teiler ${div}. Wie hoch ist die Taktfrequenz, wie lange dauert ein Byte (8 Bit), und wie lange dauern ${nb} Byte (ohne Pausen)?`,
      fields: [N('fsck', 'SCK-Frequenz', 'MHz'), N('t8', 'ein Byte', 'µs'), N('tn', '32 Byte', 'µs')],
      sol: () => { const r = K().spiRate(f, div); return { fsck: r.fsck / 1e6, t8: r.tbit * 8 * 1e6, tn: r.tbit * 8 * nb * 1e6 }; },
      steps: s => [`f_SCK = ${fHz(f)} / ${div} = ${sg(s.fsck)} MHz`, `Ein Bit = 1 / ${sg(s.fsck)} MHz = ${sg(s.t8 / 8)} µs; ein Byte = 8 · ${sg(s.t8 / 8)} µs = ${sg(s.t8)} µs`, `${nb} Byte = ${nb} · ${sg(s.t8)} µs = ${sg(s.tn)} µs`],
      hint: s => ['Ein SCK-Takt überträgt ein Bit.', 'Bitzeit = Teiler / f_CPU.', `Ein Bit dauert ${sg(s.t8 / 8)} µs.`] }; });
  reg(() => { const addr = 0x48, bytes = [0x01, 0x60];
    return { id: 'b10', block: 'bus', title: 'Logikanalysator: I²C dekodieren', level: 2,
      text: 'Der Analysator zeigt SCL und SDA einer I²C-Übertragung. Lies Start, Adresse, Richtung und die Datenbytes ab (Bits MSB zuerst, gelesen bei der steigenden SCL-Flanke).',
      scene: { type: 'i2c', addr, rw: 'W', bytes },
      fields: [HX('addr', 'Adresse (7 Bit, hex)'), CH('rw', 'Richtung', [{ v: 'W', t: 'schreiben (W)' }, { v: 'R', t: 'lesen (R)' }]), HX('d1', 'erstes Datenbyte'), HX('d2', 'zweites Datenbyte')],
      sol: () => { const ev = K().i2cDecode(K().i2cWave(K().i2cEncode({ addr, rw: 'W', bytes }))), a = ev.find(e => e.type === 'ADDR'), d = ev.filter(e => e.type === 'DATA'); return { addr: a.addr, rw: a.rw, d1: d[0].value, d2: d[1].value }; },
      steps: s => [`START: SDA fällt bei SCL High.`, `Erstes Byte (8 Bit): Adresse in den oberen 7 Bit, Richtungsbit zuletzt: ${K().bin((s.addr << 1) | (s.rw === 'R' ? 1 : 0), 8)} → Adresse ${hx(s.addr)}, Bit 0 = ${s.rw === 'R' ? 1 : 0} → ${s.rw === 'R' ? 'lesen' : 'schreiben'}`, `Neunter Takt: SDA Low = ACK (Gerät ist da).`, `Datenbytes: ${K().bin(s.d1, 8)} = ${hx(s.d1)}, ${K().bin(s.d2, 8)} = ${hx(s.d2)}`, `STOP: SDA steigt bei SCL High.`],
      hint: s => ['Nur bei den steigenden SCL-Flanken zählt SDA. Notiere die Bits in einer Reihe, nach 8 kommt das Quittierbit.', 'Erstes Byte: oben 7 Bit Adresse, das unterste Bit ist die Richtung (0 = schreiben).', `Die Adresse ist ${hx(s.addr)}.`] }; });
  reg(() => { const addr = 0x68;
    return { id: 'b11', block: 'bus', title: 'Logikanalysator: Fehler im I²C-Ablauf', level: 3,
      text: 'Der Master spricht ein Gerät an, aber es klappt nicht. Sieh dir den Ablauf an: Wo liegt der Fehler, und welche Adresse wurde angesprochen?',
      scene: { type: 'i2c', addr, rw: 'W', bytes: [], acks: [1] },
      fields: [CH('err', 'Fehler', [{ v: 'addr_nack', t: 'Adresse nicht quittiert (NACK)' }, { v: 'data_nack', t: 'Datenbyte nicht quittiert' }, { v: 'nostop', t: 'Stopp fehlt' }, { v: 'ok', t: 'kein Fehler' }]), HX('addr', 'angesprochene Adresse (hex)')],
      sol: () => { const ev = K().i2cDecode(K().i2cWave(K().i2cEncode({ addr, rw: 'W', bytes: [], acks: [1] }))), a = ev.find(e => e.type === 'ADDR'); let err = 'ok'; const bad = ev.find(e => (e.type === 'ADDR' || e.type === 'DATA') && !e.ack); if (bad) err = bad.type === 'ADDR' ? 'addr_nack' : 'data_nack'; else if (ev[ev.length - 1].type === 'KEIN-STOP') err = 'nostop'; return { err, addr: a.addr }; },
      steps: s => [`Adresse ${hx(s.addr)} gelesen, Richtung schreiben.`, `Im neunten Takt bleibt SDA High (NACK): Kein Gerät hat sich gemeldet, oder die Adresse ist falsch.`, `Typische Ursachen: falsche Adresse (Datenblatt nennt oft die 8-Bit-Schreibadresse statt der 7-Bit-Adresse), Gerät nicht versorgt, SDA/SCL vertauscht, fehlender Pull-up.`],
      hint: s => ['Schau auf den neunten Takt des ersten Bytes: Ist SDA Low (ACK) oder High (NACK)?', 'Ein NACK auf die Adresse heißt: niemand antwortet.', `Die Adresse ist ${hx(s.addr)}.`] }; });
  reg(() => { const c = 150e-12, trMax = 300e-9, vdd = 3.3, vol = 0.4, iol = 0.003, nbytes = 3, fscl = 400e3;
    return { id: 'b12', block: 'bus', title: 'I²C: Pull-up und Übertragungszeit', level: 3,
      text: `Der I²C-Bus hat 150 pF Leitungskapazität. Im Fast-Mode (400 kHz) darf die Anstiegszeit (30 % bis 70 %) höchstens 300 ns betragen; sie ist ungefähr 0,8473 · R · C. Berechne den größten zulässigen Pull-up-Widerstand. Bei ${sg(vdd)} V Versorgung, V_OL = ${sg(vol)} V und I_OL = 3 mA: Wie groß muss der Widerstand mindestens sein? Wie lange dauert eine Übertragung mit Adresse und ${nbytes} Datenbytes bei ${fHz(fscl)} (nur die 9-Takt-Bytes gezählt)?`,
      fields: [N('rmax', 'größter Pull-up', 'kΩ'), N('rmin', 'kleinster Pull-up', 'Ω'), N('t', 'Übertragungszeit', 'µs')],
      sol: () => ({ rmax: K().i2cRmax(trMax, c) / 1e3, rmin: K().i2cRmin(vdd, vol, iol), t: K().i2cTime(fscl, nbytes) * 1e6 }),
      steps: s => [`R_max = t_r / (0,8473 · C) = 300 ns / (0,8473 · 150 pF) = ${sg(s.rmax, 4)} kΩ`, `R_min = (V_DD − V_OL) / I_OL = (${sg(vdd)} V − ${sg(vol)} V) / 3 mA = ${sg(s.rmin, 5)} Ω`, `Takte = 9 · (1 Adresse + ${nbytes} Daten) = ${K().i2cClocks(nbytes)}`, `Zeit = ${K().i2cClocks(nbytes)} / ${fHz(fscl)} = ${sg(s.t, 4)} µs`],
      hint: s => ['Obergrenze von der Anstiegszeit, Untergrenze vom Strom, den der Ausgang gegen den Widerstand nach Low ziehen kann.', 'R_max = t_r / (0,8473 · C). R_min = (V_DD − V_OL) / I_OL.', `R_max liegt bei etwa ${sg(s.rmax, 3)} kΩ.`] }; });
  /* ---------- Erweiterung 186: RS-485, RS-232, CAN, Pegelanpassung (b13 bis b20) ---------- */
  const ST485 = [{ v: '1', t: 'logisch 1' }, { v: '0', t: 'logisch 0' }, { v: 'x', t: 'unbestimmt' }];
  const st485 = v => ST485.find(x => x.v === v).t;
  reg(() => { const a1 = 1.9, b1 = 3.1, a2 = 2.45, b2 = 2.56, thr = 0.2;
    return { id: 'b13', block: 'bus', title: 'RS-485: Differenzspannung und Zustand', level: 1,
      text: `Ein RS-485-Empfänger wertet nur die Differenz U_AB = U_A − U_B aus. Für den Baustein gilt: Über +${sg(thr * 1e3)} mV erkennt er logisch 1, unter −${sg(thr * 1e3)} mV logisch 0, dazwischen ist der Zustand unbestimmt. Messung 1 gegen Masse: A = ${sg(a1)} V, B = ${sg(b1)} V. Messung 2: A = ${sg(a2)} V, B = ${sg(b2)} V. Wie groß ist U_AB jeweils (in mV, mit Vorzeichen), und welchen Zustand erkennt der Empfänger?`,
      fields: [N('vd1', 'Messung 1: U_AB (mit Vorzeichen)', 'mV'), CH('st1', 'Messung 1: Zustand', ST485), N('vd2', 'Messung 2: U_AB (mit Vorzeichen)', 'mV'), CH('st2', 'Messung 2: Zustand', ST485)],
      sol: () => { const r1 = K().rs485State(a1, b1, thr), r2 = K().rs485State(a2, b2, thr); return { vd1: r1.vd * 1e3, st1: r1.state, vd2: r2.vd * 1e3, st2: r2.state }; },
      steps: s => [`Messung 1: U_AB = ${sg(a1)} V − ${sg(b1)} V = ${sg(s.vd1)} mV. Das liegt ${s.vd1 < 0 ? 'unter −' : 'über +'}${sg(thr * 1e3)} mV: ${st485(s.st1)}.`, `Messung 2: U_AB = ${sg(a2)} V − ${sg(b2)} V = ${sg(s.vd2)} mV. Das liegt zwischen −${sg(thr * 1e3)} mV und +${sg(thr * 1e3)} mV: ${st485(s.st2)}. So sieht ein Bus aus, den gerade niemand treibt oder der zu stark gedämpft ist.`, 'Die Spannungen gegen Masse spielen keine Rolle, solange sie im erlaubten Gleichtaktbereich bleiben. Darum ist RS-485 unempfindlich gegen Störungen, die beide Adern gleich treffen.', 'Achtung: Die Bezeichnungen A und B sind nicht einheitlich. Viele Datenblätter (und diese Aufgabe) nennen eine Differenz A − B über der oberen Schwelle logisch 1, die Norm benennt die Adern umgekehrt. Wenn ein Bus nicht läuft, tausche zuerst A und B.'],
      hint: s => ['Ziehe die Spannung an B von der Spannung an A ab und achte auf das Vorzeichen.', 'Vergleiche die Differenz mit den beiden Schwellen. Liegt sie dazwischen, kann der Empfänger nichts sicher erkennen.', `Bei Messung 1 ist die Differenz ${sg(s.vd1)} mV.`] }; });
  reg(() => { const r = 120, meas = 40;
    return { id: 'b14', block: 'bus', title: 'RS-485: Abschlusswiderstände nachmessen', level: 1,
      text: `Ein RS-485-Bus wird an beiden Leitungsenden mit je ${r} Ω zwischen A und B abgeschlossen. Du prüfst das bei abgeschalteter Anlage mit dem Ohmmeter zwischen A und B (Leitungswiderstand und Eingänge der Teilnehmer vernachlässigt, der Bus hat keine Vorspannwiderstände). Was misst du, wenn kein Abschluss eingeschaltet ist? Welchen Wert misst du bei einem und welchen bei zwei Abschlüssen? An einer anderen Anlage misst du ${meas} Ω: Wie viele Abschlüsse sind dort eingeschaltet?`,
      fields: [CH('r0', 'kein Abschluss', [{ v: 'open', t: 'sehr hochohmig (praktisch offen)' }, { v: 'zero', t: 'etwa 0 Ω' }, { v: 'r', t: `${r} Ω` }]), N('r1', 'ein Abschluss', 'Ω'), N('r2', 'zwei Abschlüsse', 'Ω'), NI('n', `Abschlüsse bei ${meas} Ω`, '')],
      sol: () => ({ r0: isFinite(K().termRes(r, 0)) ? 'r' : 'open', r1: K().termRes(r, 1), r2: K().termRes(r, 2), n: K().termCount(r, meas) }),
      steps: s => ['Ohne Abschluss und ohne Vorspannwiderstände liegt zwischen A und B kein Widerstand: Das Ohmmeter zeigt einen sehr hohen Wert. Hat ein Bus Vorspannwiderstände (von A und B zur Versorgung und nach Masse), misst du stattdessen deren Summe und bei eingeschalteten Abschlüssen etwas weniger als die Rechenwerte.', `Ein Abschluss: ${sg(s.r1)} Ω`, `Zwei Abschlüsse liegen parallel: ${r} Ω / 2 = ${sg(s.r2)} Ω. Das ist der Sollwert eines richtig abgeschlossenen Busses.`, `${meas} Ω = ${r} Ω / ${s.n}: Es sind ${s.n} Abschlüsse eingeschaltet, einer zu viel. Die Sender werden zu stark belastet, der Signalhub sinkt.`],
      hint: s => ['Alle Abschlusswiderstände liegen zwischen denselben zwei Adern. Überlege, wie sie zueinander geschaltet sind.', 'Gleiche Widerstände parallel: Einzelwert geteilt durch die Anzahl.', `Zwei Abschlüsse ergeben ${sg(s.r2)} Ω. Teile den Einzelwert durch den Messwert, dann hast du die Anzahl.`] }; });
  reg(() => { const prod = 1e8, cap = 1200, len1 = 400, rate2 = 500e3, rate3 = 19200, rate4 = 115200, len4 = 800;
    return { id: 'b15', block: 'bus', title: 'RS-485: Leitungslänge und Bitrate', level: 2,
      text: `Für RS-485 gilt als Faustregel: Bitrate in Bit/s mal Leitungslänge in m soll höchstens 100 Millionen (10^8) sein, und die Leitung soll nie länger als ${cap} m werden. Welche Bitrate ist bei ${len1} m höchstens möglich? Wie lang darf die Leitung bei ${sg(rate2 / 1e3)} kBit/s und wie lang bei ${sg(rate3 / 1e3)} kBit/s sein? Passen ${sg(rate4 / 1e3)} kBit/s zu ${len4} m Leitung?`,
      fields: [N('rate', `höchste Bitrate bei ${len1} m`, 'kBit/s'), N('l2', `größte Länge bei ${sg(rate2 / 1e3)} kBit/s`, 'm'), N('l3', `größte Länge bei ${sg(rate3 / 1e3)} kBit/s`, 'm'), CH('ok', `${sg(rate4 / 1e3)} kBit/s bei ${len4} m zulässig?`, JN)],
      sol: () => ({ rate: K().rs485MaxRate(prod, len1) / 1e3, l2: K().rs485MaxLen(prod, rate2, cap), l3: K().rs485MaxLen(prod, rate3, cap), ok: len4 <= K().rs485MaxLen(prod, rate4, cap) ? 'ja' : 'nein' }),
      steps: s => [`Bitrate = 10^8 / ${len1} m = ${sg(s.rate * 1e3, 6)} Bit/s = ${sg(s.rate)} kBit/s`, `Länge bei ${sg(rate2 / 1e3)} kBit/s = 10^8 / ${rate2} = ${sg(s.l2)} m`, `Länge bei ${sg(rate3 / 1e3)} kBit/s: 10^8 / ${rate3} = ${sg(prod / rate3, 4)} m. Das ist mehr als die Obergrenze, also gilt ${sg(s.l3)} m.`, `${sg(rate4 / 1e3)} kBit/s: 10^8 / ${rate4} = ${sg(prod / rate4, 4)} m. ${len4} m sind ${s.ok === 'ja' ? 'kürzer, das passt' : 'länger, das passt nicht'}.`],
      hint: s => ['Die Faustregel ist ein festes Produkt. Ist ein Faktor bekannt, bekommst du den anderen durch Teilen.', 'Rechne die Bitrate in Bit/s um (1 kBit/s = 1000 Bit/s) und vergiss die feste Obergrenze der Länge nicht.', `Bei ${len1} m sind es ${sg(s.rate)} kBit/s.`] }; });
  reg(() => { const by = 0x53, volt = 9;
    const lv = () => K().rs232Levels(by, volt), pm = v => (v > 0 ? '+' : '−') + Math.abs(v);
    return { id: 'b16', block: 'bus', title: 'RS-232: Byte aus den Pegeln lesen', level: 2,
      text: `RS-232 arbeitet mit negativer Logik: Eine negative Spannung (unter −3 V) ist logisch 1, eine positive (über +3 V) ist logisch 0. In Ruhe liegt die Leitung auf −${volt} V. Du misst nacheinander je Bitzeit diese Pegel in Volt: ${lv().map(pm).join(', ')}. Der Rahmen ist 8N1, das niederwertigste Datenbit kommt zuerst. Welchen Pegel hat das Startbit? Schreibe die acht Datenbits als logische Werte in Sendereihenfolge auf und gib das Byte als Hexwert an.`,
      fields: [CH('start', 'Pegel des Startbits', [{ v: 'pos', t: 'positiv' }, { v: 'neg', t: 'negativ' }]), S('bits', 'Datenbits in Sendereihenfolge', { ph: '8 Bit' }), HX('byte', 'Byte (hex)')],
      sol: () => { const d = K().rs232Decode(lv()); return { start: lv()[0] > 0 ? 'pos' : 'neg', bits: d.data.join(''), byte: d.byte }; },
      steps: s => { const d = K().rs232Decode(lv()); return [`Der erste Pegel (${pm(lv()[0])} V) ist das Startbit: positiv, also logisch 0. Der letzte (${pm(lv()[9])} V) ist das Stoppbit: negativ, also logisch 1.`, `Die acht Pegel dazwischen übersetzt du einzeln (negativ = 1, positiv = 0): ${s.bits}`, `Das erste Bit ist das niederwertigste. Rückwärts gelesen: ${K().bin(d.byte, 8)} = ${hx(d.byte)}`, 'Ein Pegelwandler-Baustein zwischen Leitung und Controller dreht die Pegel und setzt sie auf die Logikpegel des Controllers um.']; },
      hint: s => ['Übersetze zuerst jeden Pegel in 0 oder 1: negativ ist 1, positiv ist 0.', 'Der erste Wert ist das Startbit, der letzte das Stoppbit. Dazwischen stehen die Datenbits mit dem niederwertigsten zuerst.', `Die Datenbits in Sendereihenfolge sind ${s.bits}. Drehe die Reihenfolge um und lies den Hexwert ab.`] }; });
  reg(() => { const idA = 0x2B4, idB = 0x2A7, nb = 11;
    return { id: 'b17', block: 'bus', title: 'CAN: Wer gewinnt die Arbitrierung?', level: 2,
      text: `Zwei CAN-Knoten beginnen gleichzeitig zu senden. Knoten A sendet den Identifier ${hx(idA, 3)}, Knoten B den Identifier ${hx(idB, 3)} (${nb} Bit, höchstwertiges Bit zuerst). Eine 0 ist dominant, eine 1 rezessiv: Sendet ein Knoten eine 1 und liest eine 0 zurück, hört er sofort auf zu senden. Welcher Knoten gewinnt die Arbitrierung, beim wievielten Identifier-Bit fällt die Entscheidung (das erste gesendete Bit hat die Nummer 1), und welchen Pegel hat der Bus in diesem Bit?`,
      fields: [CH('win', 'Gewinner', [{ v: 'A', t: 'Knoten A' }, { v: 'B', t: 'Knoten B' }]), NI('pos', 'Bitnummer der Entscheidung', ''), CH('lvl', 'Buspegel in diesem Bit', [{ v: 'dom', t: 'dominant (0)' }, { v: 'rez', t: 'rezessiv (1)' }])],
      sol: () => { const r = K().canArbitrate([idA, idB], nb); return { win: ['A', 'B'][r.winner], pos: r.decided, lvl: r.bus[r.decided - 1] === 0 ? 'dom' : 'rez' }; },
      steps: s => { const lose = s.win === 'A' ? 'B' : 'A'; return [`A: ${hx(idA, 3)} = ${K().bin(idA, nb)}`, `B: ${hx(idB, 3)} = ${K().bin(idB, nb)}`, `Die ersten ${s.pos - 1} Bits sind gleich, beide senden weiter. Im Bit ${s.pos} sendet ${lose} eine 1 und ${s.win} eine 0.`, `Die 0 setzt sich durch, der Bus ist dominant. ${lose} liest eine 0 zurück und hört auf, ${s.win} sendet ungestört weiter.`, `Merke: Der kleinere Identifier gewinnt (${hx(Math.min(idA, idB), 3)} ist kleiner als ${hx(Math.max(idA, idB), 3)}). Dabei geht keine Nachricht kaputt, der Verlierer sendet später noch einmal.`]; },
      hint: s => ['Schreibe beide Identifier binär untereinander und vergleiche von links.', 'Entscheidend ist das erste Bit, in dem sich beide unterscheiden. Dort gewinnt der Knoten mit der 0.', `Die ersten ${s.pos - 1} Bits sind gleich.`] }; });
  reg(() => { const seq = '0111110000111111';
    const grp = x => x.replace(/(.{4})(?=.)/g, '$1 ');
    return { id: 'b18', block: 'bus', title: 'CAN: Stopfbits zählen', level: 3,
      text: `CAN fügt nach fünf gleichen Bits in Folge ein Stopfbit mit dem entgegengesetzten Wert ein, damit die Empfänger genug Flanken zum Nachsynchronisieren sehen. Das Stopfbit zählt für die nächste Folge mit. Gesendet werden soll die Bitfolge ${grp(seq)} (${seq.length} Bit, von links nach rechts). Wie viele Stopfbits kommen dazu, wie viele Bits liegen dann auf dem Bus, und wie sieht die Bitfolge auf dem Bus aus?`,
      fields: [NI('n', 'Stopfbits', ''), NI('len', 'Bits auf dem Bus', ''), S('out', 'Bitfolge auf dem Bus', { ph: 'Bitfolge' })],
      sol: () => { const r = K().canStuff(seq); return { n: r.n, len: r.len, out: r.out }; },
      steps: s => K().canStuff(seq).ev.map((e, i) => `Stopfbit ${i + 1}: Nach dem ${e.after}. Bit der Vorgabe liegen fünf gleiche Bits hintereinander auf dem Bus, es folgt eine ${e.val}.`).concat(['Achtung: Ein Stopfbit zählt selbst mit. Folgen ihm vier gleiche Bits, sind das wieder fünf in Folge, und es kommt das nächste Stopfbit.', `Anzahl der Stopfbits: ${s.n}. Auf dem Bus liegen ${seq.length} + ${s.n} = ${s.len} Bit: ${grp(s.out)}`]),
      hint: s => ['Gehe die Folge Bit für Bit durch und zähle, wie viele gleiche Bits gerade hintereinander liegen.', 'Nach dem fünften gleichen Bit schreibst du das Gegenteil dazu und zählst mit diesem Bit neu ab 1.', `Das erste Stopfbit ist eine ${K().canStuff(seq).ev[0].val} nach dem ${K().canStuff(seq).ev[0].after}. Bit.`] }; });
  reg(() => { const rate = 250e3, sp = 0.75, tnode = 200e-9, tprop = 5e-9, rate2 = 1e6;
    return { id: 'b19', block: 'bus', title: 'CAN: Bitzeit und Buslänge', level: 3,
      text: `Bei CAN müssen alle Knoten dasselbe Bit gleichzeitig sehen. Vereinfachte Regel: Bis zum Abtastpunkt (hier bei ${sg(sp * 100)} % der Bitzeit) muss ein Signal einmal hin und zurück gelaufen sein, also 2 · (Kabellaufzeit + Knotenverzögerung). Das Kabel braucht ${sg(tprop * 1e9)} ns je Meter, die Knotenverzögerung (Sender und Empfänger zusammen) beträgt je Richtung ${sg(tnode * 1e9)} ns. Wie lang ist ein Bit bei ${sg(rate / 1e3)} kBit/s? Wie lang darf der Bus bei ${sg(rate / 1e3)} kBit/s und wie lang bei ${sg(rate2 / 1e6)} MBit/s höchstens sein?`,
      fields: [N('tbit', `Bitzeit bei ${sg(rate / 1e3)} kBit/s`, 'µs'), N('l1', `größte Länge bei ${sg(rate / 1e3)} kBit/s`, 'm'), N('l2', `größte Länge bei ${sg(rate2 / 1e6)} MBit/s`, 'm')],
      sol: () => ({ tbit: K().canBitTime(rate) * 1e6, l1: K().canMaxLen(rate, sp, tnode, tprop), l2: K().canMaxLen(rate2, sp, tnode, tprop) }),
      steps: s => { const ts = r => sp * K().canBitTime(r) * 1e9; return [`Bitzeit = 1 / ${sg(rate / 1e3)} kBit/s = ${sg(s.tbit)} µs`, `Zeit bis zum Abtastpunkt = ${sg(sp * 100)} % · ${sg(s.tbit)} µs = ${sg(ts(rate))} ns`, `Je Richtung bleibt die Hälfte: ${sg(ts(rate) / 2)} ns. Davon gehen ${sg(tnode * 1e9)} ns an die Knoten, für das Kabel bleiben ${sg(ts(rate) / 2 - tnode * 1e9)} ns.`, `Länge = ${sg(ts(rate) / 2 - tnode * 1e9)} ns / ${sg(tprop * 1e9)} ns/m = ${sg(s.l1)} m`, `${sg(rate2 / 1e6)} MBit/s: Bitzeit ${sg(K().canBitTime(rate2) * 1e9)} ns, bis zum Abtastpunkt ${sg(ts(rate2))} ns, je Richtung ${sg(ts(rate2) / 2)} ns, für das Kabel ${sg(ts(rate2) / 2 - tnode * 1e9)} ns, also ${sg(s.l2)} m`]; },
      hint: s => ['Je höher die Bitrate, desto kürzer das Bit und desto weniger Zeit bleibt für den Weg über das Kabel.', 'Zeit bis zum Abtastpunkt ausrechnen, halbieren (hin und zurück), die Knotenverzögerung abziehen, durch die Laufzeit je Meter teilen.', `Ein Bit dauert ${sg(s.tbit)} µs, bis zum Abtastpunkt sind es ${sg(sp * s.tbit)} µs.`] }; });
  reg(() => { const vhi = 5, voh = 4.2, r1 = 4700, r2 = 8200, vih = 2, vmax = 3.6, r1b = 10000, r2b = 6800;
    return { id: 'b20', block: 'bus', title: 'Pegelanpassung 5 V auf 3,3 V mit Teiler', level: 2,
      text: `Ein 5-V-Controller sendet per UART an einen 3,3-V-Baustein. Dazwischen sitzt ein Spannungsteiler: R1 = ${sg(r1 / 1e3)} kΩ in der Leitung, R2 = ${sg(r2 / 1e3)} kΩ vom Eingang nach Masse. Der Eingang erkennt High sicher ab ${sg(vih)} V und verträgt höchstens ${sg(vmax)} V. Der Sender liefert bei High ${sg(vhi)} V, im ungünstigsten Fall nur ${sg(voh)} V. Welche Spannung liegt am Eingang bei ${sg(vhi)} V und welche bei ${sg(voh)} V, und sind damit beide Grenzen eingehalten? Ein zweiter Vorschlag nimmt R1 = ${sg(r1b / 1e3)} kΩ und R2 = ${sg(r2b / 1e3)} kΩ: Welche Spannung ergibt sich damit bei ${sg(voh)} V, und reicht das für ein sicheres High?`,
      fields: [N('v5', `Teiler 1 bei ${sg(vhi)} V`, 'V'), N('v42', `Teiler 1 bei ${sg(voh)} V`, 'V'), CH('ok1', 'Teiler 1: beide Grenzen eingehalten?', JN), N('valt', `Teiler 2 bei ${sg(voh)} V`, 'V'), CH('ok2', 'Teiler 2: High sicher erkannt?', JN)],
      sol: () => { const a = K().dividerOut(vhi, r1, r2), b = K().dividerOut(voh, r1, r2), c = K().dividerOut(voh, r1b, r2b); return { v5: a, v42: b, ok1: a <= vmax && b >= vih ? 'ja' : 'nein', valt: c, ok2: c >= vih ? 'ja' : 'nein' }; },
      steps: s => [`Teiler 1: U = U_Sender · R2 / (R1 + R2) = ${sg(vhi)} V · ${sg(r2 / 1e3)} / ${sg((r1 + r2) / 1e3)} = ${sg(s.v5, 4)} V. Das liegt unter ${sg(vmax)} V: Der Eingang wird nicht überlastet.`, `Bei ${sg(voh)} V: ${sg(voh)} V · ${sg(r2 / 1e3)} / ${sg((r1 + r2) / 1e3)} = ${sg(s.v42, 4)} V. Das liegt über ${sg(vih)} V: High wird sicher erkannt. Beide Grenzen sind ${s.ok1 === 'ja' ? 'eingehalten' : 'nicht eingehalten'}.`, `Teiler 2: ${sg(voh)} V · ${sg(r2b / 1e3)} / ${sg((r1b + r2b) / 1e3)} = ${sg(s.valt, 4)} V. Das liegt ${s.ok2 === 'ja' ? 'über' : 'unter'} ${sg(vih)} V: High wird ${s.ok2 === 'ja' ? 'sicher' : 'nicht sicher'} erkannt.`, 'Ein Teiler passt nur für eine Richtung und für mäßige Baudraten, weil er mit der Eingangskapazität einen Tiefpass bildet.'],
      hint: s => ['Der Teiler verkleinert jede Spannung um denselben Faktor. Rechne den Faktor einmal aus.', 'U_Eingang = U_Sender · R2 / (R1 + R2). Prüfe die größte Spannung gegen die Obergrenze und die kleinste gegen die High-Schwelle.', `Teiler 1 liefert bei ${sg(vhi)} V etwa ${sg(s.v5, 3)} V.`] }; });

  /* =========================================================  Block 4: Zustandsautomaten  ========================================================= */
  const MOORE_A = { type: 'moore', name: 'Moore-Automat', states: ['A', 'B', 'C'], inputs: ['0', '1'], init: 'A', next: { A: { '0': 'A', '1': 'B' }, B: { '0': 'C', '1': 'B' }, C: { '0': 'A', '1': 'B' } }, out: { A: '0', B: '0', C: '1' } };
  const MEALY_A = { type: 'mealy', name: 'Mealy-Automat', states: ['P', 'Q'], inputs: ['0', '1'], init: 'P', next: { P: { '0': 'P', '1': 'Q' }, Q: { '0': 'P', '1': 'Q' } }, out: { P: { '0': '0', '1': '0' }, Q: { '0': '1', '1': '0' } } };
  const tabOf = f => {
    const head = f.type === 'moore' ? ['Zustand', 'Eingang 0 →', 'Eingang 1 →', 'Ausgang'] : ['Zustand', 'bei 0: Folge / Ausgang', 'bei 1: Folge / Ausgang'];
    const rows = f.states.map(s => f.type === 'moore' ? [s, f.next[s]['0'] || '?', f.next[s]['1'] || '?', f.out[s]] : [s, (f.next[s]['0'] || '?') + ' / ' + (f.out[s] && f.out[s]['0']), (f.next[s]['1'] || '?') + ' / ' + (f.out[s] && f.out[s]['1'])]);
    return { head, rows, cap: f.name + ', Startzustand ' + f.init };
  };
  reg(() => { const seq = '100110';
    return { id: 'embf1', block: 'fsm', title: 'Moore-Automat durchlaufen', level: 1,
      text: `Der Moore-Automat aus der Tabelle startet in Zustand A. Der Ausgang gehört zum Zustand. Die Eingangsfolge ${seq.split('').join(' ')} wird Takt für Takt eingelesen. Gib die Ausgangsfolge (ein Zeichen je Takt, nach dem Zustandswechsel) und den Endzustand an.`,
      table: tabOf(MOORE_A), scene: { type: 'fsm', fsm: MOORE_A, input: seq },
      fields: [S('outs', 'Ausgangsfolge', { ph: 'z. B. 0101' }), S('final', 'Endzustand')],
      sol: () => { const r = K().fsmRun(MOORE_A, seq); return { outs: r.outs.join(''), final: r.final }; },
      steps: s => { const r = K().fsmRun(MOORE_A, seq); return r.inputs.map((x, i) => `Takt ${i + 1}: Eingang ${x}: ${r.states[i]} → ${r.states[i + 1]}, Ausgang ${r.outs[i]}`).concat([`Ausgangsfolge ${s.outs}, Endzustand ${s.final}. (Der Automat meldet 1, wenn zuletzt „1 0“ kam.)`]); },
      hint: s => ['Führe einen Finger über die Tabelle: aktueller Zustand und Eingang ergeben den nächsten Zustand.', 'Der Ausgang wird aus dem neuen Zustand gelesen.', `Der Endzustand ist ${s.final}; die Ausgangsfolge hat ${seq.length} Zeichen.`] }; });
  reg(() => { const seq = '110100110';
    return { id: 'embf2', block: 'fsm', title: 'Mealy-Automat durchlaufen', level: 1,
      text: `Der Mealy-Automat der Tabelle startet in Zustand P. Der Ausgang gehört zur Kante (Zustand und aktueller Eingang). Eingangsfolge ${seq.split('').join(' ')}. Gib die Ausgangsfolge und den Endzustand an.`,
      table: tabOf(MEALY_A), scene: { type: 'fsm', fsm: MEALY_A, input: seq },
      fields: [S('outs', 'Ausgangsfolge'), S('final', 'Endzustand')],
      sol: () => { const r = K().fsmRun(MEALY_A, seq); return { outs: r.outs.join(''), final: r.final }; },
      steps: s => { const r = K().fsmRun(MEALY_A, seq); return r.inputs.map((x, i) => `Takt ${i + 1}: Zustand ${r.states[i]}, Eingang ${x} → Folgezustand ${r.states[i + 1]}, Ausgang ${r.outs[i]}`).concat([`Ausgangsfolge ${s.outs}, Endzustand ${s.final}. Das ist derselbe Detektor („1 0“) wie in der Moore-Aufgabe, aber mit zwei statt drei Zuständen.`]); },
      hint: s => ['Zustand und Eingang wählen eine Zelle der Tabelle. Dort steht Folgezustand und Ausgang.', 'Der Ausgang entsteht in dem Takt, in dem der Eingang anliegt.', `Endzustand ${s.final}.`] }; });
  reg(() => { const pat = '1101';
    return { id: 'embf3', block: 'fsm', title: 'Zustände eines Sequenzdetektors', level: 2,
      text: `Ein überlappender Sequenzdetektor soll das Muster ${pat} im Bitstrom erkennen. Wie viele Zustände braucht eine Mealy-Version, wie viele eine Moore-Version, und wie viele Flipflops braucht man jeweils mindestens?`,
      fields: [NI('nMealy', 'Zustände Mealy', ''), NI('nMoore', 'Zustände Moore', ''), NI('ffMealy', 'Flipflops Mealy', ''), NI('ffMoore', 'Flipflops Moore', '')],
      sol: () => { const a = K().seqDetector(pat, 'mealy'), b = K().seqDetector(pat, 'moore'); return { nMealy: a.states.length, nMoore: b.states.length, ffMealy: K().ffCount(a.states.length), ffMoore: K().ffCount(b.states.length) }; },
      steps: s => [`Der Zustand merkt sich, wie viele Zeichen vom Muster gerade passen: 0 bis ${pat.length - 1} (Mealy: ${s.nMealy} Zustände).`, `Moore braucht zusätzlich einen Zustand, dessen Ausgang 1 ist: ${s.nMoore} Zustände.`, `Flipflops = ⌈log₂ n⌉: Mealy ⌈log₂ ${s.nMealy}⌉ = ${s.ffMealy}, Moore ⌈log₂ ${s.nMoore}⌉ = ${s.ffMoore}`],
      hint: s => ['Beim Mealy-Detektor ist der „vollständig erkannt“-Zustand nicht nötig: Die 1 wird auf der Kante ausgegeben.', 'Mealy: Musterlänge. Moore: eine mehr. Flipflops: kleinste Zahl mit 2^k ≥ Zustände.', `Mealy ${s.nMealy}, Moore ${s.nMoore} Zustände.`] }; });
  reg(() => { const pat = '1011', seq = '11011011011';
    return { id: 'embf4', block: 'fsm', title: 'Überlappende Erkennung', level: 2,
      text: `Ein Mealy-Detektor für ${pat} (überlappend: Ein Treffer darf der Anfang des nächsten sein) bekommt den Eingang ${seq}. Gib die Ausgangsfolge an und die Zahl der erkannten Muster.`,
      scene: { type: 'fsm', fsm: K().seqDetector(pat, 'mealy'), input: seq }, table: tabOf(K().seqDetector(pat, 'mealy')),
      fields: [S('outs', 'Ausgangsfolge'), NI('n', 'erkannte Muster', '')],
      sol: () => { const r = K().fsmRun(K().seqDetector(pat, 'mealy'), seq); return { outs: r.outs.join(''), n: r.outs.filter(x => x === '1').length }; },
      steps: s => { const r = K().fsmRun(K().seqDetector(pat, 'mealy'), seq); return r.inputs.map((x, i) => `Eingang ${x}: ${r.states[i]} → ${r.states[i + 1]}, Ausgang ${r.outs[i]}`).concat([`${s.n} Treffer, Ausgangsfolge ${s.outs}.`]); },
      hint: s => ['Suche das Muster im Eingang. Treffer dürfen sich überlappen: Das letzte Bit eines Treffers kann das erste des nächsten sein.', 'Die Tabelle des Automaten führt das automatisch aus. Folge ihr Schritt für Schritt.', `Es gibt ${s.n} Treffer.`] }; });
  reg(() => { const f = { type: 'moore', name: 'fehlerhafte Tabelle', states: ['A', 'B', 'C', 'D'], inputs: ['0', '1'], init: 'A', next: { A: { '0': 'A', '1': 'B' }, B: { '0': 'C' }, C: { '0': 'C', '1': 'A' }, D: { '0': 'D', '1': 'A' } }, out: { A: '0', B: '0', C: '1', D: '0' } };
    return { id: 'embf5', block: 'fsm', title: 'Fehler in der Zustandstabelle finden', level: 3,
      text: 'Die Tabelle eines Moore-Automaten (Start in A) ist fehlerhaft. Welche Zelle ist nicht ausgefüllt (Zustand/Eingang), und welcher Zustand ist nie erreichbar?',
      table: tabOf(Object.assign({}, f, { next: Object.assign({}, f.next, { B: { '0': 'C', '1': undefined } }) })),
      fields: [S('miss', 'fehlende Zelle', { ph: 'z. B. A/1' }), S('unr', 'unerreichbarer Zustand')],
      sol: () => { const r = K().fsmCheck(f); return { miss: r.undef[0], unr: r.unreachable.join('') }; },
      steps: s => [`Jede Zeile braucht für jeden Eingang einen Folgezustand: Bei ${s.miss} fehlt er.`, `Erreichbarkeit vom Start A aus: A → B (bei 1), B → C, C → A. D kommt in keiner Zelle als Ziel vor, ist also unerreichbar (${s.unr}).`],
      hint: s => ['Zwei Prüfungen: Ist jede Zelle gefüllt? Taucht jeder Zustand irgendwo als Ziel auf (und ist vom Start erreichbar)?', 'Suche die Zeile mit der Lücke und die Spalte, in der ein Buchstabe nie vorkommt.', `Der unerreichbare Zustand ist ${s.unr}.`] }; });
  reg(() => { const raw = '0001011011111111', Nn = 3;
    return { id: 'embf6', block: 'fsm', title: 'Taster entprellen im Takt', level: 2,
      text: `Ein Taster wird jede Millisekunde abgetastet. Der entprellte Ausgang schaltet erst um, wenn ${Nn} Proben in Folge vom bisherigen Wert abweichen. Anfang: Ausgang 0. Abtastwerte: ${raw}. Gib die Ausgangsfolge an und die Nummer der Probe (ab 0), bei der der Ausgang zum ersten Mal 1 wird.`,
      scene: { type: 'debounce', raw, n: Nn },
      fields: [S('out', 'entprellte Folge'), NI('first', 'erste Probe mit Ausgang 1', '')],
      sol: () => { const o = K().debounceRun(raw, Nn, 0); return { out: o.join(''), first: o.indexOf(1) }; },
      steps: s => [`Zähler: zählt Proben, die vom Ausgang abweichen; jede gleiche Probe setzt ihn auf 0.`, `Die Einsen bei Probe 3, 5, 6 werden von Nullen unterbrochen und schalten nicht um. Ab Probe 8 kommen ${Nn} Einsen in Folge: Der Ausgang wird bei Probe ${s.first} 1.`, `Ausgang: ${s.out}`],
      hint: s => ['Zähle bei jeder Probe mit, wie viele aufeinanderfolgende vom bisherigen Ausgang abweichen.', 'Ein Zurückfallen auf den alten Wert setzt den Zähler zurück.', `Der Ausgang ändert sich nur einmal.`] }; });
  reg(() => { const tb = 5, ts = 2;
    return { id: 'embf7', block: 'fsm', title: 'Entprell-Schwelle bestimmen', level: 2,
      text: `Der Taster prellt bis zu ${tb} ms. Die Abtastperiode ist ${ts} ms. Wie groß muss die Schwelle N (gleiche Proben in Folge) mindestens sein, damit N · Abtastperiode größer ist als die Prellzeit, und wie groß ist dann die Verzögerung?`,
      fields: [NI('n', 'Schwelle N', ''), N('lat', 'Verzögerung', 'ms')],
      sol: () => { const n = K().debounceN(tb, ts); return { n, lat: n * ts }; },
      steps: s => [`N · ${ts} ms > ${tb} ms → N > ${sg(tb / ts)} → kleinste ganze Zahl: N = ${s.n}`, `Verzögerung = N · T = ${s.n} · ${ts} ms = ${sg(s.lat)} ms (Faustregel; wer ganz sicher gehen will, verlangt (N − 1) · T ≥ Prellzeit, hier N = ${Math.ceil(tb / ts) + 1})`],
      hint: s => ['Die Proben in Folge müssen länger dauern als das Prellen.', `${tb} ms geteilt durch ${ts} ms.`, `Aufrunden auf die nächste ganze Zahl über dem Quotienten: N = ${s.n}.`] }; });
  const PH1 = [{ n: 'Rot', dur: 10 }, { n: 'Rot-Gelb', dur: 2 }, { n: 'Grün', dur: 8 }, { n: 'Gelb', dur: 3 }];
  reg(() => { const tt = 100;
    return { id: 'embf8', block: 'fsm', title: 'Ampel: Zykluszeit und Zustand', level: 1,
      text: `Eine Ampel läuft in der Folge Rot (10 s), Rot-Gelb (2 s), Grün (8 s), Gelb (3 s) und beginnt dann von vorn. Wie lang ist ein Zyklus? In welcher Phase ist sie ${tt} s nach dem Start (Start: Beginn von Rot)? Welchen Anteil der Zeit zeigt sie Grün?`,
      table: { head: ['Phase', 'Dauer'], rows: PH1.map(p => [p.n, p.dur + ' s']), cap: 'Ampelphasen' },
      fields: [N('cyc', 'Zykluszeit', 's'), CH('st', 'Phase bei 100 s', PH1.map(p => ({ v: p.n, t: p.n }))), N('share', 'Grünanteil', '%')],
      sol: () => ({ cyc: K().cycleTime(PH1), st: K().phaseAt(PH1, tt).phase.n, share: K().greenShare(PH1.map(p => ({ g: p.n === 'Grün' ? 'G' : 'x', dur: p.dur })), 'g') * 100 }),
      steps: s => [`Zyklus = 10 + 2 + 8 + 3 = ${s.cyc} s`, `${tt} s mod ${s.cyc} s = ${tt % s.cyc} s im aktuellen Zyklus → Phase ${s.st} (Rot geht 0 bis 10 s)`, `Grünanteil = 8 s / ${s.cyc} s = ${sg(s.share, 4)} %`],
      hint: s => ['Zyklusfrage: Teile die Zeit durch die Zykluslänge, es zählt der Rest.', `Rest = ${tt} mod ${s.cyc}. Dann die Phasen der Reihe nach abziehen.`, `Der Rest ist ${tt % s.cyc} s: Ziehe die Phasendauern der Reihe nach ab, bis der Rest kleiner als die aktuelle Phase ist.`] }; });
  const XR = [{ ns: 'G', ew: 'R', dur: 20 }, { ns: 'Y', ew: 'R', dur: 3 }, { ns: 'R', ew: 'R', dur: 2 }, { ns: 'R', ew: 'G', dur: 15 }, { ns: 'R', ew: 'Y', dur: 3 }, { ns: 'R', ew: 'R', dur: 2 }];
  const COL = { G: 'Grün', Y: 'Gelb', R: 'Rot' };
  reg(() => ({ id: 'embf9', block: 'fsm', title: 'Kreuzung: Zykluszeit und Sicherheit', level: 2,
    text: 'Eine Kreuzung hat zwei Richtungen (Nord-Süd, Ost-West) und sechs Phasen. Wie lang ist ein Zyklus, welchen Anteil hat Nord-Süd-Grün, und ist die Steuerung sicher (nie beide Richtungen gleichzeitig nicht Rot)?',
    table: { head: ['Phase', 'Nord-Süd', 'Ost-West', 'Dauer'], rows: XR.map((p, i) => [String(i + 1), COL[p.ns], COL[p.ew], p.dur + ' s']), cap: 'Phasenfolge' },
    scene: { type: 'cross', phases: XR },
    fields: [N('cyc', 'Zykluszeit', 's'), N('share', 'Nord-Süd-Grünanteil', '%'), CH('safe', 'sicher?', JN)],
    sol: () => ({ cyc: K().cycleTime(XR), share: K().greenShare(XR, 'ns') * 100, safe: K().phaseConflicts(XR).length ? 'nein' : 'ja' }),
    steps: s => [`Zyklus = 20 + 3 + 2 + 15 + 3 + 2 = ${s.cyc} s`, `Grün Nord-Süd = 20 s → 20 / ${s.cyc} = ${sg(s.share, 4)} %`, `Sicherheit: Prüfe jede Phase. In keiner ist Nord-Süd und Ost-West gleichzeitig nicht Rot. Zwischen den Richtungen liegt jeweils eine Alles-Rot-Phase (Phase 3 und 6) → ${s.safe === 'ja' ? 'sicher' : 'nicht sicher'}`],
    hint: s => ['Addiere alle Dauern. Für die Sicherheit: Suche eine Zeile, in der beide Spalten nicht Rot sind.', 'Nord-Süd-Grün steht nur in Phase 1.', `Der Zyklus dauert ${s.cyc} s.`] }));
  const XB = [{ ns: 'G', ew: 'R', dur: 20 }, { ns: 'Y', ew: 'G', dur: 3 }, { ns: 'R', ew: 'G', dur: 15 }, { ns: 'R', ew: 'Y', dur: 3 }, { ns: 'G', ew: 'Y', dur: 2 }, { ns: 'R', ew: 'R', dur: 2 }];
  reg(() => ({ id: 'embf10', block: 'fsm', title: 'Kreuzung: Konflikt in der Phasentabelle', level: 3,
    text: 'Eine überarbeitete Phasenfolge soll Zeit sparen und lässt die Alles-Rot-Phasen zwischen den Richtungswechseln weg (nur am Ende der Folge bleibt eine). Finde die Phasen, in denen beide Richtungen gleichzeitig nicht Rot haben. Wie viele sind es, und welche Nummer hat die erste?',
    table: { head: ['Phase', 'Nord-Süd', 'Ost-West', 'Dauer'], rows: XB.map((p, i) => [String(i + 1), COL[p.ns], COL[p.ew], p.dur + ' s']), cap: 'Phasenfolge (fehlerhaft)' },
    scene: { type: 'cross', phases: XB },
    fields: [NI('n', 'Anzahl der Konflikt-Phasen', ''), NI('first', 'Nummer der ersten', '')],
    sol: () => { const c = K().phaseConflicts(XB); return { n: c.length, first: c[0] }; },
    steps: s => { const c = K().phaseConflicts(XB); return c.map(i => `Phase ${i}: Nord-Süd ${COL[XB[i - 1].ns]}, Ost-West ${COL[XB[i - 1].ew]} → beide nicht Rot: Konflikt`).concat([`${s.n} Konflikte, der erste in Phase ${s.first}. Abhilfe: Zwischen die Richtungen wieder eine Alles-Rot-Phase einfügen.`]); },
    hint: s => ['Gehe die Phasen einzeln durch und prüfe: Sind beide Spalten ungleich Rot?', 'Gelb zählt als „nicht Rot“.', `Es sind ${s.n} Phasen betroffen.`] }));

  /* =========================================================  Block 5: Speicher und Echtzeit  ========================================================= */
  reg(() => { const ram = 2048, da = 180, bs = 420, hp = 600;
    return { id: 'embm1', block: 'mem', title: 'RAM-Plan: Platz für den Stack', level: 1,
      text: `Ein Controller hat ${ram} Byte RAM. Die Daten (.data) belegen ${da} Byte, .bss ${bs} Byte, der Heap derzeit ${hp} Byte. Wie viel Platz bleibt für den Stack (zwischen Heap-Ende und RAM-Ende), und wie viel Prozent des RAM sind das?`,
      scene: { type: 'ram', ram, data: da, bss: bs, heap: hp, frame: 12 },
      fields: [NI('free', 'frei', 'Byte'), N('pct', 'Anteil am RAM', '%')],
      sol: () => { const fr = K().ramFree(ram, da, bs, hp); return { free: fr, pct: fr / ram * 100 }; },
      steps: s => [`frei = ${ram} − ${da} − ${bs} − ${hp} = ${s.free} Byte`, `Anteil = ${s.free} / ${ram} = ${sg(s.pct, 4)} %`],
      hint: s => ['Alles Belegte von unten abziehen. Der Rest ist der Platz, in dem der Stack wachsen darf.', `${ram} minus ${da}, ${bs}, ${hp}.`, `Es bleiben ${s.free} Byte.`] }; });
  reg(() => { const free = 848, res = 100, ret = 2, regs = 4, loc = 6;
    return { id: 'embm2', block: 'mem', title: 'Rekursionstiefe', level: 2,
      text: `Von den ${free} Byte freiem RAM werden ${res} Byte für Interrupts und Hauptprogramm reserviert. Eine rekursive Funktion legt je Aufruf ${ret} Byte Rücksprungadresse, ${regs} Byte gesicherte Register und ${loc} Byte lokale Variablen auf den Stack. Wie groß ist ein Rahmen, und wie tief darf die Rekursion höchstens gehen?`,
      fields: [NI('frame', 'Rahmen je Aufruf', 'Byte'), NI('depth', 'maximale Tiefe', 'Aufrufe')],
      sol: () => { const fr = K().frameBytes({ ret, regs, locals: loc }); return { frame: fr, depth: K().maxDepth(free - res, fr) }; },
      steps: s => [`Rahmen = ${ret} + ${regs} + ${loc} = ${s.frame} Byte`, `Nutzbar = ${free} − ${res} = ${free - res} Byte`, `Tiefe = ⌊${free - res} / ${s.frame}⌋ = ${s.depth}`],
      hint: s => ['Erst die Größe eines Rahmens, dann wie oft er in den nutzbaren Platz passt (abrunden).', `Nutzbar: ${free - res} Byte.`, `Ein Rahmen hat ${s.frame} Byte.`] }; });
  reg(() => { const chain = [12, 20, 8], isr = 17, res = 100;
    return { id: 'embm3', block: 'mem', title: 'Stack im ungünstigsten Fall', level: 2,
      text: `Das Hauptprogramm ruft main → f → g auf; die Rahmen sind ${chain.join(', ')} Byte. Unterbricht eine ISR (${isr} Byte für Rücksprung und gesicherte Register) und wird selbst von einer zweiten ISR gleicher Größe unterbrochen, wie viel Stack wird im schlimmsten Fall belegt? Reicht eine Reserve von ${res} Byte?`,
      fields: [NI('total', 'Stack im schlimmsten Fall', 'Byte'), CH('fits', 'Reserve reicht?', JN)],
      sol: () => { const t = K().stackWorst(chain.concat([isr, isr])); return { total: t, fits: t <= res ? 'ja' : 'nein' }; },
      steps: s => [`Aufrufkette: ${chain.join(' + ')} = ${K().stackWorst(chain)} Byte`, `plus zwei verschachtelte ISRs: 2 · ${isr} = ${2 * isr} Byte`, `Summe = ${s.total} Byte; Reserve ${res} Byte → ${s.fits === 'ja' ? 'reicht' : 'reicht nicht'}`],
      hint: s => ['Der schlimmste Fall: tiefster Aufrufbaum, und beide ISRs liegen noch obendrauf.', 'Alle Beiträge addieren.', `Summe ${s.total} Byte.`] }; });
  const HOPS = [{ op: 'a', id: 'A', n: 16 }, { op: 'a', id: 'B', n: 16 }, { op: 'a', id: 'C', n: 16 }, { op: 'a', id: 'D', n: 16 }, { op: 'f', id: 'B' }, { op: 'f', id: 'D' }];
  reg(() => ({ id: 'embm4', block: 'mem', title: 'Heap-Fragmentierung', level: 3,
    text: 'Ein Heap hat 64 Byte. Nacheinander werden A, B, C, D mit je 16 Byte angefordert (Erstanpassung: erster passender freier Block). Dann werden B und D freigegeben. Wie viel Heap ist insgesamt frei, wie groß ist der größte zusammenhängende freie Block, und gelingt jetzt malloc(24)? Wie groß ist der größte freie Block, wenn danach auch C freigegeben wird?',
    scene: { type: 'heap', size: 64, ops: HOPS },
    fields: [NI('total', 'frei gesamt', 'Byte'), NI('largest', 'größter freier Block', 'Byte'), CH('ok', 'malloc(24) gelingt?', JN), NI('after', 'größter Block nach free(C)', 'Byte')],
    sol: () => { const r = K().heapSim(64, HOPS), t = K().heapSim(64, HOPS.concat([{ op: 'a', id: 'E', n: 24 }])), a = K().heapSim(64, HOPS.concat([{ op: 'f', id: 'C' }])); return { total: r.totalFree, largest: r.largest, ok: t.fails.length ? 'nein' : 'ja', after: a.largest }; },
    steps: s => ['Belegung: A 0–15, B 16–31, C 32–47, D 48–63 (alles voll).', 'Freigabe B: Loch 16–31; Freigabe D: Loch 48–63. Die Löcher berühren sich nicht (C liegt dazwischen).', `Frei gesamt ${s.total} Byte, größter Block ${s.largest} Byte → malloc(24) ${s.ok === 'ja' ? 'gelingt' : 'scheitert'}, obwohl insgesamt genug da wäre.`, `Nach free(C) verschmelzen 16–31, 32–47 und 48–63 zu einem Block von ${s.after} Byte.`],
    hint: s => ['Zeichne die vier Blöcke nebeneinander und streiche die freigegebenen.', 'Benachbarte freie Blöcke verschmelzen; getrennte nicht.', `Der größte Block ist ${s.largest} Byte groß.`] }));
  reg(() => { const v = 0x00FF, inc = 1, inc4 = 4;
    return { id: 'embm5', block: 'mem', title: 'Zerrissener 16-Bit-Zähler', level: 3,
      text: `Ein 16-Bit-Zähler wird in einer ISR um 1 erhöht. Das Hauptprogramm liest ihn auf einem 8-Bit-Controller in zwei Zugriffen (erst niederwertiges, dann höherwertiges Byte). Der Zähler steht auf ${hx(v, 4)}. Genau zwischen den beiden Lesezugriffen schlägt die ISR zu. Welchen Wert liest das Hauptprogramm (dezimal), und um wie viel liegt er über dem Stand vor der ISR? Bei wie viel Prozent aller möglichen Zählerstände geht das schief, wenn die ISR um 1 erhöht, bei wie viel, wenn sie um 4 erhöht?`,
      scene: { type: 'torn', v, inc },
      fields: [NI('read', 'gelesener Wert', ''), NI('err', 'Abweichung vom Stand vor der ISR', ''), N('p1', 'schiefe Zählerstände bei +1', '%'), N('p4', 'schiefe Zählerstände bei +4', '%')],
      sol: () => { const r = K().tornRead(v, inc); return { read: r.read, err: r.err, p1: K().tornBad(inc).frac * 100, p4: K().tornBad(inc4).frac * 100 }; },
      steps: s => { const r = K().tornRead(v, inc); return [`Niederwertiges Byte vor der ISR: ${hx(v & 255)}`, `Zähler nach der ISR: ${hx(r.after, 4)}, höherwertiges Byte jetzt ${hx(r.after >> 8)}`, `Gelesen: ${hx(r.after >> 8)} und ${hx(v & 255)} → ${hx(r.read, 4)} = ${s.read} (statt ${v} oder ${r.after}); Abweichung vom Stand vor der ISR (${v}): ${s.err}`, `Schief geht es nur, wenn die Erhöhung einen Übertrag ins höhere Byte macht: Bei +1 ist das bei 1 von 256 niederwertigen Werten der Fall = ${sg(s.p1, 4)} %; bei +4 bei 4 von 256 = ${sg(s.p4, 4)} %.`]; },
      hint: s => ['Schreibe die beiden Bytes vor und nach der ISR auf und kombiniere: altes niederwertiges Byte mit neuem höherwertigem.', 'Es geht nur schief, wenn die ISR zwischen den Zugriffen einen Übertrag ins höhere Byte erzeugt.', `Der Lesewert ist ${s.read}.`] }; });
  reg(() => { const cyc = 6, f = 16e6, per = 100;
    return { id: 'embm6', block: 'mem', title: 'Kritischer Abschnitt: was kostet er?', level: 2,
      text: `Um den Zähler aus der letzten Aufgabe sicher zu lesen, sperrt der Code kurz die Interrupts: cli, zwei Lesebefehle, sei, zusammen ${cyc} Takte bei ${fHz(f)}. Um wie viel µs kann sich dadurch ein Interrupt im schlimmsten Fall verzögern? Wie viel Prozent einer Timer-ISR-Periode von ${per} µs ist das?`,
      fields: [N('t', 'zusätzliche Verzögerung', 'µs'), N('share', 'Anteil an 100 µs', '%')],
      sol: () => { const t = K().critTime(cyc, f) * 1e6; return { t, share: t / per * 100 }; },
      steps: s => [`${cyc} Takte / ${fHz(f)} = ${sg(s.t, 4)} µs`, `${sg(s.t, 4)} µs / ${per} µs = ${sg(s.share, 4)} %`, 'Ein kurzer Abschnitt kostet fast nichts. Problematisch wird es erst bei langen gesperrten Abschnitten.'],
      hint: s => ['Die Verzögerung ist so lang wie der gesperrte Abschnitt.', 'Takte geteilt durch Taktfrequenz.', `Ergebnis in µs: ${sg(s.t, 3)}.`] }; });
  reg(() => ({ id: 'embm7', block: 'mem', title: 'volatile: Was hilft, was nicht?', level: 2,
    text: 'Eine ISR setzt ein Flag, die Hauptschleife wartet mit „while (!flag) { }“. Das Flag ist ohne volatile deklariert, der Compiler optimiert. Wie verhält sich die Schleife? Und: Reicht volatile allein, damit ein 16-Bit-Zähler, den die ISR verändert, auf einem 8-Bit-Controller korrekt gelesen wird?',
    scene: { type: 'volatile' },
    fields: [CH('v1', 'Schleife ohne volatile', [{ v: 'endlos', t: 'läuft endlos weiter' }, { v: 'ende', t: 'endet nach der ISR' }]), CH('v2', 'volatile allein macht den 16-Bit-Zugriff sicher?', JN)],
    sol: () => ({ v1: K().volatileLoop({ volatile: false, isrAt: 5, maxTicks: 1000 }).exited ? 'ende' : 'endlos', v2: K().tornBad(1).bad > 0 ? 'nein' : 'ja' }),
    steps: s => ['Ohne volatile darf der Compiler das Flag einmal vor der Schleife in ein Register laden. Er sieht in der Schleife nichts, das es ändert. Die ISR schreibt in den Speicher, das Register bleibt alt → Schleife ' + (s.v1 === 'endlos' ? 'endlos.' : 'endet.'), 'volatile erzwingt einen echten Lesezugriff bei jeder Abfrage. Die Sichtbarkeit ist damit gelöst.', `Atomarität ist aber ein anderes Problem: Ein 16-Bit-Wert wird mit zwei Zugriffen gelesen, und dazwischen kann die ISR zuschlagen (siehe zerrissener Zähler). Antwort: ${s.v2}. Nötig ist ein kritischer Abschnitt.`],
    hint: s => ['Zwei getrennte Fragen: Sieht die Schleife das neue Flag? Und: Wird der Wert in einem Stück gelesen?', 'volatile betrifft die Sichtbarkeit. Wie viele Befehle braucht der Zugriff auf 16 Bit bei 8-Bit-Bus?', 'Das Flag-Problem löst volatile, das Zerrissen-Problem nicht.'] }));
  reg(() => { const cL = 6, tH = 2, cH = 2, tM = 3, cM = 5;
    const tasks = () => [{ name: 'L', prio: 1, arrive: 0, ops: [{ t: 'lock' }, { t: 'run', n: cL }, { t: 'unlock' }] }, { name: 'M', prio: 2, arrive: tM, ops: [{ t: 'run', n: cM }] }, { name: 'H', prio: 3, arrive: tH, ops: [{ t: 'lock' }, { t: 'run', n: cH }, { t: 'unlock' }] }];
    return { id: 'embm8', block: 'mem', title: 'Prioritätsinversion im Zeitdiagramm', level: 3,
      text: `Drei Aufgaben teilen sich eine Sperre (Mutex). L (niedrig) startet bei 0, nimmt sofort die Sperre und rechnet ${cL} Zeiteinheiten damit. H (hoch) kommt bei ${tH}, braucht die Sperre und rechnet ${cH}. M (mittel, braucht keine Sperre) kommt bei ${tM} und rechnet ${cM}. Wann ist H fertig ohne Prioritätsvererbung, wann mit, und um wie viele Zeiteinheiten verzögert die Inversion H?`,
      scene: { type: 'gantt', tasks: tasks(), pip: false },
      fields: [NI('no', 'H fertig ohne Vererbung, t =', 'Zeiteinheiten'), NI('pip', 'H fertig mit Vererbung, t =', 'Zeiteinheiten'), NI('delay', 'Verzögerung durch die Inversion', 'Zeiteinheiten')],
      sol: () => { const a = K().schedSim(tasks(), { pip: false }), b = K().schedSim(tasks(), { pip: true }); return { no: a.done.H, pip: b.done.H, delay: a.done.H - b.done.H }; },
      steps: s => ['Ohne Vererbung: L läuft von 0 bis 2, bei 2 kommt H und blockiert an der Sperre. L läuft weiter, bei 3 verdrängt M die niedrige Aufgabe L und rechnet ' + cM + ' Einheiten (3 bis ' + (tM + cM) + '). Erst dann beendet L seinen Abschnitt (noch ' + (cL - tM) + ' Einheiten), danach läuft H.', `H fertig bei t = ${tM + cM} + ${cL - tM} + ${cH} = ${s.no}`, `Mit Vererbung: L erbt die hohe Priorität von H und läuft ohne Unterbrechung bis ${cL}; dann läuft H ${cH} Einheiten → t = ${s.pip}. M bekommt die CPU erst danach.`, `Die Inversion kostet H genau die Laufzeit von M: ${s.delay} Einheiten.`],
      hint: s => ['Wer darf wann rechnen? Immer die höchste Priorität unter den nicht blockierten Aufgaben.', 'Ohne Vererbung ist L nach der Ankunft von M niedriger als M. Mit Vererbung nicht.', `Die Inversion kostet genau so lange, wie M rechnet.`] }; });
  reg(() => { const ts = [{ name: 'a', C: 1, T: 4 }, { name: 'b', C: 2, T: 6 }, { name: 'c', C: 3, T: 12 }];
    return { id: 'embm9', block: 'mem', title: 'Planbarkeit (Rate-Monotonic)', level: 3,
      text: 'Drei periodische Aufgaben mit Frist gleich Periode (Rechenzeit C, Periode T, in ms): a (1, 4), b (2, 6), c (3, 12). Prioritäten nach Rate-Monotonic (kleinere Periode, höhere Priorität). Berechne die Auslastung, die Schranke n · (2^(1/n) − 1) und die Antwortzeit von c. Sind alle Fristen eingehalten?',
      table: { head: ['Aufgabe', 'C (ms)', 'T (ms)'], rows: ts.map(x => [x.name, String(x.C), String(x.T)]), cap: 'Aufgaben' },
      fields: [N('U', 'Auslastung', '%'), N('bound', 'Schranke', '%'), N('rc', 'Antwortzeit von c', 'ms', { exact: true }), CH('ok', 'alle Fristen eingehalten?', JN)],
      sol: () => { const r = K().rmAnalysis(ts); return { U: r.U * 100, bound: r.bound * 100, rc: r.rows.find(x => x.name === 'c').R, ok: r.all ? 'ja' : 'nein' }; },
      steps: s => ['Auslastung = 1/4 + 2/6 + 3/12 = ' + sg(s.U, 4) + ' %', `Schranke für n = 3: 3 · (2^(1/3) − 1) = ${sg(s.bound, 4)} %`, `U liegt ${s.U > s.bound ? 'über' : 'unter'} der Schranke: Der einfache Test entscheidet nicht (er ist nur hinreichend).`, `Antwortzeit c: R = 3 + ⌈R/4⌉·1 + ⌈R/6⌉·2. Start R = 3 → 6 → 7 → 9 → 10 → 10 (Fixpunkt) = ${s.rc} ms ≤ 12 ms`, `Alle Fristen halten: ${s.ok}.`],
      hint: s => ['Auslastung ist die Summe C/T. Der Schranken-Test ist hinreichend, nicht notwendig.', 'Antwortzeit-Iteration: R(neu) = C + Summe über höherpriore ⌈R/T⌉ · C. Wiederholen bis nichts mehr wächst.', `Die Auslastung liegt bei ${sg(s.U, 3)} %.`] }; });
  reg(() => { const ts = [{ name: 'isr', C: 250, T: 1000 }, { name: 'reg', C: 600, T: 1000 }];
    return { id: 'embm10', block: 'mem', title: 'Regelkreis mit ISR: Frist halten?', level: 2,
      text: 'Ein Regler braucht alle 1000 µs 600 µs Rechenzeit und muss bis zum Ende der Periode fertig sein. Eine ISR (alle 1000 µs, 250 µs) hat Vorrang. Wie hoch ist die gesamte Auslastung, wie lang ist die Antwortzeit des Reglers, und wie viel Reserve bleibt bis zur Frist?',
      fields: [N('U', 'Auslastung', '%'), N('R', 'Antwortzeit des Reglers', 'µs', { exact: true }), NI('res', 'Reserve bis zur Frist', 'µs')],
      sol: () => { const r = K().rmAnalysis(ts), rr = r.rows.find(x => x.name === 'reg'); return { U: r.U * 100, R: rr.R, res: rr.T - rr.R }; },
      steps: s => [`Auslastung = 250/1000 + 600/1000 = ${sg(s.U, 4)} %`, `Antwortzeit R = 600 + ⌈R/1000⌉ · 250: R = 600 → 850 → 850 = ${s.R} µs`, `Reserve = 1000 − ${s.R} = ${s.res} µs`],
      hint: s => ['Der Regler wird von der ISR einmal unterbrochen, wenn er nicht länger als eine Periode braucht.', 'R = 600 + 250 solange R unter 1000 µs bleibt.', `R ≈ ${s.R} µs.`] }; });

  /* ---------------------------------------------------------------- Register ---------------------------------------------------------------- */
  const TASKS = {
    get tasks() { build(); return LIST; },
    byId(id) { build(); return LIST.find(t => t.id === id); },
    byBlock(id) { build(); return LIST.filter(t => t.block === id); },
    check, show, norm,
    /* Alte Ids (bis v55.173: f1..f10 und m1..m10, kollidierten mit SimLab/MessLab) -> neue Ids embf1..embf10, embm1..embm10 */
    legacyId(id) { return /^[fm](\d|10)$/.test(String(id)) ? 'emb' + id : id; },
    /* Stand {id: Wert} auf neue Ids umstellen; liefert { data, changed }. Fehlende oder kaputte Daten werden zu {} (nie ein Fehler), eine schon vorhandene neue Id wird nicht ueberschrieben */
    migrateIds(obj) {
      const out = {}; let changed = false;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { data: out, changed: obj != null };
      Object.keys(obj).forEach(k => { const n = TASKS.legacyId(k); if (n !== k) changed = true; if (n !== k && Object.prototype.hasOwnProperty.call(obj, n)) return; out[n] = obj[k]; });
      return { data: out, changed };
    }
  };
  const DATA = { blocks: META.blocks.map(b => Object.assign({}, b, EXPLAIN[b.id])) };
  root.EMB_META = META; root.EMB_DATA = DATA; root.EMB_TASKS = TASKS;
  if (typeof module !== 'undefined' && module.exports) module.exports = { META, DATA, TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
