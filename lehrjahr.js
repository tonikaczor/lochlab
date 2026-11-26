'use strict';
/* Tonfunk Lab: Lehrjahr je Aufgabe und eigenes Lehrjahr (Datenmodul, reine Funktionen, läuft im Browser und in Node; window.Lehrjahr bzw. module.exports).
   Paket L2 (16.11.2026). Der Lernpfad der Startseite (lernpfad.js, home-cont.js, home-groups.js) führt damit nur durch den Teil jedes Labs bis zum eigenen Lehrjahr.
   Nichts wird gesperrt: alle Aufgaben bleiben in den Labs frei wählbar; Orden, 100 %, Fortschritt und Ausbilder-Auswertung rechnen weiter über alle Aufgaben.

   SCHNITTSTELLE (ein zweites Paket, L3, baut die Aufgabenlisten der Labs darauf):
     Lehrjahr.ab(id, lab, beruf?)     -> 1..4, frühestens sinnvolles Lehrjahr der Aufgabe (ohne beruf oder für egs, ige: wie bisher; für im: aus dem Ausbildungsplan)
     Lehrjahr.gilt(beruf)             -> true nur für Berufe mit Datenlage (egs, ige, im); für alle anderen bleibt alles wie bisher
     Lehrjahr.bereit(beruf)           -> false nur, solange für einen Beruf mit Plan (im) der Ausbildungsplan noch nicht geladen ist (bis dahin wird nicht gefiltert); stößt das Laden an
     Lehrjahr.mein(store?, jetzt?)    -> 1..4 oder null (nicht angegeben); Handwert lm4.lehrjahr (mit Stichtag, zählt am 1. August weiter, höchstens 4), sonst aus lm4.jahrgang
     Lehrjahr.setz(n, store?, jetzt?) -> Handwert setzen (n = 1..4) oder zurücknehmen (n = null)
     Lehrjahr.teil(lab, beruf, lj)    -> Liste der Aufgaben-IDs des Labs bis einschließlich Lehrjahr lj (für Berufe ohne Datenlage: alle)
     Lehrjahr.spaeter(lab, beruf, lj) -> der Rest als [{ id, lj }] (für Berufe ohne Datenlage: leer)
   Dazu für die Oberfläche: wirksam() (das Lehrjahr, nach dem der Pfad filtert; berücksichtigt die Vorgabe 1 für ganz neue Geräte), frageNoetig(), frageErledigt(), init(), summen(lab).

   WIE DAS LEHRJAHR EINER AUFGABE ENTSTEHT (ab):
     1. AUSNAHMEN[lab][id], wenn dort eine Zahl steht.
     2. sonst das Lehrjahr des Lernfelds (lernfelder.js, lfOf und Katalog LF), wenn es 1 bis 4 ist.
     3. sonst VORGABE[lab] (Zeilen ohne Lernfeld), sonst 1.
   AUSNAHMEN ändern: Der Ausbilder darf die Tabellen hier von Hand ändern (nur diese Datei). Eine Zeile "id: Lehrjahr" genügt; der Kommentar dahinter nennt den Titel.
   Entstanden aus quelle/lernfaden/LEHRJAHR-KONZEPT.md (Spalte Vorschlag) und den Entscheidungen von Toni vom 16.11.2026:
     (Die drei Schritte oben gelten für egs, ige und für alle Aufrufe ohne Beruf. Industriemechaniker: siehe Abschnitt 2b.)
     Z-Diode, 555 und 7805 (dazu der LM317 und Linearregler) ab 2. Lehrjahr; Transistor, Gleichrichter, OPV, Tiefpass und RC-Zeitkonstante ab 2;
     einfache Oszilloskop-Bedienung im MessLab im 1. Lehrjahr, anspruchsvolle (Mischspannung, Phase, Kopplung, Frequenzgang) ab 2;
     Sicherheitsregeln, Rettungskette, Brandschutz im 1. Lehrjahr; Technisches Englisch ab 2. */
