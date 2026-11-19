'use strict';
/* Tonfunk Lab: Lehrjahr je Aufgabe und eigenes Lehrjahr (Datenmodul, reine Funktionen, läuft im Browser und in Node; window.Lehrjahr bzw. module.exports).
   Paket L2 (16.11.2026). Der Lernpfad der Startseite (lernpfad.js, home-cont.js, home-groups.js) führt damit nur durch den Teil jedes Labs bis zum eigenen Lehrjahr.
   Nichts wird gesperrt: alle Aufgaben bleiben in den Labs frei wählbar; Orden, 100 %, Fortschritt und Ausbilder-Auswertung rechnen weiter über alle Aufgaben.

   SCHNITTSTELLE (ein zweites Paket, L3, baut die Aufgabenlisten der Labs darauf):
     Lehrjahr.ab(id, lab)             -> 1..4, frühestens sinnvolles Lehrjahr der Aufgabe
     Lehrjahr.gilt(beruf)             -> true nur für Berufe mit Datenlage (egs, ige); für alle anderen bleibt alles wie bisher
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
     Z-Diode, 555 und 7805 (dazu der LM317 und Linearregler) ab 2. Lehrjahr; Transistor, Gleichrichter, OPV, Tiefpass und RC-Zeitkonstante ab 2;
     einfache Oszilloskop-Bedienung im MessLab im 1. Lehrjahr, anspruchsvolle (Mischspannung, Phase, Kopplung, Frequenzgang) ab 2;
     Sicherheitsregeln, Rettungskette, Brandschutz im 1. Lehrjahr; Technisches Englisch ab 2. */
(function (root) {
  /* ---------------------------------------------------------------- 1. Tabellen */
  /* Berufe mit Datenlage: nur dort wird gefiltert */
  const BERUFE = ['egs', 'ige'];
  /* Vorgabe je Lab für Zeilen ohne Lernfeld; Labs, die hier fehlen, bekommen 1 */
  const VORGABE = { sch: 1, loch: 1, digi: 1, mess: 1, sim: 1, haus: 1, els: 1, nts: 1, wsl: 1, ana: 1, thm: 1, sps: 1, pcb: 1, ant: 1, sen: 1, reg: 3, emv: 2, enr: 2, ds: 2, pr: 2, code: 1, pi: 1, app: 1, mat: 1, eng: 2, bhf: 1, alg: 1, sys: 1, ssl: 1 };
  /* Ausnahmen je Lab: Aufgaben-ID -> frühestes Lehrjahr. Nur Aufgaben, die vom Lernfeld abweichen oder kein Lernfeld haben und nicht zur Vorgabe passen. */
  const AUSNAHMEN = {
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
  function daten(d) { injiziert = d || null; cache = null; cacheN = -1; }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const klemme = n => Math.max(1, Math.min(4, Math.round(+n) || 1));
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
  function ab(id, lab) {
    const ix = index();
    if (has(ix.id, id) && (!lab || ix.labOf[id] === lab)) return ix.id[id];
    // Aufgabe nicht im Verzeichnis: Ausnahme, sonst Vorgabe des Labs
    const A = lab && has(AUSNAHMEN, lab) ? AUSNAHMEN[lab] : null;
    if (A && has(A, id)) return klemme(A[id]);
    return lab && has(VORGABE, lab) ? klemme(VORGABE[lab]) : 1;
  }
  const gilt = beruf => BERUFE.indexOf(beruf) >= 0;
  const alle = lab => (index().lab[lab] || []);
  function teil(lab, beruf, lj) {
    const z = alle(lab); if (!gilt(beruf)) return z.map(x => x.id);
    const j = klemme(lj); return z.filter(x => x.lj <= j).map(x => x.id);
  }
  function spaeter(lab, beruf, lj) {
    if (!gilt(beruf)) return [];
    const j = klemme(lj); return alle(lab).filter(x => x.lj > j).map(x => ({ id: x.id, lj: x.lj }));
  }
  /* Anzahl Aufgaben je Lehrjahr: [n1, n2, n3, n4] */
  function summen(lab) { const s = [0, 0, 0, 0]; alle(lab).forEach(x => { s[x.lj - 1]++; }); return s; }

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

  const API = { ab, gilt, mein, quelle, setz, teil, spaeter, summen, wirksam, frageNoetig, frageErledigt, frageSchliessen, hatFortschritt, init, daten, BERUFE, VORGABE, AUSNAHMEN, KEYS: { hand: K_HAND, frage: K_FRAGE, neu: K_NEU, jahrgang: K_JG }, ausbJahr };
  root.Lehrjahr = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
