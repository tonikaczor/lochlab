'use strict';
/* Tonfunk Lab: Lernpfad der Startseite.
   Spuren je Beruf mit empfohlener Reihenfolge, Schwierigkeit und Fortschritt je Lab. Der Fortschritt kommt aus den vorhandenen Ergebnissen (sim.done, lm4.tdone),
   die Liste der Labs und Aufgaben aus aufgaben.js.
   Seit dem Umbau in fünf Ansichten (S1) ist der Lernpfad kein eigener Bereich mehr: er ist die Sortierung "Reihenfolge" im Lab-Raster (home-groups.js liest
   tracksFor(), projTrack() und projHtml()). build() trägt die Fortschrittszeile in die Karten ein und baut in der Ansicht "Ich" die Zeile Rang und Karriere (#ichRang). */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const REG = root.LAB_REG || {}, ROWS = root.AUFGABEN || [];
  const TRACKS = [
    { t: 'Elektronik von Grund auf', s: 'Von der einfachen Schaltung über das Löten und die Digitaltechnik bis zur Messtechnik, zur elektrischen Sicherheit und Geräteprüfung, zu Netzteilen und Schaltreglern, zu Wechselstrom und Schwingkreisen, zur Analogtechnik mit Diode, Transistor und Operationsverstärker, zur Leiterplatte, zur speicherprogrammierbaren Steuerung (SPS), zu den Antrieben, zur Sensorik, zur Regelungstechnik, zur Wärmeabfuhr mit dem Kühlkörper und zur elektromagnetischen Verträglichkeit (EMV) und zur Solartechnik (Energie).', labs: ['sch', 'loch', 'digi', 'mess', 'els', 'nts', 'wsl', 'ana', 'sps', 'pcb', 'ant', 'sen', 'reg', 'thm', 'emv', 'enr'] },
    { t: 'Installation und Anlagen', s: 'Wie Strom im Haus verteilt, geschaltet und abgesichert wird.', labs: ['sim', 'haus'], pre: 'Empfohlen vorher: SchaltLab' },
    { t: 'Prüfungsvorbereitung', s: 'Die Abschlussprüfung üben: Datenblätter lesen (Grenzwerte, Kennlinien, Fachenglisch), Themen trainieren, Rechnen, Probeprüfung mit Zeitlimit und Auswertung. Das Thema Sicherheit und Normen übst du zusätzlich nach dem Sicherheits-Lab: die Abschaltbedingung, die Schutzmaßnahmen und die Geräteprüfung kommen in der Prüfung vor. Das Thema Stromversorgung übst du nach dem Netzteil-Lab: Gleichrichter, Siebung, Z-Diode, Linearregler und Schaltregler kommen in der Prüfung vor. Das Thema Wechselstrom und Filter übst du nach dem Wechselstrom-Lab: Zeigerdiagramm, Blindleistung, Schwingkreis, RC-Filter und Transformator kommen in der Prüfung vor. Das Thema Bauelemente übst du nach dem Analogtechnik-Lab: Diode, LED-Vorwiderstand, Transistor als Schalter, Arbeitspunkt und Operationsverstärker kommen in der Prüfung vor.', labs: ['ds', 'pr'], links: [['lernfelder.html', 'Lernfelder der Berufsschule: Aufgaben und Probetest'], ['pruefungslab.html?thema=sicherheit', 'Sicherheit und Normen üben (Prüfungs-Lab)'], ['elslab.html', 'Dazu im Sicherheits-Lab ausprobieren'], ['pruefungslab.html?thema=netzteile', 'Stromversorgung üben (Prüfungs-Lab)'], ['ntslab.html', 'Dazu im Netzteil-Lab ausprobieren'], ['pruefungslab.html?thema=wechselstrom', 'Wechselstrom und Filter üben (Prüfungs-Lab)'], ['wsllab.html', 'Dazu im Wechselstrom-Lab ausprobieren'], ['pruefungslab.html?thema=analog', 'Bauelemente und Verstärker üben (Prüfungs-Lab)'], ['analab.html', 'Dazu im Analogtechnik-Lab ausprobieren']], pre: 'Am besten nach SchaltLab, DigiLab und MessLab' },
    { t: 'Programmieren und Steuern', s: 'Eigene Apps mit KI bauen, dann Schaltungen mit Programmen steuern: Arduino und Raspberry Pi.', labs: ['app', 'code', 'pi'], pre: 'Die App-Werkstatt braucht kein Vorwissen. Für Arduino und Pi empfohlen: SchaltLab' },
    { t: 'Verbundprojekte', s: 'Alle Labs arbeiten zusammen an einem Gerät: Garagentor, Ampel, Digitale Uhr, Gartenbewässerung, Förderanlage, Labornetzteil und Heizungsregelung (für andere Berufe gibt es eigene Projekte im Projekt-Bereich). Jede Station liefert ihr Ergebnis an die nächste, am Ende gibt es Gesamttest und Zertifikat.', labs: ['vb'], pre: 'Am besten nach den Labs, die ein Projekt braucht (Datenblatt, Schaltplan, Leiterplatte, Messen, Antrieb, Sensorik, SPS)' }
  ];
  /* Spuren der anderen Berufe (v39.158). Labs, die der Beruf hat, aber in keiner Spur stehen, kommen unter „Weitere Labs“; Labs ohne Beruf-Zuordnung (z. B. noch gesperrt) fehlen. */
  const TRACKS_B = {
    ige: [
      { t: 'Grundlagen und Grundschaltungen', s: 'Rechnen, Schaltpläne lesen, einfache Schaltungen aufbauen und simulieren, dazu Wechselstrom ohne Formelstress.', labs: ['sch', 'mat', 'loch', 'sim', 'wsl'], pre: 'Erst das SchaltLab, beim Rechnen hilft das Rechen-Lab' },
      { t: 'Sicherungen, Hausinstallation und Sicherheit', s: 'Wie Strom im Haus abgesichert, verteilt und geschaltet wird, was bei der elektrischen Sicherheit zählt und was Energie kostet.', labs: ['els', 'haus', 'enr'], pre: 'Empfohlen vorher: SchaltLab' },
      { t: 'Messen, Netzteile und Elektronik', s: 'Mit dem Multimeter sicher messen, Netzteile und einfache Halbleiterschaltungen verstehen, Logikschaltungen kennenlernen und Datenblätter lesen.', labs: ['mess', 'nts', 'ana', 'digi', 'ds'], pre: '' },
      { t: 'Steuerungen, Antriebe und Sensoren', s: 'Schaltschrank-Steuerungen einfach erklärt: SPS, Motoren und Sensoren.', labs: ['sps', 'ant', 'sen'], pre: 'Empfohlen vorher: SchaltLab' },
      { t: 'Prüfung und Berufsalltag', s: 'Die Abschlussprüfung üben, Fachenglisch und das Berichtsheft.', labs: ['pr', 'eng', 'bhf'], pre: '' }
    ],
    im: [
      { t: 'Grundlagen der Fertigung', s: 'Rechnen, Toleranzen und Passungen, Werkstoffe und Zeichnungen: das Handwerkszeug für jede Werkstatt.', labs: ['mat', 'mch', 'tol', 'wer', 'zei'], pre: 'Das Rechen-Lab ist ein guter Start' },
      { t: 'Zerspanen und CNC', s: 'Schnittwerte berechnen, Drehzahlen und Vorschübe wählen, CNC-Programme lesen und verstehen.', labs: ['zer', 'fer', 'mak', 'cnc'], pre: 'Empfohlen vorher: Toleranz-Lab' },
      { t: 'Fügen und Maschinenelemente', s: 'Schweißen, Löten, Kleben und Schrauben richtig wählen und rechnen, dazu Zahnräder, Riemen, Lager und Federn.', labs: ['fug', 'mas'], pre: 'Empfohlen vorher: Werkstoff-Lab' },
      { t: 'Pneumatik, Hydraulik und Steuern', s: 'Schaltpläne lesen, Zylinder und Ventile ansteuern, Sensoren, Antriebe, SPS und Regelung.', labs: ['pne', 'hyd', 'sen', 'sps', 'ant', 'reg'], pre: 'Empfohlen vorher: Pneumatik-Lab' },
      { t: 'Instandhaltung und Sicherheit', s: 'Anlagen warten, Fehler systematisch suchen, sicher arbeiten, messen und Wärme verstehen.', labs: ['ins', 'els', 'mess', 'thm'], pre: '' }
    ],
    tpd: [
      { t: 'Zeichnen und Toleranzen', s: 'Ansichten und Schnitte, Bemaßung nach Norm, Toleranzen und Passungen und das Rechnen dazu.', labs: ['mat', 'zei', 'tol'], pre: 'Das Rechen-Lab ist ein guter Start' }
    ],
    fll: [
      { t: 'Lager und Logistik', s: 'Kennzahlen, ABC-Analyse, Bestellmengen und Flurförderzeuge; dazu das Rechnen, das du täglich brauchst.', labs: ['mat', 'lag', 'lad'], pre: 'Das Rechen-Lab ist ein guter Start' }
    ],
    ik: [
      { t: 'Kaufmännisches Rechnen', s: 'Prozent, Dreisatz, Bezugs- und Selbstkostenkalkulation, Handelsspanne und Break-even; dazu die Buchführung.', labs: ['mat', 'kal', 'buc'], pre: 'Das Rechen-Lab ist ein guter Start' }
    ],
    fi: [
      { t: 'Netze und Sicherheit', s: 'Binär, Subnetting, Ports und Protokolle; dazu die Grundlagen der IT-Sicherheit.', labs: ['net', 'its', 'mat'], pre: 'Netzwerk-Lab zuerst' },
      { t: 'Digitaltechnik und Programmieren', s: 'Logik und Zahlensysteme, eigene Apps, Arduino und Raspberry Pi, Datenblätter lesen.', labs: ['digi', 'app', 'code', 'pi', 'ds'], pre: 'Die App-Werkstatt braucht kein Vorwissen' }
    ],
    /* Wege Studium und Technik (v55.174): Module statt Spuren der Ausbildung. Dieselbe Lab-Auswahl steht in den Karten (data-beruf in index.html) und in ausbildungsplan-<weg>.js; quelle/beruf/test_wege.js prüft die Übereinstimmung. */
    tec: [
      { t: 'Mathematik für die Technik', s: 'Komplexe Zahlen, Matrizen und Differenzialgleichungen an Schaltungen, dazu das Rechnen aus der Ausbildung zum Auffrischen.', labs: ['mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
      { t: 'Wechselstrom, Signale und Messtechnik', s: 'Wechselstromnetze und Schwingkreise, Spektrum und Filter, sicheres und genaues Messen.', labs: ['wsl', 'sig', 'mess'], pre: '' },
      { t: 'Elektronik und Digitaltechnik', s: 'Diode, Transistor und Operationsverstärker, Netzteile, Logikschaltungen und Datenblätter.', labs: ['ana', 'nts', 'digi', 'ds'], pre: '' },
      { t: 'Automatisierung und Antriebe', s: 'Steuerungen und Schaltschrank, Motoren und Sensoren.', labs: ['sps', 'ssl', 'ant', 'sen'], pre: '' },
      { t: 'Regelungstechnik', s: 'Erst den Regelkreis verstehen, dann Bode, Stabilität und Reglerentwurf.', labs: ['reg', 'rg2'], pre: 'Empfohlen vorher: Mathe-Brücke' },
      { t: 'Mikrocontroller', s: 'Timer, Schnittstellen und Echtzeit, dazu Arduino.', labs: ['code', 'emb'], pre: '' },
      { t: 'Energie, Sicherheit und Verträglichkeit', s: 'Energieanlagen, elektrische Sicherheit, EMV und Wärme.', labs: ['enr', 'els', 'emv', 'thm'], pre: '' },
      { t: 'Normen, Projekt und Betrieb', s: 'Normen und Konformität, Projekte planen und bewerten, Kosten kalkulieren, Fachenglisch.', labs: ['nrm', 'prj', 'fli', 'kal', 'eng'], pre: '' }
    ],
    stu: [
      { t: 'Mathematik', s: 'Die Mathematik des Studiums direkt an Schaltungen, dazu das Rechnen aus der Schule zum Auffrischen.', labs: ['mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
      { t: 'Netzwerke, Signale und Messtechnik', s: 'Wechselstromnetze, Spektrum, Abtastung und Filter, Messen mit Verstand.', labs: ['wsl', 'sig', 'mess'], pre: '' },
      { t: 'Elektronik', s: 'Halbleiter und Verstärker, Netzteile, Digitaltechnik, Datenblätter und Leiterplatten.', labs: ['ana', 'nts', 'digi', 'ds', 'pcb'], pre: '' },
      { t: 'Regelung und Systeme', s: 'Regelkreise und ihr Entwurf, Sensoren und Antriebe.', labs: ['reg', 'rg2', 'sen', 'ant'], pre: 'Empfohlen vorher: Mathe-Brücke' },
      { t: 'Eingebettete Systeme und Programmieren', s: 'Mikrocontroller, Arduino, Algorithmen und Raspberry Pi.', labs: ['code', 'emb', 'alg', 'pi'], pre: '' },
      { t: 'Energie, EMV und Wärme', s: 'Energiesysteme, elektromagnetische Verträglichkeit und Wärmeabfuhr.', labs: ['enr', 'emv', 'thm'], pre: '' },
      { t: 'Projekt, Normen und Fachenglisch', s: 'Projekte planen und bewerten, Normen anwenden, Fachtexte verstehen.', labs: ['prj', 'nrm', 'eng'], pre: '' }
    ],
    wing: [
      { t: 'Mathematik', s: 'Komplexe Zahlen, Matrizen und Differenzialgleichungen, dazu das Rechnen zum Auffrischen.', labs: ['mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
      { t: 'Technikgrundlagen', s: 'Wechselstrom, Signale und Messtechnik als gemeinsame Sprache mit den Technikern.', labs: ['wsl', 'sig', 'mess'], pre: '' },
      { t: 'Werkstoffe und Fertigung', s: 'Werkstoffe, Mechanik, Toleranzen und Fertigungsverfahren.', labs: ['wer', 'mch', 'tol', 'fer', 'fli'], pre: '' },
      { t: 'Automatisierung und Energie', s: 'Steuerung, Sensoren, Antriebe, Regelung und Energieversorgung.', labs: ['sps', 'sen', 'ant', 'reg', 'rg2', 'enr'], pre: '' },
      { t: 'Rechnungswesen', s: 'Kosten kalkulieren, Geschäftsfälle buchen und auswerten.', labs: ['kal', 'buc'], pre: '' },
      { t: 'Logistik und Recht', s: 'Warenfluss und Lager, Verträge und Auftragsabwicklung.', labs: ['wfl', 'lag', 'rec'], pre: '' },
      { t: 'Projekt, Normen und Fachenglisch', s: 'Projekte planen und wirtschaftlich bewerten, Normen anwenden, Fachtexte verstehen.', labs: ['prj', 'nrm', 'eng'], pre: '' }
    ],
    winf: [
      { t: 'Mathematik', s: 'Mathematische Grundlagen für Signale und Systeme, dazu das Rechnen zum Auffrischen.', labs: ['mat', 'mat2'], pre: 'Das Rechen-Lab ist eine gute Auffrischung' },
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
    return tr;
  }
  /* Schritt "Projekte" für alle Berufe außer Elektroniker (v55.172): wird aus den registrierten Verbundprojekten abgeleitet (BerufReg.vbSummary, Quelle window.VB_INDEX),
     gleicher Beruf-Filter und gleicher Stand wie die Projekte-Zeile der Startseite; nichts wird doppelt gepflegt. Elektroniker (egs) behält die Hub-Karte "Projekte" in der Spur "Verbundprojekte". */
  function projTrack() {
    const b = beruf(), BR = root.BerufReg; if (b === 'egs' || !BR || !BR.vbSummary) return null;
    const sm = BR.vbSummary(b); if (!sm.n) return null;
    return { t: 'Projekte', s: 'Ein ganzer Auftrag aus deinem Beruf: Jede Station liefert ihr Ergebnis an die nächste, am Ende gibt es Gesamttest und Zertifikat.', pre: 'Am besten nach den Labs, die ein Projekt braucht', list: sm.list };
  }
  const LEVEL = { mat2: 'Studium', sig: 'Studium', rg2: 'Studium', emb: 'Studium', prj: 'Studium', nrm: 'Studium', fli: 'Studium', sch: 'Einstieg', loch: 'Einstieg', mess: 'Mittel', els: 'Fortgeschritten', nts: 'Fortgeschritten', wsl: 'Fortgeschritten', ana: 'Fortgeschritten', digi: 'Mittel', sim: 'Mittel', haus: 'Fortgeschritten', app: 'Einstieg', pr: 'Fortgeschritten', code: 'Mittel', pi: 'Fortgeschritten', sps: 'Mittel', pcb: 'Mittel', ant: 'Mittel', sen: 'Mittel', reg: 'Fortgeschritten', thm: 'Mittel', emv: 'Fortgeschritten', enr: 'Mittel', ds: 'Mittel', vb: 'Fortgeschritten' };
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const results = () => { const m = {}; [get('sim.done', {}), get('lm4.tdone', {})].forEach(o => Object.keys(o || {}).forEach(k => { const v = +o[k] || 0; if (v > (m[k] || 0)) m[k] = v; })); return m; };
  const trained = lab => !!get('lm4.trainer', {})[lab];
  function stat(lab) {
    const res = results(), rows = ROWS.filter(r => r[1] === lab).sort((a, b) => a[4] - b[4]), done = rows.filter(r => (res[r[0]] || 0) >= 100), todo = rows.filter(r => (res[r[0]] || 0) < 100);
    const lv = rows.length ? rows.reduce((s, r) => s + r[4], 0) / rows.length : 1;
    return { n: rows.length, d: done.length, next: todo[0] || null, started: done.length > 0 || rows.some(r => (res[r[0]] || 0) > 0), level: LEVEL[lab] || (lv < 1.75 ? 'Einstieg' : lv < 2.4 ? 'Mittel' : 'Anspruchsvoll'), pct: rows.length ? Math.round(100 * done.length / rows.length) : 0 };
  }
  // Empfehlung "wo weiter": das erste noch nicht fertige Lab in der Spurenreihenfolge, egal was sonst schon begonnen wurde (build() und Startseite "Weitermachen" nutzen dieselbe Logik)
  const WEITER = 80;   // ab 80 % gelöster Aufgaben darf man schon ins nächste Lab wechseln (nur ein Hinweis, der Pfad bleibt bis 100 % bei der Station; Abzeichen und Orden verlangen 100 %)
  function recommend(stc) {
    const st = stc || (() => { const o = {}; Object.keys(REG).forEach(k => { o[k] = stat(k); }); return o; })();
    const order = tracksFor().reduce((a, t) => a.concat(t.labs), []).filter(k => REG[k]);
    let rec = order.find(k => st[k].n && st[k].pct < 100) || null;   // erste offene Station in Pfadreihenfolge (ein später begonnenes Lab zieht den Pfad nicht vor)   // erste offene Station in Pfadreihenfolge (ein später begonnenes Lab zieht den Pfad nicht mehr vor)
    if (rec && REG.sch && order.indexOf('sch') >= 0 && !order.some(k => st[k].started || trained(k))) rec = 'sch';   // ganz neu: SchaltLab (wie der Hinweis "Neu hier? Beginne mit dem SchaltLab.")
    const nx = rec && st[rec].next ? st[rec] : null, R0 = rec ? REG[rec] : null;
    const began = !!rec && (st[rec].started || trained(rec));
    const href = !rec ? '' : (began ? (nx ? `${R0.file}?aufgabe=${nx.next[0]}` : R0.file) : `${R0.file}?trainer`);
    const txt = !rec ? '' : (began ? (nx ? 'Weiter: ' + R0.name + ' · ' + (nx.next[3].length > 30 ? nx.next[3].slice(0, 29) + '…' : nx.next[3]) : R0.name + ' öffnen') : 'Start: ' + R0.name + ' (Einführung)');
    /* Hinweis "du könntest schon wechseln": Station ab 80 %, dazu die nächste offene Station dahinter */
    let weiter = null;
    if (rec && st[rec].pct >= WEITER) { const nk = order.slice(order.indexOf(rec) + 1).find(k => st[k].n && st[k].pct < 100); if (nk) { const b2 = st[nk].started || trained(nk), n2 = st[nk].next; weiter = { von: rec, vonName: R0.name, pct: st[rec].pct, key: nk, name: REG[nk].name, href: b2 ? (n2 ? `${REG[nk].file}?aufgabe=${n2[0]}` : REG[nk].file) : `${REG[nk].file}?trainer` }; } }
    return { rec, st, order, href, txt, started: began, next: nx ? nx.next : null, weiter };
  }
  /* Projekte-Spur als kurze Zeilen (Sortierung "Reihenfolge" im Lab-Raster): je Projekt ein Link mit Stand */
  function projHtml(PT) {
    if (!PT || !PT.list || !PT.list.length) return '';
    return `<ul class="lp-pj" id="lpProj" aria-label="${esc(PT.t)}">` + PT.list.map(p => {
      const pct = p.fin ? 100 : p.n ? Math.round(100 * Math.min(p.done, p.n) / p.n) : 0, href = 'verbund.html?projekt=' + encodeURIComponent(p.id);
      return `<li><a href="${esc(href)}"><span class="pj-i" aria-hidden="true">${esc(p.icon || '🧩')}</span><span class="pj-x"><b>${esc(p.name)}</b><small><span class="lvl">${p.fin ? 'Fertig' : p.started ? 'Läuft' : 'Neu'}</span> ${p.done} von ${p.n} Stationen</small><span class="bar"><i style="width:${pct}%"></i></span></span><span class="pj-go">${p.fin ? 'Wiederholen' : p.started ? 'Weiter' : 'Projekt starten'}</span></a></li>`;
    }).join('') + '</ul>';
  }
  const css = '.mp{margin:2px 0 4px}.mp .bar{height:5px;border-radius:3px;background:var(--panel2);overflow:hidden}.mp .bar i{display:block;height:100%;background:#4cd964}.mp small{display:flex;justify-content:space-between;color:var(--mute);font-size:12px;margin-top:3px}';
  function build() {
    if (!document.getElementById('top') || document.getElementById('lpCss')) return;   // nur auf der Startseite, nur einmal
    const st = {}; Object.keys(REG).forEach(k => { st[k] = stat(k); });
    const K = beruf() === 'egs' ? root.Kampagne : null, kt = K ? K.CH.reduce((n, c) => n + c.m.length, 0) : 0, kd = K ? K.CH.reduce((n, c) => n + K.prog(c).d, 0) : 0;
    const style = document.createElement('style'); style.id = 'lpCss'; style.textContent = css; document.head.appendChild(style);
    /* Ansicht "Ich": eine Tür zur Karriere (Rang, XP, Kampagne); die Karte #karCard aus karriereui.js und die alte Kampagnen-Karte entfallen dann */
    const ich = document.getElementById('ichRang'), KR = root.Karriere && root.Karriere.summary ? root.Karriere.summary() : null;
    if (ich && (KR || K)) {
      const tx = KR ? `<b>Rang ${KR.n} · ${esc(KR.t)}</b><small>${KR.xp} XP${KR.next ? ' · nächster Rang bei ' + KR.next.xp + ' XP' : ''}${K ? ' · Kampagne ' + kd + ' von ' + kt + ' Missionen' : ''}. Abzeichen und alle Ränge im Karriere-Fenster.</small>`
        : `<b>Kampagne: Das Abschlussgerät</b><small>${K.CH.length} Kapitel mit Meister Funk durch alle Labs. ${kd} von ${kt} Missionen erledigt.</small>`;
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
    try { root.dispatchEvent(new Event('lernpfad:fertig')); } catch (e) {}
  }
  const run = () => { try { build(); } catch (e) { console.error(e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 60)); else setTimeout(run, 60);
  root.Lernpfad = { build, stat, recommend, TRACKS, TRACKS_B, tracksFor, projTrack, projHtml, LEVEL };
})(window);