(function (root) {
  /* ---------------------------------------------------------------- 1. Tabellen */
  /* Berufe mit Datenlage: nur dort wird gefiltert */
  const BERUFE = ['egs', 'ige', 'im'];
  /* Berufe, bei denen das Lehrjahr aus dem Ausbildungsplan kommt (ausbildungsplan-<beruf>.js, Feld jahr der Lernfelder). Regel in Abschnitt 2b. */
  const PLANBERUFE = ['im'];
  /* Ausnahmen für Industriemechaniker: Lab -> { Aufgaben-ID: Lehrjahr }. Geht dem Plan vor. Nur für Einzelfälle; alles andere regelt der Plan.
     Beispiel: mat: { mat33: 2 } */
  const AUSNAHMEN_IM = {};
  const AUSNAHMEN_PLAN = { im: AUSNAHMEN_IM };
  /* Vorgabe je Lab für Zeilen ohne Lernfeld; Labs, die hier fehlen, bekommen 1 */
  const VORGABE = { sch: 1, loch: 1, digi: 1, mess: 1, sim: 1, haus: 1, els: 1, nts: 1, wsl: 1, ana: 1, thm: 1, sps: 1, pcb: 1, ant: 1, sen: 1, reg: 3, emv: 2, hf: 3, enr: 2, ds: 2, pr: 2, code: 1, pi: 1, app: 1, mat: 1, eng: 2, bhf: 1, alg: 1, sys: 1, ssl: 1, sya: 3 };
  /* Ausnahmen je Lab: Aufgaben-ID -> frühestes Lehrjahr. Nur Aufgaben, die vom Lernfeld abweichen oder kein Lernfeld haben und nicht zur Vorgabe passen. */
  const AUSNAHMEN = {
    // Systemanalyse-Lab (sya), v69.192: Teil 2 der Abschlussprüfung, alles ab dem 3. Lehrjahr, diese Aufgaben erst im 4.
    sya: { sya16: 4, sya17: 4, sya18: 4, sya19: 4, sya20: 4, sya27: 4, sya28: 4, sya29: 4, sya30: 4, sya31: 4, sya32: 4, sya33: 4, sya34: 4, sya35: 4, sya36: 4, sya37: 4, sya38: 4, sya39: 4, sya41: 4, sya42: 4, sya44: 4, sya45: 4 },
    // Löt-Lab (lot), v74.193: Lernfeld 8.3 gibt das 2. Lehrjahr, diese Aufgaben weichen ab.
    lot: { lot1: 1, lot2: 1, lot3: 1, lot4: 1, lot5: 1, lot6: 1, lot7: 1, lot8: 1, lot9: 1, lot10: 1, lot11: 1, lot12: 1, lot13: 1, lot14: 1, lot15: 1, lot16: 1, lot33: 1, lot34: 1, lot35: 1, lot36: 1, lot37: 1, lot38: 1, lot39: 1, lot40: 1, lot41: 1 },
    // Bus-Lab (bus), v74.193: Lernfeld E12 gibt das 4. Lehrjahr, diese Aufgaben weichen ab.
    bus: { bus1: 3, bus2: 3, bus3: 3, bus4: 3, bus5: 3, bus6: 3, bus7: 3, bus8: 3, bus9: 3, bus10: 3, bus11: 3, bus12: 3, bus13: 3, bus14: 3, bus15: 3, bus16: 3, bus17: 3, bus18: 3, bus19: 3, bus20: 3, bus21: 3, bus22: 3, bus23: 3, bus24: 3, bus25: 3, bus26: 3, bus27: 3, bus28: 3, bus29: 3, bus30: 3, bus31: 3, bus32: 3, bus33: 3, bus34: 3, bus35: 3, bus36: 3, bus37: 3, bus38: 3, bus39: 3, bus40: 3, bus41: 3, bus42: 3, bus43: 3, bus44: 3 },
    // Mikrocontroller-Lab (mik), v74.193: Lernfeld E12 gibt das 4. Lehrjahr, diese Aufgaben weichen ab.
    mik: { mik1: 3, mik2: 3, mik3: 3, mik4: 3, mik5: 3, mik6: 3, mik7: 3, mik8: 3, mik9: 3, mik10: 3, mik11: 3, mik12: 3, mik13: 3, mik14: 3, mik15: 3, mik16: 3, mik17: 3, mik18: 3, mik19: 3, mik20: 3, mik21: 3, mik22: 3, mik23: 3, mik24: 3 },
    // 3D-Druck-Lab (drk), v74.193: Lernfeld 8.3 gibt das 2. Lehrjahr, diese Aufgaben weichen ab.
    drk: { drk1: 1, drk2: 1, drk3: 1, drk4: 1, drk5: 1, drk6: 1, drk7: 1, drk8: 1, drk9: 1, drk10: 1, drk11: 1, drk12: 1 },
    // 3D-Modellierungs-Lab (cad), v74.193: Lernfeld 8.1 gibt das 2. Lehrjahr, diese Aufgaben weichen ab.
    cad: { cad1: 1, cad2: 1, cad3: 1, cad4: 1, cad5: 1, cad6: 1, cad7: 1, cad10: 1, cad12: 1, cad32: 3, cad34: 3, cad35: 3, cad39: 3, cad41: 3 },
    // Kleinsteuerungs-Lab (ksp), v78.194: das Lernfeld gibt ein anderes Lehrjahr als das Thema, diese Aufgaben weichen ab.
    ksp: { ksp38: 2, ksp39: 2, ksp40: 2, ksp41: 2, ksp42: 2, ksp43: 2 },
    // Simulations- und EDA-Lab (eda), v78.194: das Lernfeld gibt ein anderes Lehrjahr als das Thema, diese Aufgaben weichen ab.
    eda: { eda7: 1, eda8: 1, eda9: 1, eda10: 1, eda11: 1, eda12: 1, eda13: 1, eda14: 1, eda15: 1, eda16: 1 },
    // Plan-Lab (bmk), v78.194: das Lernfeld gibt ein anderes Lehrjahr als das Thema, diese Aufgaben weichen ab.
    bmk: { bmk14: 2, bmk15: 2, bmk16: 2, bmk17: 2, bmk18: 2, bmk19: 2, bmk20: 2, bmk21: 2, bmk22: 2, bmk23: 2, bmk24: 2, bmk25: 2, bmk26: 2, bmk27: 2 },
    // Fachgespräch-Lab (fgs), v79.197: das Lernfeld gibt ein anderes Lehrjahr als das Thema, diese Aufgaben weichen ab.
    fgs: { fgs10: 2, fgs11: 2, fgs12: 2, fgs13: 2, fgs14: 2, fgs15: 2, fgs16: 2, fgs17: 2, fgs18: 2, fgs19: 2, fgs20: 2, fgs21: 2, fgs22: 2, fgs23: 2, fgs24: 2, fgs25: 2, fgs26: 2, fgs27: 2, fgs28: 3, fgs29: 3, fgs30: 3, fgs31: 3, fgs32: 3, fgs33: 3, fgs34: 3, fgs35: 3, fgs36: 3, fgs37: 3, fgs38: 3, fgs39: 3, fgs40: 3, fgs41: 3, fgs42: 3, fgs43: 3 },
    // Thermik-Lab (thm), v63.185
    thm: { th45: 4 },
    // SchaltLab (sch)
    sch: {
      s4: 2, // Tiefpass mit 1 kHz Grenzfrequenz
      s9: 2, // Z-Diode stabilisiert 5,1 V
      s10: 2, // RC-Glied: Zeitkonstante 1 ms
      s12: 2, // 555-Blinker verdrahten [Z-Diode, 555 oder 7805 (Toni)]
      s16: 2, // Festspannung 5 V mit Regler 7805 [Z-Diode, 555 oder 7805 (Toni)]
      r4: 2, // Zufall: RC-Glied, Zeitkonstante
      sf4: 2, // Z-Diode stabilisiert nicht
      sf5: 2, // Tiefpass filtert nicht
      det4: 2, // Fall 4: Schalter an, LED aus
      det5: 2, // Fall 5: Die Stabilisierung liefert 0 Volt [Z-Diode, 555 oder 7805 (Toni)]
      det6: 2, // Fall 6: Das Netzteil liefert keine Gleichspannung
      det7: 2, // Fall 7: Der Tiefpass filtert nichts
      det8: 2 // Fall 8: Die Hoflampe leuchtet immer
    },
    // LochLab (loch)
    loch: {
      l8: 2, // 555-Blinker aufbauen [Z-Diode, 555 oder 7805 (Toni)]
      l14: 1, // Duo-LED verdrahten
      l20: 2, // Spannung stabilisieren mit Z-Diode
      l21: 2, // RC-Tiefpass aufbauen
      l22: 2, // Treppenlicht-Timer mit monostabilem 555 [Z-Diode, 555 oder 7805 (Toni)]
      lf7: 2, // Fehlersuche: Blinker blinkt nicht (555) [Z-Diode, 555 oder 7805 (Toni)]
      lf8: 2 // Fehlersuche: Timer reagiert nicht richtig (555) [Z-Diode, 555 oder 7805 (Toni)]
    },
    // DigiLab (digi)
    digi: {
      d1: 1, // UND-Gatter verdrahten
      d2: 1, // ODER-Gatter verdrahten
      d3: 1, // NICHT-Gatter: der Umkehrer
      d4: 1, // NAND aus UND und NICHT
      d21: 1, // NOR-Gatter verdrahten
      d22: 1, // NICHT-Gatter aus einem NAND
      d32: 1 // Hexadezimalziffer: Zahl oder Buchstabe
    },
    // MessLab (mess)
    mess: {
      /* v63.185: neue Aufgaben */
      m49: 2, m50: 2, m51: 1, m52: 2, m53: 1, m54: 2, m55: 3, m56: 3, m57: 3, mf8: 1, mf9: 2, mf10: 2,
      m8: 1, // Periodendauer und Frequenz ablesen [einfache Oszilloskop-Bedienung (Toni)]
      m9: 1, // Spitzenwert und Effektivwert [einfache Oszilloskop-Bedienung (Toni)]
      m12: 1, // Frequenz mit dem Frequenzzähler messen [einfache Oszilloskop-Bedienung (Toni)]
      m14: 2, // Z-Spannung und Z-Strom messen
      m20: 1, // Tastkopf ×10 richtig einstellen [einfache Oszilloskop-Bedienung (Toni)]
      m23: 1, // Durchlassspannung der roten LED
      m27: 1, // Tastkopf kompensieren [einfache Oszilloskop-Bedienung (Toni)]
      m30: 1, // Spannung aus den Kästchen ablesen [einfache Oszilloskop-Bedienung (Toni)]
      m31: 1, // Periodendauer aus den Kästchen berechnen [einfache Oszilloskop-Bedienung (Toni)]
      m47: 1, // Andere Einstellung, andere Kästchenzahl [einfache Oszilloskop-Bedienung (Toni)]
      m48: 1, // Zeitbasis für ein ruhiges Bild wählen [einfache Oszilloskop-Bedienung (Toni)]
      mf3: 2, // Fehlersuche: Z-Diode-Stabilisierung
      mp6: 2, // Z-Diode: Ströme und Verlustleistung
      mp7: 2 // Spannungsregler 7805: Verlustleistung und Erwärmung [Z-Diode, 555 oder 7805 (Toni)]
    },
    // HausLab (haus)
    haus: {
      ha7: 2 // Küchensteckdosen: Querschnitt prüfen
    },
    // Sicherheits-Lab (els)
    els: {
      /* v63.185: neue Aufgaben */
      el47: 3, el48: 3, el49: 4, el50: 3, el51: 3, el52: 3, el53: 3, el54: 3, el55: 4, el56: 3, el57: 4,
      el28: 1, // Fünf Sicherheitsregeln
      el29: 1, // Rettungskette
      el30: 1, // Welche Regel fehlt?
      el33: 1, // Brandklassen zuordnen
      el34: 1, // Richtig löschen
      el35: 1, // Sicherheitszeichen lesen
      el36: 1 // Gefahrstoff-Piktogramme
    },
    // Netzteil-Lab (nts)
    nts: {
      /* v63.185: neue Aufgaben */
      nt55: 4,
      nt9: 2, // Z-Diode: Strom berechnen (Pool S2025-30) [Z-Diode, 555 oder 7805 (Toni)]
      nt10: 2, // Z-Diode: Vorwiderstand (Pool F2020-N22) [Z-Diode, 555 oder 7805 (Toni)]
      nt11: 2, // Z-Diode regelt nicht mehr [Z-Diode, 555 oder 7805 (Toni)]
      nt12: 2, // Verlustleistung des Linearreglers (Pool H2026-20) [Z-Diode, 555 oder 7805 (Toni)]
      nt13: 2, // Wirkungsgrad des Linearreglers [Z-Diode, 555 oder 7805 (Toni)]
      nt14: 2, // LM317 auf 9 V einstellen (Pool W2025-13) [Z-Diode, 555 oder 7805 (Toni)]
      nt15: 2, // Ausgangsspannung des LM317 (Pool H2025-23) [Z-Diode, 555 oder 7805 (Toni)]
      nt16: 2, // 7805 durch LM317 ersetzen (Pool W2025-B01) [Z-Diode, 555 oder 7805 (Toni)]
      nt33: 2, // Quer- und Längsstabilisierung [Z-Diode, 555 oder 7805 (Toni)]
      nt34: 2, // Z-Diode bei schwankender Eingangsspannung [Z-Diode, 555 oder 7805 (Toni)]
      nt35: 2, // Vorwiderstand für den Z-Strom [Z-Diode, 555 oder 7805 (Toni)]
      nt36: 2, // Zener- und Lawinendurchbruch [Z-Diode, 555 oder 7805 (Toni)]
      nt37: 2, // Regelschaltung mit Referenz und Längstransistor [Z-Diode, 555 oder 7805 (Toni)]
      nt38: 2, // Strom- und Lastbereich der Z-Diode-Stufe [Z-Diode, 555 oder 7805 (Toni)]
      nt44: 2, // Längstransistor mit Z-Diode auslegen [Z-Diode, 555 oder 7805 (Toni)]
      nt45: 2, // LM317 mit Einstellbereich 3 bis 12 V [Z-Diode, 555 oder 7805 (Toni)]
      nt46: 2, // Z-Diode: Kennwerte aus der Typbezeichnung [Z-Diode, 555 oder 7805 (Toni)]
      nt47: 2 // Vorwiderstand für schwankende Spannung und Last [Z-Diode, 555 oder 7805 (Toni)]
    },
    // Wechselstrom-Lab (wsl)
    wsl: {
      /* v63.185: neue Aufgaben */
      ws59: 3, ws63: 3,
      ws1: 1, // Effektivwert oder Scheitelwert?
      ws2: 1, // Scheitelwert der Netzspannung
      ws5: 1, // X_L und X_C berechnen
      ws9: 1, // Eilt vor oder nach?
      ws40: 1, // Induktionsspannung aus dem Flussverlauf
      ws41: 1, // Was verändert die Induktionsspannung?
      ws42: 1, // Wie entsteht eine Spannung?
      ws43: 1, // Spannung als Potentialunterschied
      ws44: 1, // Heizwiderstand am Wechselstromnetz
      ws45: 1, // Kapazität aus der Strommessung
      ws46: 1, // Spitzenleistung am Wirkwiderstand
      ws47: 1, // Blindwiderstände bei doppelter Frequenz
      ws48: 1, // Widerstand und Kondensator in Reihe
      ws49: 1, // Drosselspule am Netz
      ws50: 1, // Frequenz für einen geforderten Blindwiderstand
      ws51: 1 // Drei Kondensatoren zusammenschalten
    },
    // Analogtechnik-Lab (ana)
    ana: {
      /* v63.185: neue Aufgaben */
      ae55: 4, ae58: 4, ae61: 4,
      ae2: 2, // Z-Diode: kleinster Vorwiderstand [Z-Diode, 555 oder 7805 (Toni)]
      ae15: 2 // Z-Diode am Folger: R_1 [Z-Diode, 555 oder 7805 (Toni)]
    },
    // Leiterplatten-Lab (pcb)
    pcb: {
      pb46: 2, // Erwärmung des Spannungsreglers [Z-Diode, 555 oder 7805 (Toni)]
      pb47: 2 // Linearregler oder Schaltregler: Verluste vergleichen [Z-Diode, 555 oder 7805 (Toni)]
    },
    // Datenblatt-Lab (ds)
    ds: {
      /* v63.185: neue Aufgaben */
      ds36: 3, ds37: 3, ds42: 3,
      ds10: 2, // Mindest-Eingangsspannung des LM317 bei 125 °C [Z-Diode, 555 oder 7805 (Toni)]
      ds11: 2, // RB für 1 kHz mit dem NE555 [Z-Diode, 555 oder 7805 (Toni)]
      ds14: 2, // Vorwiderstand der Z-Diode [Z-Diode, 555 oder 7805 (Toni)]
      ds15: 2, // LM317: R2 für 9 V [Z-Diode, 555 oder 7805 (Toni)]
      ds32: 2, // Der 7805 wird glühend heiß [Z-Diode, 555 oder 7805 (Toni)]
      ds35: 2 // Nachlaufzeit mit dem NE555 (Prüfungsaufgabe) [Z-Diode, 555 oder 7805 (Toni)]
    },
    // Prüfungs-Lab (pr)
    pr: {
      pr15: 4, // Teil 2 Systementwurf bestehen
      pr16: 4 // Teil 2 Funktions- und Systemanalyse bestehen
    },
    // Rechen-Lab (mat)
    mat: {
      mat33: 2, // Median und Spannweite
      /* Prüfung Teil 1 (v62.179): mat49 bis mat60 bleiben 1. Lehrjahr, ab Kondensator, Transistor, Z-Diode und Operationsverstärker 2. Lehrjahr */
      mat61: 2, mat62: 2, mat63: 2, mat64: 2, mat65: 2, mat66: 2, mat67: 2, mat68: 2, mat69: 2, mat70: 2, mat105: 2, mat106: 2,
      /* Nachtrag zur 183: zwei leichte Messwert-Aufgaben (Toleranz, Abweichung in Prozent) wie Median ins 2. Lehrjahr */
      mat103: 2, mat104: 2,
      /* v62.184: Rubrik Elektrotechnik (mat107 bis mat124) 2. oder 3. Lehrjahr, Rubrik Elektronik vertieft (mat125 bis mat144) 4. Lehrjahr */
      mat107: 2, mat108: 2, mat109: 2, mat110: 2, mat111: 2, mat112: 2, mat113: 2, mat114: 2, mat117: 2, mat118: 2, mat119: 2, mat120: 2, mat115: 3, mat116: 3, mat121: 3, mat122: 3, mat123: 3, mat124: 3, mat125: 4, mat126: 4, mat127: 4, mat128: 4, mat129: 4, mat130: 4, mat131: 4, mat132: 4, mat133: 4, mat134: 4, mat135: 4, mat136: 4, mat137: 4, mat138: 4, mat139: 4, mat140: 4, mat141: 4, mat142: 4, mat143: 4, mat144: 4
    }
  };

  /* ---------------------------------------------------------------- 2. Datenquellen (Browser: window.AUFGABEN, window.LERNFELDER; Node: aus den Dateien) */
  let injiziert = null, nodeRows = null, nodeLF = null, cache = null, cacheN = -1, cacheLF = null;
  function rows() {
    if (injiziert && injiziert.rows) return injiziert.rows;
    if (root.AUFGABEN && root.AUFGABEN.length) return root.AUFGABEN;
    if (!nodeRows && typeof require === 'function') {
      try {
        const fs = require('fs'), path = require('path'), vm = require('vm'), w = {}; w.window = w;
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'aufgaben.js'), 'utf8'), w); nodeRows = w.AUFGABEN || [];
      } catch (e) { nodeRows = []; }
    }
    return nodeRows || [];
  }
  function lfmod() {
    if (injiziert && injiziert.lf) return injiziert.lf;
    if (root.LERNFELDER) return root.LERNFELDER;
    if (!nodeLF && typeof require === 'function') { try { nodeLF = require('./lernfelder.js'); } catch (e) { nodeLF = null; } }
    return nodeLF;
  }
  /* Daten von außen vorgeben (Tests): { rows, lf } */
  function daten(d) { injiziert = d || null; cache = null; cacheN = -1; pc = {}; }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const klemme = n => Math.max(1, Math.min(4, Math.round(+n) || 1));
  /* ---------------------------------------------------------------- 2b. Berufe mit Plan (im): Lehrjahr aus dem Ausbildungsplan
     Der Plan ordnet je Lernfeld Labs zu: aufgaben = ID-Liste, bereich = Rubriken oder '*' (Rest des Labs). Welcher Eintrag eine Aufgabe trifft, entscheidet derselbe Rang wie in
     ausbildungsplan-core.js (zuordnung): ID vor Rubrik vor '*'. Nur die Einträge mit dem besten Rang zählen (so steht die Aufgabe im selben Lernfeld wie auf der Seite "Mein Plan").
       1. AUSNAHMEN_IM[lab][id], wenn dort eine Zahl steht.
       2. sonst das kleinste jahr (1 bis 4) der nicht optionalen Lernfelder, die die Aufgabe mit dem besten Rang enthalten.
       3. steht sie nur in Lernfeldern mit jahr 0 (übergreifend): 1. Steht sie nur in optionalen Lernfeldern: 4 (füllt den Pfad nicht).
       4. Aufgaben eines Labs aus dem Plan, die kein Lernfeld nennt: 1. Labs, die im Plan gar nicht vorkommen: wie bisher (Abschnitt 3).
     Einträge mit fremd:true zählen nicht. Der Plan wird gelesen, nie geändert. Ändert sich der Plan, ändern sich die Lehrjahre von selbst. */
  const doc = root.document || null;
  let nodePlan = {}, pc = {};
  const planBeruf = b => PLANBERUFE.indexOf(b) >= 0;
  const liste = x => (x == null ? [] : Array.isArray(x) ? x : [x]);
  /* Plan des Berufs: vorgegeben (Tests), aus dem Kern (AusbildungsPlan.plan), aus der Warteschlange der Plan-Datei (window.__apQueue, wenn der Kern nicht geladen ist), in Node aus der Datei */
  function planVon(b) {
    let p = null;
    if (injiziert && injiziert.plan) p = injiziert.plan[b] || null;
    else {
      const AP = root.AusbildungsPlan; try { p = AP && AP.plan ? AP.plan(b) : null; } catch (e) { p = null; }
      if (!p && Array.isArray(root.__apQueue)) root.__apQueue.forEach(a => { if (a && a[0] === b && a[1]) p = a[1]; });
      if (!p && !doc && typeof require === 'function') {
        if (!has(nodePlan, b)) {
          nodePlan[b] = null;
          try { const fs = require('fs'), path = require('path'), vm = require('vm'), w = {}; w.window = w; vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'ausbildungsplan-' + b + '.js'), 'utf8'), w); (w.__apQueue || []).forEach(a => { if (a && a[0] === b) nodePlan[b] = a[1]; }); } catch (e) {}
        }
        p = nodePlan[b];
      }
    }
    return p && Array.isArray(p.lernfelder) && p.lernfelder.length ? p : null;
  }
  /* Index wie index(), aber mit den Lehrjahren aus dem Plan; null, solange der Plan fehlt. ohne = Aufgaben von Plan-Labs, die kein Lernfeld nennt. */
  function planIndex(b) {
    const p = planVon(b); if (!p) return null;
    const R = rows(), c = pc[b];
    if (c && c.p === p && c.R === R && c.n === R.length) return c.ix;
    const A = AUSNAHMEN_PLAN[b] || {}, best = {}, byLab = {}, imPlan = {};
    R.forEach(r => { (byLab[r[1]] = byLab[r[1]] || []).push(r); });
    p.lernfelder.forEach(lf => {
      if (!lf) return;
      const opt = !!lf.optional, jahr = +lf.jahr >= 1 && +lf.jahr <= 4 ? Math.round(+lf.jahr) : 0;
      liste(lf.labs).forEach(e => {
        if (!e || e.fremd || typeof e.lab !== 'string') return;
        imPlan[e.lab] = 1;
        const ids = liste(e.aufgaben), cats = liste(e.bereich), star = cats.indexOf('*') >= 0;
        (byLab[e.lab] || []).forEach(r => {
          const rank = ids.indexOf(r[0]) >= 0 ? 0 : cats.indexOf(r[2]) >= 0 ? 1 : star ? 2 : -1; if (rank < 0) return;
          let o = best[r[0]]; if (!o || rank < o.rank) o = best[r[0]] = { rank, j: 0, pfl: false };
          if (rank > o.rank || opt) return;
          o.pfl = true; if (jahr && (!o.j || jahr < o.j)) o.j = jahr;
        });
      });
    });
    const ix = { lab: {}, id: {}, labOf: {}, ohne: [] };
    R.forEach(r => {
      const id = r[0], lab = r[1], o = best[id]; let lj;
      if (has(A, lab) && A[lab] && has(A[lab], id)) lj = klemme(A[lab][id]);
      else if (o) lj = o.pfl ? (o.j || 1) : 4;
      else if (imPlan[lab]) { lj = 1; ix.ohne.push(id); }
      else lj = ljZeile(r);
      (ix.lab[lab] = ix.lab[lab] || []).push({ id, lj }); ix.id[id] = lj; ix.labOf[id] = lab;
    });
    pc[b] = { p, R, n: R.length, ix }; return ix;
  }
  /* Browser: Plan-Datei nachladen (klassisches Skript, liegt schon im Offline-Speicher). Der Kern ausbildungsplan-core.js wird dafür nicht gebraucht.
     Danach meldet das Modul "lernpfad:lj": Startseite (lernpfad.js) und Aufgabenlisten (lehrjahr-liste.js) rechnen neu. */
  const geladen = {};
  function planLaden(b) {
    if (!doc || !planBeruf(b) || geladen[b] || planVon(b)) return;
    geladen[b] = 1;
    const src = 'ausbildungsplan-' + b + '.js';
    const fertig = () => { if (geladen[b] === 2 || !planVon(b)) return; geladen[b] = 2; pc = {}; try { root.dispatchEvent(new root.Event('lernpfad:lj')); } catch (e) {} };
    try {
      let e = doc.querySelector('script[src="' + src + '"]');
      if (!e) { e = doc.createElement('script'); e.src = src; e.async = true; (doc.head || doc.documentElement).appendChild(e); }
      e.addEventListener('load', fertig); root.setTimeout(fertig, 2500);
    } catch (x) {}
  }
  /* false nur, solange der Plan eines Plan-Berufs noch fehlt (dann wird nicht gefiltert und das Laden angestoßen) */
  function bereit(beruf) { if (!planBeruf(beruf) || planVon(beruf)) return true; planLaden(beruf); return false; }

  /* Lehrjahr aus dem Lernfeld der Zeile (1..4) oder 0, wenn keins da ist (Lernfeldübergreifend) */
  function katalog(row) {
    const L = lfmod(); if (!L || !L.lfOf || !L.lf) return 0;
    const k = L.lfOf(row), e = k ? L.lf(k) : null;
    return e && e.lj >= 1 && e.lj <= 4 ? e.lj : 0;
  }
  function ljZeile(row) {
    const lab = row[1], A = has(AUSNAHMEN, lab) ? AUSNAHMEN[lab] : null;
    if (A && has(A, row[0])) return klemme(A[row[0]]);
    const c = katalog(row); if (c) return c;
    return has(VORGABE, lab) ? klemme(VORGABE[lab]) : 1;
  }
  /* Index: je Lab die Zeilen in Dateireihenfolge mit ihrem Lehrjahr; wird neu gebaut, wenn sich die Aufgabenliste ändert */
  function index() {
    const R = rows(), L = lfmod();
    if (cache && cacheN === R.length && cacheLF === L) return cache;
    const ix = { lab: {}, id: {}, labOf: {} };
    R.forEach(r => { const lj = ljZeile(r); (ix.lab[r[1]] = ix.lab[r[1]] || []).push({ id: r[0], lj }); ix.id[r[0]] = lj; ix.labOf[r[0]] = r[1]; });
    cache = ix; cacheN = R.length; cacheLF = L; return ix;
  }

  /* ---------------------------------------------------------------- 3. Lehrjahr je Aufgabe */
  function ab(id, lab, beruf) {
    if (planBeruf(beruf)) { const px = planIndex(beruf); if (px && has(px.id, id) && (!lab || px.labOf[id] === lab)) return px.id[id]; }
    const ix = index();
    if (has(ix.id, id) && (!lab || ix.labOf[id] === lab)) return ix.id[id];
    // Aufgabe nicht im Verzeichnis: Ausnahme, sonst Vorgabe des Labs
    const A = lab && has(AUSNAHMEN, lab) ? AUSNAHMEN[lab] : null;
    if (A && has(A, id)) return klemme(A[id]);
    return lab && has(VORGABE, lab) ? klemme(VORGABE[lab]) : 1;
  }
  const gilt = beruf => BERUFE.indexOf(beruf) >= 0;
  const alle = (lab, beruf) => (((planBeruf(beruf) && planIndex(beruf)) || index()).lab[lab] || []);
  function teil(lab, beruf, lj) {
    const z = alle(lab, beruf); if (!gilt(beruf) || !bereit(beruf)) return z.map(x => x.id);
    const j = klemme(lj); return z.filter(x => x.lj <= j).map(x => x.id);
  }
  function spaeter(lab, beruf, lj) {
    if (!gilt(beruf) || !bereit(beruf)) return [];
    const j = klemme(lj); return alle(lab, beruf).filter(x => x.lj > j).map(x => ({ id: x.id, lj: x.lj }));
  }
  /* Anzahl Aufgaben je Lehrjahr: [n1, n2, n3, n4] */
  function summen(lab, beruf) { const s = [0, 0, 0, 0]; alle(lab, beruf).forEach(x => { s[x.lj - 1]++; }); return s; }

  /* ---------------------------------------------------------------- 4. Eigenes Lehrjahr */
  const K_HAND = 'lm4.lehrjahr', K_FRAGE = 'lm4.lehrjahr.frage', K_NEU = 'lm4.lehrjahr.neu', K_JG = 'lm4.jahrgang';
  /* Speicher: localStorage-ähnlich (getItem, setItem, removeItem) oder ein einfaches Objekt */
  function speicher(store) {
    let s = store;
    if (!s) { try { s = root.localStorage; } catch (e) { s = null; } }
    if (!s) return { get: () => null, set: () => {}, del: () => {} };
    if (typeof s.getItem === 'function') return {
      get: k => { try { const v = s.getItem(k); return v == null ? null : String(v); } catch (e) { return null; } },
      set: (k, v) => { try { s.setItem(k, v); } catch (e) {} },
      del: k => { try { s.removeItem(k); } catch (e) {} }
    };
    return { get: k => (s[k] == null ? null : String(s[k])), set: (k, v) => { s[k] = String(v); }, del: k => { delete s[k]; } };
  }
  const datum = j => (j instanceof Date ? j : j == null ? new Date() : new Date(j));
  const p2 = n => (n < 10 ? '0' : '') + n;
  const tagText = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  /* Ausbildungsjahr, in das ein Datum fällt: ab 1. August zählt das nächste Jahr (Ausbildungsbeginn 1. August oder 1. September) */
  const ausbJahr = d => d.getFullYear() + (d.getMonth() >= 7 ? 1 : 0);
  function leseHand(raw) {
    if (raw == null) return null;
    let o = null; try { o = JSON.parse(raw); } catch (e) { return null; }
    if (typeof o === 'number' || typeof o === 'string') { const n = Math.round(+o); return n >= 1 && n <= 4 ? { n, seit: '' } : null; }
    if (!o || typeof o !== 'object') return null;
    const n = Math.round(+o.n); if (!(n >= 1 && n <= 4)) return null;
    return { n, seit: typeof o.seit === 'string' ? o.seit : '' };
  }
  function seitDatum(t) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  /* aktuelles Lehrjahr aus dem Handwert: n plus die Zahl der 1. August seit dem Setzen, höchstens 4 */
  function ausHand(h, jetzt) {
    const d0 = seitDatum(h.seit); if (!d0) return h.n;
    return klemme(h.n + Math.max(0, ausbJahr(jetzt) - ausbJahr(d0)));
  }
  /* Formel: (Jahr heute - Jahrgang) + (Monat ab August ? 1 : 0), begrenzt auf 1 bis 4 */
  function ausJahrgang(raw, jetzt) {
    const t = String(raw == null ? '' : raw).replace(/"/g, '').trim(); if (!/^\d{4}$/.test(t)) return null;
    return klemme(jetzt.getFullYear() - +t + (jetzt.getMonth() >= 7 ? 1 : 0));
  }
  function mein(store, jetzt) {
    const S = speicher(store), d = datum(jetzt), h = leseHand(S.get(K_HAND));
    if (h) return ausHand(h, d);
    return ausJahrgang(S.get(K_JG), d);
  }
  /* Woher kommt das Lehrjahr? 'hand' (angegeben), 'jahrgang' (aus lm4.jahrgang berechnet) oder '' */
  function quelle(store, jetzt) {
    const S = speicher(store); if (leseHand(S.get(K_HAND))) return 'hand';
    return ausJahrgang(S.get(K_JG), datum(jetzt)) != null ? 'jahrgang' : '';
  }
  function setz(n, store, jetzt) {
    const S = speicher(store), d = datum(jetzt);
    if (n == null || n === '') { S.del(K_HAND); return mein(store, jetzt); }
    const j = Math.round(+n); if (!(j >= 1 && j <= 4)) return mein(store, jetzt);
    S.set(K_HAND, JSON.stringify({ n: j, seit: tagText(d) })); S.del(K_NEU); S.set(K_FRAGE, '1');
    return j;
  }
  /* Hat das Gerät schon Fortschritt? (nur echte Ergebnisse, nicht Einstellungen) */
  function hatFortschritt(store) {
    const S = speicher(store), obj = k => { try { const o = JSON.parse(S.get(k) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
    const a = obj('sim.done'), b = obj('lm4.tdone'), t = obj('lm4.trainer'), r = obj('sim.results');
    if (a && Object.keys(a).some(k => +a[k] > 0)) return true;
    if (b && Object.keys(b).some(k => +b[k] > 0)) return true;
    if (t && Object.keys(t).length) return true;
    return !!(Array.isArray(r) && r.length);
  }
  const frageErledigt = store => speicher(store).get(K_FRAGE) === '1';
  /* Frage "In welchem Lehrjahr bist du?": einmal, solange nichts angegeben ist und sie nicht weggeklickt wurde */
  function frageNoetig(store, jetzt) { return mein(store, jetzt) == null && !frageErledigt(store); }
  /* Frage weggeklickt: nicht wieder zeigen */
  function frageSchliessen(store) { speicher(store).set(K_FRAGE, '1'); }
  /* Ganz neues Gerät: Vorgabe 1. Lehrjahr; die Marke lm4.lehrjahr.neu hält sie fest, auch wenn später Fortschritt dazukommt */
  function init(store) {
    const S = speicher(store);
    if (mein(store) == null && S.get(K_NEU) !== '1' && !frageErledigt(store) && !hatFortschritt(store)) S.set(K_NEU, '1');
  }
  /* Das Lehrjahr, nach dem der Pfad filtert: Angabe, sonst 1 für ganz neue Geräte, sonst null (alles wie bisher) */
  function wirksam(store, jetzt) {
    const m = mein(store, jetzt); if (m != null) return m;
    const S = speicher(store);
    if (S.get(K_NEU) === '1') return 1;
    return !frageErledigt(store) && !hatFortschritt(store) ? 1 : null;
  }

  /* Aufgaben von Plan-Labs ohne Lernfeld (für Prüfskripte): Liste der IDs, leer für Berufe ohne Plan */
  function planOhne(beruf) { const px = planBeruf(beruf) ? planIndex(beruf) : null; return px ? px.ohne.slice() : []; }
  const API = { bereit, planLaden, planOhne, PLANBERUFE, AUSNAHMEN_IM, ab, gilt, mein, quelle, setz, teil, spaeter, summen, wirksam, frageNoetig, frageErledigt, frageSchliessen, hatFortschritt, init, daten, BERUFE, VORGABE, AUSNAHMEN, KEYS: { hand: K_HAND, frage: K_FRAGE, neu: K_NEU, jahrgang: K_JG }, ausbJahr };
  root.Lehrjahr = API;
  /* Browser: für einen Beruf mit Plan (im) die Plan-Datei gleich nachladen */
  if (doc) { try { planLaden(root.BerufReg && root.BerufReg.cur ? root.BerufReg.cur() : ''); } catch (e) {} }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
