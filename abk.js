'use strict';
/* Tonfunk Lab: Abkürzungen erklären (abk.js, von labrahmen.js in jedem Lab nachgeladen; in Node testbar: quelle/abk/test_abk.js).
   Jede Abkürzung der Liste bekommt beim ersten Vorkommen je Karte die Erklärung in Klammern: "FMEA (Fehler-Möglichkeits- und Einfluss-Analyse)".
   Regeln:
   - Erklärt wird nur Fließtext. Knöpfe, Reiter, Überschriften, Tabellen, Eingaben, Bilder und alles Anklickbare bleiben kurz (NICHT).
   - In Fragen (Text mit Fragezeichen) und in Texten, die nach der Bedeutung fragen, wird nichts erklärt: die Erklärung darf keine Antwort verraten.
   - Mehrdeutige Kürzel (PE, IT, IP, AC, PI, IC ...) stehen nicht in der Liste. Was nur in einem Lab gilt, steht in EIGEN (Schlüssel = Dateiname ohne .html).
   - Keine Erklärung enthält selbst ein Kürzel der Liste. */
(function (root) {
  const LISTE = [
    /* Normen und Regeln */
    ['IPC-A-610', 'Norm für die Abnahme elektronischer Baugruppen'], ['J-STD-020', 'Norm zur Einstufung feuchteempfindlicher Bauteile'], ['J-STD-033', 'Norm zum Umgang mit feuchteempfindlichen Bauteilen'],
    ['DIN EN', 'deutsche Fassung einer Europäischen Norm'], ['DIN', 'Deutsches Institut für Normung'], ['EN', 'Europäische Norm'], ['ISO', 'Internationale Organisation für Normung'], ['IEC', 'Internationale Elektrotechnische Kommission'],
    ['VDE', 'Verband der Elektrotechnik, gibt die Regeln der Elektrotechnik heraus'], ['VDI', 'Verein Deutscher Ingenieure'], ['DGUV', 'Deutsche Gesetzliche Unfallversicherung'], ['IATF', 'International Automotive Task Force, Norm für Qualität in der Autoindustrie'],
    ['DSGVO', 'Datenschutz-Grundverordnung'], ['BGB', 'Bürgerliches Gesetzbuch'], ['HGB', 'Handelsgesetzbuch'], ['IHK', 'Industrie- und Handelskammer'], ['BSI', 'Bundesamt für Sicherheit in der Informationstechnik'],
    ['RoHS', 'Regel der Europäischen Union, die gefährliche Stoffe in Elektrogeräten beschränkt'], ['REACH', 'Chemikalienverordnung der Europäischen Union'], ['WEEE', 'Regel der Europäischen Union für die Rücknahme alter Elektrogeräte'], ['SVHC', 'besonders besorgniserregende Stoffe'],
    ['GHS', 'weltweit einheitliches System zur Kennzeichnung von Gefahrstoffen'], ['PSA', 'persönliche Schutzausrüstung'],
    /* Elektronikfertigung */
    ['EMS', 'Electronic Manufacturing Services, Elektronikfertigung im Auftrag'], ['OEM', 'Original Equipment Manufacturer, Kunde mit eigener Marke'], ['NPI', 'New Product Introduction, Einführung eines neuen Produkts in die Serie'],
    ['BOM', 'Bill of Materials, Stückliste'], ['SMT', 'Surface Mount Technology, Bestücken auf der Oberfläche der Platine'], ['SMD', 'Surface Mounted Device, Bauteil für die Oberflächenmontage'],
    ['THT', 'Through Hole Technology, Bauteile mit Drähten durch Bohrungen'], ['AOI', 'automatische optische Inspektion, eine Kamera prüft Bauteile und Lötstellen'], ['AXI', 'Automated X-ray Inspection, automatische Röntgenprüfung'],
    ['ICT', 'In-Circuit-Test, Prüfung der Bauteile auf der Platine mit einem Nadeladapter'], ['FPY', 'First Pass Yield, Anteil guter Baugruppen beim ersten Durchlauf'], ['MSL', 'Moisture Sensitivity Level, Stufe der Feuchteempfindlichkeit'],
    ['ESD', 'Electrostatic Discharge, elektrostatische Entladung'], ['EPA', 'Protected Area, Schutzzone gegen elektrostatische Entladung'], ['EOL', 'End of Life, das Bauteil wird nicht mehr hergestellt'],
    ['QFN', 'Quad Flat No-Lead, flaches Gehäuse mit Anschlüssen nur auf der Unterseite'], ['BGA', 'Ball Grid Array, Gehäuse mit Lotkugeln auf der Unterseite'],
    ['PCB', 'Printed Circuit Board, Leiterplatte'], ['DRC', 'Design Rule Check, automatische Prüfung der Entwurfsregeln'], ['ENIG', 'Oberfläche aus Nickel mit dünner Goldschicht'], ['HASL', 'Heißluftverzinnung der Lötflächen'],
    ['JTAG', 'Prüf- und Programmierzugang für Bausteine auf der Platine'], ['UV', 'ultraviolettes Licht'],
    /* Qualität, Lager, Betrieb */
    ['FMEA', 'Fehler-Möglichkeits- und Einfluss-Analyse'], ['RPZ', 'Risikoprioritätszahl'], ['8D', 'acht Schritte, mit denen ein Fehler dauerhaft abgestellt wird'], ['PDCA', 'Plan, Do, Check, Act: planen, umsetzen, prüfen, verbessern'],
    ['KVP', 'kontinuierlicher Verbesserungsprozess'], ['QM', 'Qualitätsmanagement'], ['CAQ', 'Computer Aided Quality, rechnergestützte Qualitätssicherung'], ['MES', 'Manufacturing Execution System, Fertigungsleitsystem'],
    ['ERP', 'Enterprise Resource Planning, Programm für Warenwirtschaft und Planung im Betrieb'], ['OEE', 'Overall Equipment Effectiveness, Gesamtanlageneffektivität'], ['TPM', 'Total Productive Maintenance, vorbeugende Instandhaltung durch alle'],
    ['MTBF', 'Mean Time Between Failures, mittlere Betriebszeit zwischen zwei Ausfällen'], ['MTTR', 'Mean Time To Repair, mittlere Dauer einer Reparatur'],
    ['FIFO', 'First In, First Out: was zuerst eingelagert wurde, geht zuerst raus'], ['LIFO', 'Last In, First Out: was zuletzt eingelagert wurde, geht zuerst raus'], ['FEFO', 'First Expired, First Out: was zuerst abläuft, geht zuerst raus'],
    ['EDV', 'elektronische Datenverarbeitung'], ['KI', 'künstliche Intelligenz'],
    /* Elektrotechnik und Elektronik */
    ['LED', 'Leuchtdiode'], ['RCD', 'Fehlerstrom-Schutzeinrichtung'], ['EMV', 'elektromagnetische Verträglichkeit'], ['PWM', 'Pulsweitenmodulation'], ['SPS', 'speicherprogrammierbare Steuerung'],
    ['MOSFET', 'Feldeffekttransistor mit isoliertem Gate'], ['OPV', 'Operationsverstärker'], ['NTC', 'Heißleiter, der Widerstand sinkt bei Wärme'], ['PTC', 'Kaltleiter, der Widerstand steigt bei Wärme'],
    ['LDR', 'lichtabhängiger Widerstand'], ['VDR', 'spannungsabhängiger Widerstand'], ['DMS', 'Dehnungsmessstreifen'], ['ADU', 'Analog-Digital-Umsetzer'], ['DAU', 'Digital-Analog-Umsetzer'],
    ['GND', 'Ground, Masse als Bezugspunkt der Schaltung'], ['HF', 'Hochfrequenz'], ['PV', 'Photovoltaik'], ['MPP', 'Maximum Power Point, Punkt der größten Leistung'], ['MPPT', 'Regelung, die den Punkt der größten Leistung sucht'],
    ['ESR', 'Ersatz-Serienwiderstand eines Kondensators'], ['PEN', 'Leiter, der Schutzleiter und Neutralleiter zugleich ist'], ['SELV', 'Schutzkleinspannung ohne Erdung'], ['PELV', 'Schutzkleinspannung mit Erdung'],
    ['USV', 'unterbrechungsfreie Stromversorgung'], ['LCD', 'Flüssigkristallanzeige'], ['PID', 'Regler mit proportionalem, integrierendem und differenzierendem Anteil'],
    ['LSB', 'niederwertigstes Bit'], ['MSB', 'höchstwertiges Bit'], ['BCD', 'binär codierte Dezimalzahl'], ['CMRR', 'Gleichtaktunterdrückung'], ['SNR', 'Signal-Rausch-Abstand'], ['THD', 'Klirrfaktor, Anteil der Oberschwingungen'],
    ['FFT', 'schnelle Fourier-Transformation, zerlegt ein Signal in seine Frequenzen'], ['EIRP', 'äquivalente isotrope Strahlungsleistung'], ['LISN', 'Netznachbildung für Störspannungsmessungen'],
    ['KOP', 'Kontaktplan'], ['FUP', 'Funktionsplan'], ['PAP', 'Programmablaufplan'], ['EVA', 'Eingabe, Verarbeitung, Ausgabe'],
    /* Rechner und Netze */
    ['CPU', 'Prozessor, das Rechenwerk'], ['RAM', 'Arbeitsspeicher'], ['ROM', 'Festwertspeicher'], ['EEPROM', 'Festwertspeicher, der sich elektrisch löschen und neu beschreiben lässt'], ['SSD', 'Festspeicher ohne bewegte Teile'], ['HDD', 'Festplatte mit drehenden Scheiben'],
    ['RAID', 'Verbund mehrerer Festplatten'], ['NAS', 'Netzwerkspeicher'], ['BIOS', 'Grundprogramm, das den Rechner startet'], ['UEFI', 'Nachfolger des alten Startprogramms im Rechner'], ['GPIO', 'frei nutzbarer Ein- und Ausgang eines Rechnerbausteins'],
    ['I2C', 'Datenbus mit zwei Leitungen für Bausteine auf der Platine'], ['UART', 'serielle Schnittstelle ohne Taktleitung'], ['ISR', 'Interrupt Service Routine, Programmteil für eine Unterbrechung'],
    ['SQL', 'Structured Query Language, Abfragesprache für Datenbanken'], ['DNS', 'Domain Name System, übersetzt Namen in Adressen'], ['DHCP', 'Dienst, der Netzwerkadressen automatisch vergibt'],
    ['TCP', 'Transmission Control Protocol, gesicherte Übertragung im Netz'], ['UDP', 'User Datagram Protocol, schnelle Übertragung ohne Sicherung'], ['VLAN', 'virtuelles Netz innerhalb eines Netzwerks'],
    ['RPO', 'Recovery Point Objective, wie viel Datenverlust höchstens hinnehmbar ist'], ['RTO', 'Recovery Time Objective, wie lange ein Ausfall höchstens dauern darf'], ['RFID', 'Funketikett, das berührungslos gelesen wird'],
    /* Metall */
    ['CNC', 'Computerized Numerical Control, rechnergesteuerte Werkzeugmaschine'], ['HSS', 'Schnellarbeitsstahl'], ['HRC', 'Härte nach Rockwell'], ['KSS', 'Kühlschmierstoff'], ['CAD', 'Computer Aided Design, Zeichnen und Konstruieren am Rechner']];
  /* Nur in diesem Lab gültig (anderswo hat das Kürzel eine andere oder keine feste Bedeutung) */
  const SPI = ['SPI', 'Solder Paste Inspection, Prüfung der gedruckten Lotpaste'], IC = ['IC', 'Integrated Circuit, integrierte Schaltung'], RF = ['rF', 'relative Luftfeuchte'];   // anderswo: Schnittstelle, Kollektorstrom, Widerstand
  const EIGEN = {
    emslab: [SPI, IC, RF, ['FP', 'Flying-Probe, Prüfung mit beweglichen Prüfnadeln ohne Adapter'], ['IT', 'Informationstechnik'], ['3D', 'dreidimensional, also räumlich'], ['1K', 'Einkomponenten-Material'],
      ['2K', 'Zweikomponenten-Material, härtet nach dem Mischen'], ['PU', 'Polyurethan'], ['M4', 'metrisches Gewinde mit 4 mm Durchmesser'], ['Nm', 'Newtonmeter']],
    pcblab: [SPI, IC, RF],
    linlab: [['PID', 'Process ID, Nummer eines laufenden Prozesses']]
  };
  /* Normkürzel: Nummer und weitere Normkürzel gehören dazu ("DIN VDE 0100-410", "ISO 9001"); sonst bleibt alles nach dem Leerzeichen frei ("RCD 30 mA") */
  const NORM = /^(DIN EN|DIN|EN|ISO|IEC|VDE|DGUV|IATF)$/;
  const B = 'A-Za-zÄÖÜäöüß';

  /* liste: [[Kürzel, Erklärung]]. Liefert erklaere(text, seen, folge): Text mit Erklärung beim ersten Vorkommen; seen = Set der schon erklärten Kürzel,
     folge = Text, der im Satz hinter diesem Textstück weitergeht (hinter einem <b>). Schon erklärte Stellen bleiben, ein zweiter Lauf ändert nichts. */
  function mach(liste) {
    const M = new Map(liste), re = new RegExp('(?<![' + B + '0-9-])(' + liste.map(a => a[0]).sort((a, b) => b.length - a.length).join('|') + ')(s?(?: (?:DIN|EN|ISO|IEC|VDE)(?![' + B + '0-9])| [0-9]+(?:[-:][0-9]+)*|-[0-9' + B + ']+)*)(?![' + B + '0-9])', 'g');
    return function (text, seen, folge) {
      return String(text).replace(re, (m, k, rest, i, s) => {
        let ende = '';
        const frei = rest.indexOf(' ');
        if (frei >= 0 && !NORM.test(k)) { ende = rest.slice(frei); rest = rest.slice(0, frei); }
        const e = M.get(k), kopf = k + rest, nach = ende + s.slice(i + m.length) + (folge || ''), vor = s[i - 1], teile = rest.split(/[- ]/).filter(w => M.has(w));
        if (nach.startsWith(' (' + e) || nach.startsWith(' (' + k + ': ') || nach.startsWith(', ' + e) || nach.startsWith(': ' + e)) { seen.add(k); teile.forEach(w => seen.add(w)); return m; }   // schon erklärt
        if (nach.startsWith(' (')) { seen.add(k); return m; }   // eigene Klammer des Labs: gilt als erklärt, keine zweite daneben
        if (k === 'EN' && !rest) return m;   // allein ist EN meist ein Freigabe-Eingang, keine Norm
        if (!ende && i + m.length === s.length && /^[-0-9A-Za-zÄÖÜäöüß]/.test(folge || '')) return m;   // das Wort geht hinter einem Tag weiter ("<b>THT</b>-Bauteile")
        const neu = [k].concat(teile).filter(w => !seen.has(w));   // 3D-SPI, DIN VDE 0100: alle Kürzel in einer Klammer
        if (!neu.length) return m;
        neu.forEach(w => seen.add(w));
        if (!rest && vor === '(' && nach[0] === ')') return kopf + ', ' + e + ende;
        return kopf + (rest ? ' (' + neu.map(w => w + ': ' + M.get(w)).join('; ') + ')' : ' (' + e + ')') + ende;
      });
    };
  }
  /* Liste für eine Seite: Eigenes überschreibt Allgemeines */
  function fuer(seite) { const eig = EIGEN[seite] || [], k = new Set(eig.map(a => a[0])); return eig.concat(LISTE.filter(a => !k.has(a[0]))); }

  const NICHT = 'script,style,svg,canvas,input,textarea,select,option,button,label,a,nav,header,table,pre,code,kbd,h1,h2,h3,h4,h5,h6,summary,[role=button],[role=tab],[role=radio],[role=checkbox],[role=option],[role=menuitem],[role=link],[role=switch],[role=log],[role=alert],[role=status],[aria-live],[tabindex="0"],[onclick],[contenteditable],.chip,.tl,.lr-band,#toast,#v_duell,.dl,#wtBox,#tuBox,#cbBox';
  const KARTE = '.card,.sh-b,section,article,details,dialog,[role=tabpanel],main,.wrap';
  const FRAGE = /\?|Abkürzung|steht für|Bedeutung|bedeutet|heißt|ausgeschrieben/;
  const INLINE = /^(B|I|EM|STRONG|SPAN|U|SUB|SUP|MARK|SMALL)$/;
  function start(doc) {
    const erkl = mach(fuer((root.location.pathname.split('/').pop() || '').replace(/\.html$/, '')));
    const offen = new Set(), oft = new WeakMap(); let t = 0;
    /* Satz-Element: über <b>, <span> ... hinaus bis zum Block */
    const satz = n => { let e = n.parentElement; while (INLINE.test(e.tagName) && e.parentElement) e = e.parentElement; return e; };
    /* Text, der hinter dem Knoten im selben Satz weitergeht */
    const folge = n => { let s = '', x = n; while (s.length < 120) { if (x.nextSibling) { x = x.nextSibling; s += x.textContent; } else { x = x.parentNode; if (!x || x.nodeType !== 1 || !INLINE.test(x.tagName)) break; } } return s.slice(0, 120); };
    function lauf() {
      t = 0; const sc = [...offen].filter(e => e.isConnected); offen.clear();
      sc.filter(e => !sc.some(o => o !== e && o.contains(e))).forEach(e => {
        const seen = new Map(), w = doc.createTreeWalker(e, 4 /* Text */, { acceptNode: n => !/[A-ZÄÖÜ]{2}|[0-9][A-Z]|[A-Z][0-9]|rF|Nm|RoHS/.test(n.data) || n.parentElement.closest(NICHT) ? 2 : 1 }); let n;
        while ((n = w.nextNode())) {
          const p = n.parentElement;
          if (FRAGE.test(satz(n).textContent)) continue;
          const k = p.closest(KARTE) || doc.body; if (!seen.has(k)) seen.set(k, new Set());
          const neu = erkl(n.data, seen.get(k), folge(n)); if (neu === n.data) continue;
          /* Schreibt das Lab denselben Text immer wieder neu (Anzeige einer Simulation), bleibt die Stelle nach dem zweiten Mal kurz: kein Flackern */
          const z = (oft.get(p) || 0) + 1; oft.set(p, z); if (z <= 2) n.data = neu;
        }
      });
    }
    const merk = el => { if (!el || el.closest(NICHT)) return; offen.add(el.closest(KARTE) || doc.body); if (!t) t = setTimeout(lauf, 200); };
    new MutationObserver(ms => ms.forEach(m => { if (m.addedNodes.length) merk(m.target.nodeType === 1 ? m.target : m.target.parentElement); })).observe(doc.body, { childList: true, subtree: true });
    merk(doc.body);
  }

  root.ABK = { LISTE, EIGEN, mach, fuer, NICHT, FRAGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ABK;
  else if (root.document.body) start(root.document); else root.document.addEventListener('DOMContentLoaded', () => start(root.document));
})(typeof window !== 'undefined' ? window : globalThis);
