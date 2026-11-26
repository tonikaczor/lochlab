'use strict';
/* Tonfunk Lab: Lernpfad der Startseite.
   Spuren je Beruf mit empfohlener Reihenfolge, Schwierigkeit und Fortschritt je Lab. Der Fortschritt kommt aus den vorhandenen Ergebnissen (sim.done, lm4.tdone),
   die Liste der Labs und Aufgaben aus aufgaben.js.
   Lehrjahr-gerechter Weg (Paket L2): Für Berufe mit Datenlage (Lehrjahr.gilt: egs, ige, im) und mit bekanntem Lehrjahr (Lehrjahr.wirksam, lehrjahr.js) führt der Pfad nur durch den Teil jedes Labs bis zum
   eigenen Lehrjahr (stat().t, recommend()). n, d und pct von stat() bleiben der Gesamtfortschritt des Labs; ohne Lehrjahr und für andere Berufe ist alles wie vorher (kein neues Feld). Nichts wird gesperrt.
   Seit dem Umbau in fünf Ansichten (S1) ist der Lernpfad kein eigener Bereich mehr: er ist die Sortierung "Reihenfolge" im Lab-Raster (home-groups.js liest
   tracksFor(), projTrack() und projHtml()). build() trägt die Fortschrittszeile in die Karten ein und baut in der Ansicht "Ich" die Zeile Rang und Karriere (#ichRang). */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const REG = root.LAB_REG || {}, ROWS = root.AUFGABEN || [];
  const TRACKS = [
    { t: 'Elektronik von Grund auf', s: 'Von der einfachen Schaltung über das Löten und die Digitaltechnik bis zur Messtechnik, zur elektrischen Sicherheit und Geräteprüfung, zu Netzteilen und Schaltreglern, zu Wechselstrom und Schwingkreisen, zur Analogtechnik mit Diode, Transistor und Operationsverstärker, zur Leiterplatte, zur speicherprogrammierbaren Steuerung (SPS), zu den Antrieben, zur Sensorik, zur Regelungstechnik, zur Wärmeabfuhr mit dem Kühlkörper und zur elektromagnetischen Verträglichkeit (EMV) und zur Solartechnik (Energie).', labs: ['sch', 'arb', 'ems', 'loch', 'digi', 'mess', 'els', 'nts', 'wsl', 'ana', 'sps', 'pne', 'pcb', 'lot', 'ant', 'sen', 'reg', 'thm', 'emv', 'hf', 'enr'] },
    { t: 'Installation und Anlagen', s: 'Wie Strom im Haus verteilt, geschaltet und abgesichert wird.', labs: ['sim', 'haus'], pre: 'Empfohlen vorher: SchaltLab' },
    { t: 'Konstruieren und 3D-Druck', s: 'Bauteile und Gehäuse am Rechner konstruieren, dann im Slicer vorbereiten und drucken.', labs: ['cad', 'drk'], pre: '' },
    { t: 'Prüfungsvorbereitung', s: 'Die Abschlussprüfung üben: Datenblätter lesen (Grenzwerte, Kennlinien, Fachenglisch), Themen trainieren, Rechnen, Probeprüfung mit Zeitlimit und Auswertung. Das Thema Sicherheit und Normen übst du zusätzlich nach dem Sicherheits-Lab: die Abschaltbedingung, die Schutzmaßnahmen und die Geräteprüfung kommen in der Prüfung vor. Das Thema Stromversorgung übst du nach dem Netzteil-Lab: Gleichrichter, Siebung, Z-Diode, Linearregler und Schaltregler kommen in der Prüfung vor. Das Thema Wechselstrom und Filter übst du nach dem Wechselstrom-Lab: Zeigerdiagramm, Blindleistung, Schwingkreis, RC-Filter und Transformator kommen in der Prüfung vor. Das Thema Bauelemente übst du nach dem Analogtechnik-Lab: Diode, LED-Vorwiderstand, Transistor als Schalter, Arbeitspunkt und Operationsverstärker kommen in der Prüfung vor.', labs: ['ds', 'pr', 'sya'], links: [['lernfelder.html', 'Lernfelder der Berufsschule: Aufgaben und Probetest'], ['pruefungslab.html?thema=sicherheit', 'Sicherheit und Normen üben (Prüfungs-Lab)'], ['elslab.html', 'Dazu im Sicherheits-Lab ausprobieren'], ['pruefungslab.html?thema=netzteile', 'Stromversorgung üben (Prüfungs-Lab)'], ['ntslab.html', 'Dazu im Netzteil-Lab ausprobieren'], ['pruefungslab.html?thema=wechselstrom', 'Wechselstrom und Filter üben (Prüfungs-Lab)'], ['wsllab.html', 'Dazu im Wechselstrom-Lab ausprobieren'], ['pruefungslab.html?thema=analog', 'Bauelemente und Verstärker üben (Prüfungs-Lab)'], ['analab.html', 'Dazu im Analogtechnik-Lab ausprobieren']], pre: 'Am besten nach SchaltLab, DigiLab und MessLab' },
    { t: 'Programmieren und Steuern', s: 'Eigene Apps mit KI bauen, dann Schaltungen mit Programmen steuern: Arduino und Raspberry Pi, danach Timer, Interrupts und serielle Busse im Mikrocontroller- und im Bus-Lab.', labs: ['app', 'code', 'pi', 'mik', 'bus'], pre: 'Die App-Werkstatt braucht kein Vorwissen. Für Arduino und Pi empfohlen: SchaltLab, für Mikrocontroller und Busse: Arduino-Lab' },
    { t: 'Verbundprojekte', s: 'Alle Labs arbeiten zusammen an einem Gerät: Garagentor, Ampel, Digitale Uhr, Gartenbewässerung, Förderanlage, Labornetzteil und Heizungsregelung (für andere Berufe gibt es eigene Projekte im Projekt-Bereich). Jede Station liefert ihr Ergebnis an die nächste, am Ende gibt es Gesamttest und Zertifikat.', labs: ['vb'], pre: 'Am besten nach den Labs, die ein Projekt braucht (Datenblatt, Schaltplan, Leiterplatte, Messen, Antrieb, Sensorik, SPS)' }
  ];
  /* Spuren der anderen Berufe (v39.158). Labs, die der Beruf hat, aber in keiner Spur stehen, kommen unter „Weitere Labs“; Labs ohne Beruf-Zuordnung (z. B. noch gesperrt) fehlen. */
  const TRACKS_B = {
    ige: [
      { t: 'Grundlagen und Grundschaltungen', s: 'Rechnen, Schaltpläne lesen, einfache Schaltungen aufbauen und simulieren, dazu Wechselstrom ohne Formelstress. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['sch', 'mat', 'arb', 'ems', 'loch', 'sim', 'wsl'], pre: 'Erst das SchaltLab, beim Rechnen hilft das Rechen-Lab' },
      { t: 'Sicherungen, Hausinstallation und Sicherheit', s: 'Wie Strom im Haus abgesichert, verteilt und geschaltet wird, was bei der elektrischen Sicherheit zählt und was Energie kostet.', labs: ['els', 'haus', 'enr'], pre: 'Empfohlen vorher: SchaltLab' },
      { t: 'Messen, Netzteile und Elektronik', s: 'Mit dem Multimeter sicher messen, Netzteile und einfache Halbleiterschaltungen verstehen, Logikschaltungen kennenlernen und Datenblätter lesen.', labs: ['mess', 'nts', 'ana', 'digi', 'lot', 'ds'], pre: '' },
      { t: 'Steuerungen, Antriebe und Sensoren', s: 'Schaltschrank-Steuerungen einfach erklärt: SPS, Motoren und Sensoren.', labs: ['sps', 'pne', 'ant', 'sen'], pre: 'Empfohlen vorher: SchaltLab' },
      { t: 'Konstruieren und 3D-Druck', s: 'Bauteile und Gehäuse am Rechner konstruieren, dann im Slicer vorbereiten und drucken.', labs: ['cad', 'drk'], pre: '' },
      { t: 'Prüfung und Berufsalltag', s: 'Die Abschlussprüfung üben, Fachenglisch und das Berichtsheft.', labs: ['pr', 'eng', 'bhf'], pre: '' }
    ],
    im: [
      { t: 'Grundlagen der Fertigung', s: 'Fertigen von Hand, Messen mit Toleranzen und Passungen, Rechnen, Mechanik, Werkstoffe und Zeichnungen: das Handwerkszeug für jede Werkstatt. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'fer', 'tol', 'mat', 'mch', 'wer', 'zei'], pre: 'Das Fertigungs-Lab ist ein guter Start' },   /* v63.187: beginnt wie der Ausbildungsplan mit Lernfeld 1 (Fertigungs-Lab, Toleranz-Lab) */
      { t: 'Zerspanen und CNC', s: 'Schnittwerte berechnen, Drehzahlen und Vorschübe wählen, CNC-Programme lesen und verstehen.', labs: ['zer', 'mak', 'cnc'], pre: 'Empfohlen vorher: Toleranz-Lab' },
      { t: 'Fügen und Maschinenelemente', s: 'Schweißen, Löten, Kleben und Schrauben richtig wählen und rechnen, dazu Zahnräder, Riemen, Lager und Federn, Normteile und fertigungsgerechtes Konstruieren.', labs: ['fug', 'mas', 'kon', 'cad', 'drk'], pre: 'Empfohlen vorher: Werkstoff-Lab' },
      { t: 'Pneumatik, Hydraulik und Steuern', s: 'Schaltpläne lesen, Zylinder und Ventile ansteuern, Sensoren, Antriebe, SPS und Regelung.', labs: ['pne', 'hyd', 'sen', 'sps', 'ant', 'reg'], pre: 'Empfohlen vorher: Pneumatik-Lab' },
      { t: 'Instandhaltung und Sicherheit', s: 'Anlagen warten, Fehler systematisch suchen, sicher arbeiten, messen und Wärme verstehen.', labs: ['ins', 'els', 'mess', 'thm'], pre: '' },
      { t: 'Betrieb und Beruf', s: 'Fachenglisch für Anleitungen und Datenblätter, dazu das Berichtsheft sauber führen.', labs: ['eng', 'bhf'], pre: '' }   /* v63.187: kon (oben), eng und bhf standen vorher unter „Weitere Labs“ */
    ],
    tpd: [
      { t: 'Zeichnen und Toleranzen', s: 'Ansichten und Schnitte, Bemaßung nach Norm, Toleranzen und Passungen und das Rechnen dazu. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'mat', 'zei', 'tol'], pre: 'Das Rechen-Lab ist ein guter Start' },
      { t: 'Werkstoffe und Fertigung', s: 'Werkstoffe kennen, Zerspanen, Fertigungsverfahren und Fügen: So merkst du, was sich gut herstellen lässt.', labs: ['wer', 'zer', 'fer', 'fug'], pre: '' },
      { t: 'Konstruieren und Kunststoffteile', s: 'Fertigungsgerecht konstruieren, dazu Kunststoffe, Spritzgießen, Schwindung und Schnapphaken.', labs: ['kon', 'cad', 'kun', 'drk'], pre: 'Empfohlen vorher: Zeichnungs-Lab' }
    ],
    fll: [
      { t: 'Lager und Logistik', s: 'Kennzahlen, ABC-Analyse, Bestellmengen und Flurförderzeuge; dazu das Rechnen, das du täglich brauchst. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'mat', 'lag', 'lad'], pre: 'Das Rechen-Lab ist ein guter Start' },
      { t: 'Warenfluss und Touren', s: 'Vom Wareneingang bis zum Versand, dann Touren bilden, Fahrzeug wählen, richtig laden und Lenkzeiten einplanen.', labs: ['wfl', 'tou'], pre: 'Empfohlen vorher: Lager-Lab' }
    ],
    ik: [
      { t: 'Kaufmännisches Rechnen', s: 'Prozent, Dreisatz, Bezugs- und Selbstkostenkalkulation, Handelsspanne und Break-even; dazu die Buchführung. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'mat', 'kal', 'buc'], pre: 'Das Rechen-Lab ist ein guter Start' },
      { t: 'Produktion und Logistik', s: 'Fertigungsarten, Kapazität, Losgröße und Termine, dazu Lagerkennzahlen und der Weg der Ware.', labs: ['prd', 'lag', 'wfl'], pre: '' },
      { t: 'Marketing und Verträge', s: 'Marktforschung, Preis und Werbung planen, dazu Kaufvertrag und Auftragsabwicklung.', labs: ['mkt', 'rec'], pre: '' }
    ],
    fi: [
      { t: 'Netze und Sicherheit', s: 'Binär, Subnetting, Ports und Protokolle; dazu die Grundlagen der IT-Sicherheit.', labs: ['arb', 'ems', 'net', 'its', 'mat'], pre: 'Netzwerk-Lab zuerst' },
      { t: 'Digitaltechnik und Programmieren', s: 'Logik und Zahlensysteme, eigene Apps, Arduino und Raspberry Pi, Datenblätter lesen.', labs: ['digi', 'app', 'code', 'pi', 'ds'], pre: 'Die App-Werkstatt braucht kein Vorwissen' }
    ],
    /* Wege Studium und Technik (v55.174): Module statt Spuren der Ausbildung. Dieselbe Lab-Auswahl steht in den Karten (data-beruf in index.html) und in ausbildungsplan-<weg>.js; quelle/beruf/test_wege.js prüft die Übereinstimmung. */
    tec: [
      { t: 'Mathematik für die Technik', s: 'Komplexe Zahlen, Matrizen und Differenzialgleichungen an Schaltungen, dazu das Rechnen aus der Ausbildung zum Auffrischen. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
      { t: 'Wechselstrom, Signale und Messtechnik', s: 'Wechselstromnetze und Schwingkreise, Spektrum und Filter, Funk und Hochfrequenz, sicheres und genaues Messen.', labs: ['wsl', 'sig', 'hf', 'mess'], pre: '' },
      { t: 'Elektronik und Digitaltechnik', s: 'Diode, Transistor und Operationsverstärker, Netzteile, Logikschaltungen und Datenblätter.', labs: ['ana', 'nts', 'digi', 'ds'], pre: '' },
      { t: 'Automatisierung und Antriebe', s: 'Steuerungen und Schaltschrank, Motoren und Sensoren.', labs: ['sps', 'ssl', 'ant', 'sen'], pre: '' },
      { t: 'Regelungstechnik', s: 'Erst den Regelkreis verstehen, dann Bode, Stabilität und Reglerentwurf.', labs: ['reg', 'rg2'], pre: 'Empfohlen vorher: Mathe-Brücke' },
      { t: 'Mikrocontroller', s: 'Timer, Schnittstellen und Echtzeit, dazu Arduino.', labs: ['code', 'emb'], pre: '' },
      { t: 'Energie, Sicherheit und Verträglichkeit', s: 'Energieanlagen, elektrische Sicherheit, EMV und Wärme.', labs: ['enr', 'els', 'emv', 'thm'], pre: '' },
      { t: 'Konstruieren und 3D-Druck', s: 'Bauteile und Gehäuse am Rechner konstruieren, dann im Slicer vorbereiten und drucken.', labs: ['cad', 'drk'], pre: '' },
      { t: 'Normen, Projekt und Betrieb', s: 'Normen und Konformität, Projekte planen und bewerten, Kosten kalkulieren, Fachenglisch.', labs: ['nrm', 'prj', 'fli', 'kal', 'eng'], pre: '' }
    ],
    stu: [
      { t: 'Mathematik', s: 'Die Mathematik des Studiums direkt an Schaltungen, dazu das Rechnen aus der Schule zum Auffrischen. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
      { t: 'Netzwerke, Signale und Messtechnik', s: 'Wechselstromnetze, Spektrum, Abtastung und Filter, Funk und Hochfrequenz, Messen mit Verstand.', labs: ['wsl', 'sig', 'hf', 'mess'], pre: '' },
      { t: 'Elektronik', s: 'Halbleiter und Verstärker, Netzteile, Digitaltechnik, Datenblätter und Leiterplatten.', labs: ['ana', 'nts', 'digi', 'ds', 'pcb'], pre: '' },
      { t: 'Regelung und Systeme', s: 'Regelkreise und ihr Entwurf, Sensoren und Antriebe.', labs: ['reg', 'rg2', 'sen', 'ant'], pre: 'Empfohlen vorher: Mathe-Brücke' },
      { t: 'Eingebettete Systeme und Programmieren', s: 'Mikrocontroller, Arduino, Algorithmen und Raspberry Pi.', labs: ['code', 'emb', 'alg', 'pi'], pre: '' },
      { t: 'Energie, EMV und Wärme', s: 'Energiesysteme, elektromagnetische Verträglichkeit und Wärmeabfuhr.', labs: ['enr', 'emv', 'thm'], pre: '' },
      { t: 'Konstruieren und 3D-Druck', s: 'Bauteile und Gehäuse am Rechner konstruieren, dann im Slicer vorbereiten und drucken.', labs: ['cad', 'drk'], pre: '' },
      { t: 'Projekt, Normen und Fachenglisch', s: 'Projekte planen und bewerten, Normen anwenden, Fachtexte verstehen.', labs: ['prj', 'nrm', 'eng'], pre: '' }
    ],
    wing: [
      { t: 'Mathematik', s: 'Komplexe Zahlen, Matrizen und Differenzialgleichungen, dazu das Rechnen zum Auffrischen. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
      { t: 'Technikgrundlagen', s: 'Wechselstrom, Signale und Messtechnik als gemeinsame Sprache mit den Technikern.', labs: ['wsl', 'sig', 'mess'], pre: '' },
      { t: 'Werkstoffe und Fertigung', s: 'Werkstoffe, Mechanik, Toleranzen und Fertigungsverfahren.', labs: ['wer', 'mch', 'tol', 'fer', 'fli'], pre: '' },
      { t: 'Automatisierung und Energie', s: 'Steuerung, Sensoren, Antriebe, Regelung und Energieversorgung.', labs: ['sps', 'sen', 'ant', 'reg', 'rg2', 'enr'], pre: '' },
      { t: 'Rechnungswesen', s: 'Kosten kalkulieren, Geschäftsfälle buchen und auswerten.', labs: ['kal', 'buc'], pre: '' },
      { t: 'Logistik und Recht', s: 'Warenfluss und Lager, Verträge und Auftragsabwicklung.', labs: ['wfl', 'lag', 'rec'], pre: '' },
      { t: 'Projekt, Normen und Fachenglisch', s: 'Projekte planen und wirtschaftlich bewerten, Normen anwenden, Fachtexte verstehen.', labs: ['prj', 'nrm', 'eng'], pre: '' }
    ],
    winf: [
      { t: 'Mathematik', s: 'Mathematische Grundlagen für Signale und Systeme, dazu das Rechnen zum Auffrischen. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.', labs: ['arb', 'ems', 'mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
      { t: 'Logik und Programmieren', s: 'Digitale Logik, Algorithmen, eigene Apps und Arduino.', labs: ['digi', 'alg', 'app', 'code'], pre: 'Die App-Werkstatt braucht kein Vorwissen' },
      { t: 'Datenbanken', s: 'Daten abfragen und verknüpfen mit SQL.', labs: ['sql'], pre: '' },
      { t: 'Systeme und Netze', s: 'PC-Hardware, IT-Systeme, Linux-Terminal, Netzwerke und Raspberry Pi.', labs: ['hwl', 'sys', 'lin', 'net', 'pi'], pre: 'Netzwerk-Lab zuerst' },
      { t: 'IT-Sicherheit', s: 'Gefahren erkennen und Schutzmaßnahmen auswählen.', labs: ['its'], pre: '' },
      { t: 'Signale und Embedded', s: 'Signale und Spektren, Mikrocontroller, Schnittstellen und Echtzeit.', labs: ['sig', 'emb'], pre: '' },
      { t: 'Betriebswirtschaft und Prozesse', s: 'Kalkulation, Buchführung, Warenfluss und Auftragsrecht.', labs: ['kal', 'buc', 'wfl', 'rec'], pre: '' },
      { t: 'Projekt, Normen und Fachenglisch', s: 'Projekte planen und bewerten, Normen anwenden, Fachtexte verstehen.', labs: ['prj', 'nrm', 'eng'], pre: '' }
    ]
  };
  const beruf = () => (root.BerufReg ? root.BerufReg.cur() : 'egs');
  const inBeruf = k => !root.BerufReg || root.BerufReg.has(k, beruf());
  function tracksFor() {
    const b = beruf(), base = b === 'egs' || !TRACKS_B[b] ? TRACKS : TRACKS_B[b];
    const tr = base.map(t => Object.assign({}, t, { labs: t.labs.filter(k => REG[k] && inBeruf(k) || (REG[k] && REG[k].hub && b === 'egs')) })).filter(t => t.labs.length);
    const listed = tr.reduce((a, t) => a.concat(t.labs), []);
    const rest = Object.keys(REG).filter(k => !REG[k].hub && inBeruf(k) && listed.indexOf(k) < 0);
    if (rest.length) tr.push({ t: 'Weitere Labs', s: 'Noch mehr zum Üben und Vertiefen.', labs: rest, pre: '' });
    /* Mit Lehrjahr (nur egs und ige): das Rechen-Lab kommt gleich nach dem SchaltLab (Paket L2); Spurtexte bleiben, ohne Lehrjahr ist die Spur wie vorher */
    if (ljAktiv() && listed.concat(rest).indexOf('mat') >= 0) {
      const si = tr.findIndex(t => t.labs.indexOf('sch') >= 0);
      if (si >= 0) {
        tr.forEach(t => { if (t.labs.indexOf('mat') >= 0) t.labs = t.labs.filter(k => k !== 'mat'); });
        tr[si].labs.splice(tr[si].labs.indexOf('sch') + 1, 0, 'mat');
        return tr.filter(t => t.labs.length);
      }
    }
    return tr;
  }
  /* Schritt "Projekte" für alle Berufe außer Elektroniker (v55.172): wird aus den registrierten Verbundprojekten abgeleitet (BerufReg.vbSummary, Quelle window.VB_INDEX),
     gleicher Beruf-Filter und gleicher Stand wie die Projekte-Zeile der Startseite; nichts wird doppelt gepflegt. Elektroniker (egs) behält die Hub-Karte "Projekte" in der Spur "Verbundprojekte". */
  function projTrack() {
    const b = beruf(), BR = root.BerufReg; if (b === 'egs' || !BR || !BR.vbSummary) return null;
    const sm = BR.vbSummary(b); if (!sm.n) return null;
    return { t: 'Projekte', s: 'Ein ganzer Auftrag aus deinem Beruf: Jede Station liefert ihr Ergebnis an die nächste, am Ende gibt es Gesamttest und Zertifikat.', pre: 'Am besten nach den Labs, die ein Projekt braucht', list: sm.list };
  }
  const LEVEL = { mat2: 'Studium', sig: 'Studium', rg2: 'Studium', emb: 'Studium', prj: 'Studium', nrm: 'Studium', fli: 'Studium', ems: 'Einstieg', sch: 'Einstieg', loch: 'Einstieg', mess: 'Mittel', els: 'Fortgeschritten', nts: 'Fortgeschritten', wsl: 'Fortgeschritten', ana: 'Fortgeschritten', digi: 'Mittel', sim: 'Mittel', haus: 'Fortgeschritten', app: 'Einstieg', pr: 'Fortgeschritten', code: 'Mittel', pi: 'Fortgeschritten', sps: 'Mittel', pcb: 'Mittel', ant: 'Mittel', sen: 'Mittel', reg: 'Fortgeschritten', thm: 'Mittel', emv: 'Fortgeschritten', hf: 'Fortgeschritten', enr: 'Mittel', ds: 'Mittel', vb: 'Fortgeschritten' };
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const results = () => { const m = {}; [get('sim.done', {}), get('lm4.tdone', {})].forEach(o => Object.keys(o || {}).forEach(k => { const v = +o[k] || 0; if (v > (m[k] || 0)) m[k] = v; })); return m; };
  const trained = lab => !!get('lm4.trainer', {})[lab];
  /* Lehrjahr des Weges: Zahl 1..4 nur für Berufe mit Datenlage und bekanntem Lehrjahr, sonst null (alles wie bisher) */
  const LJM = () => root.Lehrjahr || null;
  function ljAktiv() { const X = LJM(); if (!X) return null; try { const b = beruf(); return X.gilt(b) && (!X.bereit || X.bereit(b)) ? (X.wirksam() || null) : null; } catch (e) { return null; } }
  function stat(lab) {
    const res = results(), rows = ROWS.filter(r => r[1] === lab).sort((a, b) => a[4] - b[4]), done = rows.filter(r => (res[r[0]] || 0) >= 100), todo = rows.filter(r => (res[r[0]] || 0) < 100);
    const lv = rows.length ? rows.reduce((s, r) => s + r[4], 0) / rows.length : 1;
    const o = { n: rows.length, d: done.length, next: todo[0] || null, started: done.length > 0 || rows.some(r => (res[r[0]] || 0) > 0), level: LEVEL[lab] || (lv < 1.75 ? 'Einstieg' : lv < 2.4 ? 'Mittel' : 'Anspruchsvoll'), pct: rows.length ? Math.round(100 * done.length / rows.length) : 0 };
    /* Teil bis zum eigenen Lehrjahr: Aufgaben nach Lehrjahr, dann Schwierigkeit; "next" ist die nächste offene Aufgabe des Teils (sonst bleibt die des ganzen Labs) */
    const lj = rows.length ? ljAktiv() : null, X = LJM();
    if (lj && X) {
      const ids = {}; X.teil(lab, beruf(), lj).forEach(i => { ids[i] = 1; });
      const tr = rows.filter(r => ids[r[0]]).map((r, i) => [r, X.ab(r[0], lab, beruf()), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
      const td = tr.filter(r => (res[r[0]] || 0) >= 100), tt = tr.filter(r => (res[r[0]] || 0) < 100), s = X.summen(lab, beruf());
      o.lj = lj;
      o.t = { n: tr.length, d: td.length, pct: tr.length ? Math.round(100 * td.length / tr.length) : 0, next: tt[0] || null, lj, erst: s.findIndex(x => x > 0) + 1 };
      if (o.t.next) o.next = o.t.next;
    }
    return o;
  }
  /* Erstes Lehrjahr nach dem eigenen, in dem noch etwas offen ist (Angebot "schon ins nächste Lehrjahr schauen"): { lj, key, name, href, title } oder null */
  function naechstesLehrjahr(order, lj) {
    const X = LJM(), res = results(); if (!X) return null;
    for (let l = lj + 1; l <= 4; l++) {
      for (let i = 0; i < order.length; i++) {
        const k = order[i]; if (!REG[k]) continue;
        const ids = {}; X.teil(k, beruf(), l).forEach(x => { ids[x] = 1; });
        const open = ROWS.filter(r => r[1] === k && ids[r[0]] && (res[r[0]] || 0) < 100).map((r, j) => [r, X.ab(r[0], k, beruf()), j]).sort((a, b) => a[1] - b[1] || a[0][4] - b[0][4] || a[2] - b[2]);
        if (open.length) { const r = open[0][0]; return { lj: l, key: k, name: REG[k].name, href: REG[k].file + '?aufgabe=' + r[0], title: r[3] }; }
      }
    }
    return null;
  }
  // Empfehlung "wo weiter": das erste noch nicht fertige Lab in der Spurenreihenfolge, egal was sonst schon begonnen wurde (build() und Startseite "Weitermachen" nutzen dieselbe Logik)
  const WEITER = 80;   // ab 80 % gelöster Aufgaben darf man schon ins nächste Lab wechseln (nur ein Hinweis, der Pfad bleibt bis 100 % bei der Station; Abzeichen und Orden verlangen 100 %)
  /* Etappen je Beruf (v63.187, nur Berufe in dieser Tabelle): Der Pfad bleibt nicht bis 100 % in einem großen Lab. Eine Station gilt fürs Erste als geschafft, wenn pct Prozent ihres Teils gelöst sind,
     höchstens aber max Aufgaben. Dann führt die Empfehlung zur nächsten Station. Sind alle Stationen so weit, geht es in derselben Reihenfolge noch einmal durch die Reste bis 100 %.
     Für alle anderen Berufe gilt wie bisher: erste Station unter 100 %. */
  const ETAPPE = { im: { pct: 80, max: 30 } };
  function recommend(stc) {
    const st = stc || (() => { const o = {}; Object.keys(REG).forEach(k => { o[k] = stat(k); }); return o; })();
    const order = tracksFor().reduce((a, t) => a.concat(t.labs), []).filter(k => REG[k]);
    const lj = ljAktiv(), S = k => (lj && st[k] && st[k].t) || st[k];   // Sicht auf den Teil bis zum eigenen Lehrjahr (ohne Lehrjahr: das ganze Lab)
    const et = ETAPPE[beruf()] || null, offen = k => S(k).n && S(k).pct < 100, genug = k => S(k).d >= Math.min(Math.ceil(S(k).n * et.pct / 100), et.max);
    let rec = (et && order.find(k => offen(k) && !genug(k))) || order.find(offen) || null;   // erste offene Station in Pfadreihenfolge (ein später begonnenes Lab zieht den Pfad nicht vor)   // erste offene Station in Pfadreihenfolge (ein später begonnenes Lab zieht den Pfad nicht mehr vor)
    if (rec && REG.sch && order.indexOf('sch') >= 0 && !order.some(k => st[k].started || trained(k))) rec = 'sch';   // ganz neu: SchaltLab (wie der Hinweis "Neu hier? Beginne mit dem SchaltLab.")
    const nx = rec && S(rec).next ? S(rec) : null, R0 = rec ? REG[rec] : null;
    const began = !!rec && (st[rec].started || trained(rec));
    const href = !rec ? '' : (began ? (nx ? `${R0.file}?aufgabe=${nx.next[0]}` : R0.file) : `${R0.file}?trainer`);
    const txt = !rec ? '' : (began ? (nx ? 'Weiter: ' + R0.name + ' · ' + (nx.next[3].length > 30 ? nx.next[3].slice(0, 29) + '…' : nx.next[3]) : R0.name + ' öffnen') : 'Start: ' + R0.name + ' (Einführung)');
    /* Hinweis "du könntest schon wechseln": Station ab 80 %, dazu die nächste offene Station dahinter */
    let weiter = null;
    if (rec && S(rec).pct >= WEITER) { const nk = order.slice(order.indexOf(rec) + 1).find(k => S(k).n && S(k).pct < 100); if (nk) { const b2 = st[nk].started || trained(nk), n2 = S(nk).next; weiter = { von: rec, vonName: R0.name, pct: S(rec).pct, key: nk, name: REG[nk].name, href: b2 ? (n2 ? `${REG[nk].file}?aufgabe=${n2[0]}` : REG[nk].file) : `${REG[nk].file}?trainer` }; if (lj) weiter.lj = lj; } }
    const out = { rec, st, order, href, txt, started: began, next: nx ? nx.next : null, weiter };
    if (et && rec) { const vor = order.slice(0, order.indexOf(rec)).filter(offen); if (vor.length) out.etappe = { offen: vor }; }   // nur Berufe mit Etappen: frühere Stationen, in denen noch ein Rest offen ist
    if (lj) {   // nur mit Lehrjahr: Beschriftung der Station und der Zustand "Dein Lehrjahr ist geschafft"
      out.lj = lj;
      if (rec) { const t = st[rec].t; out.teilKurz = 'Teil ' + lj + '. Lehrjahr'; out.teilText = t ? 'Teil für das ' + lj + '. Lehrjahr (' + t.n + (t.n === 1 ? ' Aufgabe' : ' Aufgaben') + ')' : ''; }
      else { const f = naechstesLehrjahr(order, lj); if (f) out.fertigLj = f; }
    }
    return out;
  }
  /* Projekte-Spur als kurze Zeilen (Sortierung "Reihenfolge" im Lab-Raster): je Projekt ein Link mit Stand */
  function projHtml(PT) {
    if (!PT || !PT.list || !PT.list.length) return '';
    return `<ul class="lp-pj" id="lpProj" aria-label="${esc(PT.t)}">` + PT.list.map(p => {
      const pct = p.fin ? 100 : p.n ? Math.round(100 * Math.min(p.done, p.n) / p.n) : 0, href = 'verbund.html?projekt=' + encodeURIComponent(p.id);
      return `<li><a href="${esc(href)}"><span class="pj-i" aria-hidden="true">${esc(p.icon || '🧩')}</span><span class="pj-x"><b>${esc(p.name)}</b><small><span class="lvl">${p.fin ? 'Fertig' : p.started ? 'Läuft' : 'Neu'}</span> ${p.done} von ${p.n} Stationen</small><span class="bar"><i style="width:${pct}%"></i></span></span><span class="pj-go">${p.fin ? 'Wiederholen' : p.started ? 'Weiter' : 'Projekt starten'}</span></a></li>`;
    }).join('') + '</ul>';
  }
  const css = '.mp .mp-lj{margin-top:2px;color:var(--mute);font-size:14px;line-height:1.3}html.tiles .mp .mp-lj{margin:0}#groups[data-sort=pfad] .mp-lj.mp-ab{display:none}.card .lp-mk.lp-ab{background:none;color:var(--mute);font-weight:400;padding:2px 0}.lp-ljn{margin:0 0 10px;color:var(--mute);font-size:14px;line-height:1.4}@media(max-width:639px){html.tiles .cards .card .mp .mp-lj{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}}.mp{margin:2px 0 4px}.mp .bar{height:5px;border-radius:3px;background:var(--panel2);overflow:hidden}.mp .bar i{display:block;height:100%;background:#4cd964}.mp small{display:flex;justify-content:space-between;color:var(--mute);font-size:12px;margin-top:3px}';
  /* Karten: zusätzliche Zeile mit dem Teil für das eigene Lehrjahr ("Teil 1. Lehrjahr: 9 von 14") oder dem Hinweis "Ab 2. Lehrjahr". Prozent und Streifen bleiben der Gesamtfortschritt. */
  function ljZeilen() {
    document.querySelectorAll('.card .mp .mp-lj').forEach(x => x.remove());
    const lj = ljAktiv(); if (!lj) return;
    document.querySelectorAll('.card:not(.vbrow)').forEach(c => {
      const p = c.querySelector('.mp'), a = c.querySelector('.btns a'); if (!p || !a) return;
      const file = (a.dataset.file || a.getAttribute('href') || '').split(/[?#]/)[0], key = Object.keys(REG).find(k => REG[k].file === file); if (!key) return;
      const s = stat(key); if (!s.t || !s.n) return;
      const tx = s.t.n === 0 ? 'Ab ' + s.t.erst + '. Lehrjahr' : s.t.n < s.n ? 'Teil ' + lj + '. Lehrjahr: ' + s.t.d + ' von ' + s.t.n : '';
      if (!tx) return; const e = document.createElement('div'); e.className = 'mp-lj' + (s.t.n === 0 ? ' mp-ab' : ''); e.textContent = tx; p.appendChild(e);
    });
  }
  function build() {
    if (!document.getElementById('top') || document.getElementById('lpCss')) return;   // nur auf der Startseite, nur einmal
    const st = {}; Object.keys(REG).forEach(k => { st[k] = stat(k); });
    const K = root.Kampagne && root.Kampagne.fuer ? root.Kampagne.fuer(beruf()) : (beruf() === 'egs' ? root.Kampagne : null), KI = K && K.info ? K.info() : null, kt = K ? K.CH.reduce((n, c) => n + c.m.length, 0) : 0, kd = K ? K.CH.reduce((n, c) => n + K.prog(c).d, 0) : 0;
    const style = document.createElement('style'); style.id = 'lpCss'; style.textContent = css; document.head.appendChild(style);
    /* Ansicht "Ich": eine Tür zur Karriere (Rang, XP, Kampagne); die Karte #karCard aus karriereui.js und die alte Kampagnen-Karte entfallen dann */
    const ich = document.getElementById('ichRang'), KR = root.Karriere && root.Karriere.summary ? root.Karriere.summary() : null;
    if (ich && (KR || K)) {
      const tx = KR ? `<b>Rang ${KR.n} · ${esc(KR.t)}</b><small>${KR.xp} XP${KR.next ? ' · nächster Rang bei ' + KR.next.xp + ' XP' : ''}${K ? ' · Kampagne ' + kd + ' von ' + kt + ' Missionen' : ''}. Abzeichen und alle Ränge im Karriere-Fenster.</small>`
        : `<b>Kampagne: ${esc(KI ? KI.titel : 'Das Abschlussgerät')}</b><small>${K.CH.length}${esc(KI ? KI.karte : ' Kapitel mit Meister Funk durch alle Labs. ')}${kd} von ${kt} Missionen erledigt.</small>`;
      ich.innerHTML = `<div class="mw-t mw-2 lp-rang"><span class="mw-i" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" focusable="false"><use href="#i-medal"/></svg></span><span class="mw-x">${tx}</span><a href="#" id="lpKamp" class="mw-b">${KR ? 'Karriere öffnen' : 'Kampagne öffnen'}</a></div>`;
      const kb = document.getElementById('lpKamp'); if (kb) kb.onclick = e => { e.preventDefault(); if (root.Karriere && root.Karriere.open) root.Karriere.open(); else K.open(); };
      ['kampCard', 'karCard'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); });
    }
    // Fortschritt auch in den Karten
    document.querySelectorAll('.card:not(.vbrow)').forEach(c => {
      const a = c.querySelector('.btns a'); if (!a) return; const file = a.getAttribute('href').split('?')[0], key = Object.keys(REG).find(k => REG[k].file === file); if (!key || !st[key].n) return;
      const s = st[key], p = document.createElement('div'); p.className = 'mp'; p.innerHTML = `<div class="bar"><i style="width:${s.pct}%"></i></div><small><span>${s.level}</span><span>${s.d} von ${s.n} Aufgaben</span></small>`;
      const steps = c.querySelector('.steps'); (steps || c.querySelector('p')).insertAdjacentElement('afterend', p);
    });
    try { ljZeilen(); } catch (e) { console.error(e); }
    try { root.dispatchEvent(new Event('lernpfad:fertig')); } catch (e) {}
  }
  /* Das Lehrjahr wurde geändert (lehrjahr-ui.js): Zeilen neu, dann alle, die auf "lernpfad:fertig" hören (blaue Karte, Knöpfe, Sortierung), neu rechnen */
  if (root.addEventListener) root.addEventListener('lernpfad:lj', () => { try { ljZeilen(); } catch (e) { console.error(e); } try { root.dispatchEvent(new Event('lernpfad:fertig')); } catch (e) {} });
  const run = () => { try { build(); } catch (e) { console.error(e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 60)); else setTimeout(run, 60);
  root.Lernpfad = { build, stat, recommend, TRACKS, TRACKS_B, tracksFor, projTrack, projHtml, LEVEL, ljAktiv, ljZeilen, ETAPPE };
})(window);
