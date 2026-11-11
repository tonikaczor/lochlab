/* Verbundprojekt "Werkstatt-Netz mit Messdaten-Server" (id werknetz, Präfix vn, Beruf Fachinformatiker 'fi', order 11).
   Alle Stationen sind Hub-Stationen (on: 'vb', Typ vb.form): Formular mit Rechen- und Auswahlfeldern plus Lab-Aufgaben aus net, hwl, alg, sql, its, lin (geprüft über lm4.tdone).

   FÜR DIE INTEGRATION
   - Startseite/Suche (ein Satz): Plane für eine Werkstatt mit Messplätzen ein Netz mit Messdaten-Server: vom Lastenheft über Hardware, Subnetze, Raspberry-Pi-Sammler, Datenbank und Algorithmus bis zu Anzeige und Datensicherung.
   - Abzeichen-Vorschlag: Symbol 🖧 (alternativ 🗄️), Name "Netzwerker", Text "Werkstatt-Netz mit Messdaten-Server komplett geplant und gerechnet."
   - Titel: "Werkstatt-Netz mit Messdaten-Server", Beruf-Kürzel: ['fi'], Labs: net hwl alg sql its lin.
   - Verwendete Lab-Aufgaben: vn1 hwl23 alg48 | vn2 hwl3 hwl25 hwl29 | vn3 net19 net20 | vn4 lin23 lin24 | vn5 sql18 sql19 sql37 | vn6 alg12 alg16 alg30
     | vn7 alg2 alg5 | vn8 its27 its29 lin7. (Die Labs pi, code, app schreiben kein lm4.tdone und kennen keinen Aufgaben-Deep-Link, darum sind sie hier nicht verlinkt.)

   FORMELN (Einheit, durchgerechnetes Beispiel Stufe 1: 2 Hallen x 6 Plätze, 2 Kanäle, alle 10 s, 2 Jahre, CPU 65 W, 0,30 EUR/kWh)
   - Messplätze n = Hallen * Plätze je Halle = 12
   - Messwerte je Tag = n * Kanäle * 86 400 s / Intervall = 12*2*86400/10 = 207 360
   - Datenmenge je Tag = Messwerte * 32 Byte = 6 635 520 Byte = 6,63552 MB (dezimal, 1 MB = 10^6 Byte) = 6,328125 MiB (binär, 1 MiB = 2^20 Byte)
   - Speicherbedarf (GB, dezimal) = MB/Tag * 365 * Jahre / 1000 * 1,5 + 40 = 6,63552*730/1000*1,5 + 40 = 47,27 GB -> SSD 120 GB; Anzeige 120*10^9 / 2^30 = 111,76 GiB
   - Leistung = 40 + 20 + 8 + 12 + CPU = 80 + 65 = 145 W; Netzteil >= 1,3 * 145 = 188,5 W -> 200 W; Jahreskosten = 145*0,6 W * 8,76 kWh je W-Jahr/1000 * 0,30 = 87*8,76*0,30 = 228,64 EUR
   - Adressbedarf Messnetz = aufrunden(n*(100+Reserve)/100) + 1 Gateway = 13 -> /28 (2^4-2 = 14 Hosts); Büro = Rechner+1, Server = Geräte+1; VLSM von groß nach klein ab 192.168.x.0
   - Spannungsteiler U = 5 V * R2/(R1+R2) (z. B. 2,2 k / 3,3 k -> 3,0 V)
   - Zeilen in der Tabelle = n * Messwerte je Pi und Stunde * 24 * 365 * Jahre = 12*720*24*365*2 = 151 372 800 (151,37 Mio.)
   - Laufzeit = Zeilen / (5 * 10^6 je s) = 30,27 s
   - Datensicherung = 4 Sätze * (Bestand nach 1 Jahr = MB/Tag*365 + 6 Tage inkrementell) / 1000 = 4*371*6,63552/1000 = 9,85 GB; Ausfallzeit = 8760 h * (100 - Verfügbarkeit)/100 = 43,8 h bei 99,5 %

   ZUR FACHLICHEN FREIGABE (Annahmen, im Text mit (A) gekennzeichnet)
   - (A) Ein Datensatz belegt 32 Byte inklusive Verwaltung der Datenbank; Indizes und Reserve +50 %; Betriebssystem und Programme 40 GB.
   - (A) SSD-Größen 120/240/480/960/1920 GB (Herstellerangabe dezimal), zwei SSD als RAID 1 (nutzbar = eine SSD); Netzteilreihe 200/250/300/400/500 W mit 30 % Reserve.
   - (A) Leistungswerte: Mainboard 40 W, Arbeitsspeicher 20 W, zwei SSD 8 W, Netzwerk und Lüfter 12 W; Mittel 60 % der Summe; Dauerbetrieb 8 760 h im Jahr; Strompreis aus dem Lastenheft.
   - (A) Basisnetz 192.168.x.0/24, das Gateway ist je Netz die erste nutzbare Adresse, die Pis folgen lückenlos. Gleich große Netze: Reihenfolge Messnetz, Büronetz, Servernetz.
   - (A) /31 (und /32) wird in diesem Projekt NICHT verwendet: offene Lehrfrage, ob /31 (Punkt-zu-Punkt, zwei nutzbare Adressen) im Unterricht vorkommen soll. Das Servernetz hat immer mindestens drei Adressen Bedarf, also nie kleiner als /29.
   - (A) Alarm gilt für Werte ÜBER der Schwelle (größer als, nicht gleich). Warnschwelle = Alarmschwelle - 10 K. Anzeige: 4 Kacheln je Zeile.
   - (A) GPIO-Pegel des Raspberry Pi 3,3 V (nicht 5-V-tolerant); Mindestpegel für High etwa 2 V.
   - (A) Sicherung: wöchentlich ein Voll-Satz plus 6 Tage inkrementell, 4 Sätze (4 Wochen) aufbewahrt; gerechnet mit dem Datenbestand nach einem Jahr; Sicherungsplatte mit 20 % Luft.
   - (A) Auswertung: 5 Millionen Schleifendurchläufe je Sekunde.
   - (A) Dateirechte 640 für die Messdaten-Datei: Besitzer lesen/schreiben, Gruppe nur lesen, andere nichts. 3-2-1-Regel: 3 Kopien, 2 Medien, 1 extern.
   - Offene Zweifel: Dezimal- gegen Binärpräfixe (MB/MiB) sind klar benannt; bei Speicherbedarf rechnet das Projekt durchgehend dezimal (GB), nur die Anzeige im Betriebssystem in GiB. */
(function (root) {
  'use strict';
  const PID = 'werknetz';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const numOf = v => { if (fin(v)) return v; const x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const P_ = ctx => { const s = ctx && ctx.spec; return isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); };
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
  function slotOf(ctx, slot) { let d = null; if (ctx) { try { if (typeof ctx.get === 'function') d = ctx.get(slot); } catch (e) { d = null; } if (d == null && isObj(ctx.slots)) d = ctx.slots[slot]; } return d == null ? null : unwrap(d); }
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });
  const safe = (fn, label) => function (data, ctx) { try { return { lines: fn(data, ctx || {}) }; } catch (e) { return { lines: [L(false, label + ': Prüfung nicht möglich', 100)] }; } };
  const vals = d => (isObj(d) && isObj(d.vals) ? d.vals : {});
  /* Zahl mit relativer Toleranz; soll darf eine Liste sein (erster Wert ist der Hauptwert, jeder passt). Rückmeldung ohne die richtige Zahl. */
  function numLine(label, x, soll, rel, unit, dec, pts) {
    const list = Array.isArray(soll) ? soll : [soll]; x = numOf(x); const s0 = list[0];
    const ok = fin(x) && list.some(s => fin(s) && Math.abs(x - s) <= rel * Math.abs(s));
    return L(ok, label + ': ' + (fin(x) ? 'dein Wert ' + fm(x, dec) + (unit ? ' ' + unit : '') + (ok ? ' passt' : (x < s0 ? ' ist zu klein' : ' ist zu groß')) : 'kein Wert'), pts);
  }
  function selLine(label, got, right, pts, why) {
    const g = typeof got === 'string' ? got : '';
    return L(g !== '' && g === right, label + ': ' + (g === '' ? 'noch nichts gewählt' : (g === right ? 'Auswahl passt' : 'Auswahl passt nicht' + (why ? ' (' + why + ')' : ''))), pts);
  }
  function taskLines(st, data, ptsAll) {
    const ts = st.tasks || [], got = isObj(data && data.tasks) ? data.tasks : {}, each = Math.floor(ptsAll / Math.max(1, ts.length));
    return ts.map((t, i) => { const p = +got[t.id] || 0, min = t.min || 70; return L(p >= min, 'Lab-Aufgabe ' + t.id + ': ' + (p >= min ? 'gelöst (' + Math.round(p) + ' %)' : 'noch nicht gelöst (verlangt ' + min + ' %)'), i === ts.length - 1 ? ptsAll - each * (ts.length - 1) : each); });
  }
  const tasksDone = st => { const o = {}; (st.tasks || []).forEach(t => { o[t.id] = 100; }); return o; };

  /* ---------- Fachwerte (A) ---------- */
  const FACH = {
    recB: 32, reserve: 1.5, sysGB: 40, tage: 365, sek: 86400,
    ssd: [120, 240, 480, 960, 1920], psu: [200, 250, 300, 400, 500], nas: [500, 1000, 2000, 4000, 8000],
    hwBasis: 40 + 20 + 8 + 12, psuRes: 13 / 10, last: 0.6, stunden: 8760,
    zyklen: 4, inkrTage: 6, nasLuft: 1.2, spalten: 4, schleifenProS: 5e6, uSig: 5,
    maxAusfall: { '99': 100, '99.5': 50, '99.9': 10 }
  };
  const DB = [[1, 21.5], [1, 22.5], [1, 23], [2, 55], [2, 61], [2, 68], [3, 70], [3, 74], [3, 79.5], [3, 83.5]];   // (Platz, Temperatur) der Beispieltabelle
  const sum = a => a.reduce((s, x) => s + x, 0);

  /* ---------- Soll-Funktionen: je Zahl genau eine, genutzt von check, solution, Final ---------- */
  function sollEck(P) {
    const rec = P.nMess * P.kan * FACH.sek / P.takt, byte = rec * FACH.recB;
    return { nMess: P.nMess, rec: rec, mb: byte / 1e6, mib: byte / 1048576 };
  }
  const bedarfGB = (mb, P) => mb * FACH.tage * P.jahre / 1000 * FACH.reserve + FACH.sysGB;
  const smallest = (reihe, x) => { const v = reihe.find(r => r >= x); return v == null ? reihe[reihe.length - 1] : v; };
  const gibOf = gb => gb * 1e9 / 1073741824;
  const pSumme = P => FACH.hwBasis + P.cpuW;
  const psuOf = p => smallest(FACH.psu, p * FACH.psuRes);
  const kostenOf = (p, P) => p * FACH.last * FACH.stunden / 1000 * P.preis;
  function sollHw(P, mb) {
    mb = fin(mb) ? mb : sollEck(P).mb;
    const b = bedarfGB(mb, P), s = smallest(FACH.ssd, b), p = pSumme(P);
    return { bedarf: b, ssd: s, gib: gibOf(s), p: p, psu: psuOf(p), kosten: kostenOf(p, P) };
  }
  /* IPv4-Hilfen */
  function ipInt(s) { if (typeof s !== 'string') return null; const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/); if (!m) return null; const o = m.slice(1).map(Number); if (o.some(x => x > 255)) return null; return ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3]; }
  const ipStr = n => [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join('.');
  const maskStr = p => ipStr(4294967296 - Math.pow(2, 32 - p));
  const usable = p => Math.pow(2, 32 - p) - 2;
  function prefixFor(need) { for (let b = 2; b < 31; b++) if (Math.pow(2, b) - 2 >= need) return 32 - b; return 0; }
  /* VLSM: von groß nach klein, bei gleicher Größe Reihenfolge Messnetz, Büronetz, Servernetz; nie /31 oder /32 (Bedarf ist immer mindestens 3) */
  function alloc(P, nM) {
    const need = { mess: Math.ceil(nM * (100 + P.res) / 100) + 1, buero: P.nBuero + 1, srv: P.nSrv + 1 };
    const base = ((192 * 256 + 168) * 256 + P.net) * 256;
    const list = ['mess', 'buero', 'srv'].map((k, i) => { const p = prefixFor(need[k]); return { k: k, i: i, need: need[k], p: p, size: Math.pow(2, 32 - p) }; });
    const order = list.slice().sort((a, b) => b.size - a.size || a.i - b.i);
    let off = 0; order.forEach(n => { n.net = base + off; n.bc = n.net + n.size - 1; off += n.size; });
    const out = { total: off, base: base }; list.forEach(n => { out[n.k] = n; }); return out;
  }
  const uGpio = P => FACH.uSig * P.r2 / (P.r1 + P.r2);
  const proStunde = P => P.kan * 3600 / P.takt;
  const zeilenMio = (n, ps, P) => n * ps * 24 * FACH.tage * P.jahre / 1e6;
  const dbAvg3 = () => { const a = DB.filter(r => r[0] === 3).map(r => r[1]); return sum(a) / a.length; };
  const dbMax = () => Math.max.apply(null, DB.map(r => r[1]));
  const dbOver = t => DB.filter(r => r[1] > t).length;
  const sollAlgo = P => ({ mittel: sum(P.reihe) / P.reihe.length, max: Math.max.apply(null, P.reihe), anz: P.reihe.filter(x => x > P.tAlarm).length });
  const laufS = mio => mio * 1e6 / FACH.schleifenProS;
  const farbeOf = (w, P) => (w > P.tAlarm ? 'rot' : (w > P.tAlarm - 10 ? 'gelb' : 'gruen'));
  const abfragen = P => P.nBuero * 60 / P.refresh;
  function sollSich(P, mb) {
    mb = fin(mb) ? mb : sollEck(P).mb;
    return { backup: FACH.zyklen * (mb * FACH.tage + FACH.inkrTage * mb) / 1000, laeufe: 24 / P.sichStd * 7, rpo: P.sichStd, ausfall: FACH.stunden * (100 - P.verf) / 100 };
  }
  const nasOf = b => smallest(FACH.nas, b * FACH.nasLuft);

  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x766e7a31), L1 = level === 1;
    const hallen = L1 ? 2 : pick(r, [2, 3, 4]), je = L1 ? 6 : pick(r, [4, 5, 6, 8]);
    const p = {
      hallen: hallen, je: je, nMess: hallen * je, kan: L1 ? 2 : pick(r, [2, 3, 4]), takt: L1 ? 10 : pick(r, [1, 2, 5, 10]),
      jahre: L1 ? 2 : pick(r, [2, 3, 5]), nBuero: L1 ? 10 : pick(r, [8, 12, 20]), nSrv: L1 ? 2 : pick(r, [2, 5, 6]),
      res: level === 1 ? 0 : (level === 2 ? 25 : 50), cpuW: L1 ? 65 : pick(r, [65, 95, 125]), preis: L1 ? 0.3 : pick(r, [0.28, 0.3, 0.35]),
      net: L1 ? 10 : pick(r, [10, 20, 30, 100]), verf: L1 ? 99.5 : pick(r, [99, 99.5, 99.9]), sichStd: L1 ? 24 : pick(r, [12, 24]),
      tAlarm: L1 ? 70 : pick(r, [60, 70, 75, 80]), refresh: L1 ? 10 : pick(r, [5, 10, 15, 30])
    };
    const rv = L1 ? [2200, 3300] : pick(r, [[2200, 3300], [1800, 3300], [1000, 1800]]); p.r1 = rv[0]; p.r2 = rv[1];
    p.maxAusfall = FACH.maxAusfall[String(p.verf)];
    if (L1) p.reihe = [58, 61, 64, 70, 66, 72, 69, 63];
    else { p.reihe = []; for (let i = 0; i < 8; i++) p.reihe.push(p.tAlarm - 15 + Math.floor(r() * 25)); p.reihe[Math.floor(r() * 8)] = p.tAlarm + 1 + Math.floor(r() * 8); }
    p.live = [p.tAlarm - 10, p.tAlarm, p.tAlarm + 3];
    p.nasGB = nasOf(sollSich(p).backup);
    const z = ['Projekt Werkstatt-Netz mit Messdaten-Server, Stufe ' + level + '.',
      'Die Werkstatt der Tonfunk GmbH Ermsleben hat ' + p.hallen + ' Hallen mit je ' + p.je + ' Messplätzen. Jeder Messplatz bekommt einen Raspberry Pi als Sammler.',
      'Jeder Messplatz hat ' + p.kan + ' Temperaturkanäle; jeder Kanal wird alle ' + p.takt + ' s gemessen. Die Messwerte werden ' + p.jahre + ' Jahre aufbewahrt.',
      'Im Büro arbeiten ' + p.nBuero + ' Rechner, im Serverraum stehen ' + p.nSrv + ' Geräte (darunter der Messdaten-Server und die Sicherungsplatte). Basisnetz: 192.168.' + p.net + '.0/24, Wachstumsreserve im Messnetz: ' + p.res + ' %.',
      'Server: CPU mit ' + p.cpuW + ' W, Strompreis ' + fm(p.preis, 2) + ' EUR je kWh, Verfügbarkeit ' + fm(p.verf, 1) + ' % (höchstens ' + p.maxAusfall + ' h Ausfall im Jahr). Sicherung alle ' + p.sichStd + ' h auf eine Sicherungsplatte mit ' + p.nasGB + ' GB.',
      'Alarm bei Messwerten über ' + p.tAlarm + ' °C, Warnung über ' + (p.tAlarm - 10) + ' °C. Die Anzeige lädt alle ' + p.refresh + ' s neu. Testwerte für die Anzeige: ' + p.live.join(', ') + ' °C.',
      'Sensor-Signal 5 V, Spannungsteiler am Pi: R1 = ' + p.r1 + ' Ω (oben), R2 = ' + p.r2 + ' Ω (unten).',
      'Beispielreihe einer Messung (°C): ' + p.reihe.join(', ') + '.'];
    if (level === 3) z.push('Zusatzforderung: Das Messnetz muss 50 % mehr Messplätze aufnehmen können (steckt in der Reserve oben).');
    return { params: p, text: z };
  }

  /* ---------- eigene Werte aus Vorstationen ---------- */
  const ownNum = (ctx, slot, key, fb) => { const x = numOf(vals(slotOf(ctx, slot))[key]); return fin(x) ? x : fb; };
  const ownTxt = (ctx, slot, key) => { const x = vals(slotOf(ctx, slot))[key]; return typeof x === 'string' ? x : ''; };
  const nOwn = (ctx, P) => { const x = ownNum(ctx, 'werknetz.eckdaten', 'nMess', P.nMess); return Math.floor(x) === x && x >= 1 && x <= 250 ? x : P.nMess; };
  const ipLine = (label, txt, soll, pts) => {
    const v = ipInt(typeof txt === 'string' ? txt : ''), s = ipInt(ipStr(soll));
    return L(v !== null && v === s, label + ': ' + (typeof txt === 'string' && txt.trim() !== '' ? (v === null ? 'keine gültige IPv4-Adresse' : (v === s ? 'Adresse passt' : (Math.floor(v / 256) === Math.floor(s / 256) ? 'Adresse passt nicht' : 'Adresse liegt nicht im Basisnetz'))) : 'keine Eingabe'), pts);
  };
  const optList = arr => arr.map(x => ({ value: x[0], label: x[1] }));

  /* ---------- Stationen ---------- */
  const SEL_LH = optList([['ag', 'Der Auftraggeber: er beschreibt, was das System leisten soll'], ['an', 'Der Auftragnehmer: er beschreibt, wie er es technisch umsetzt'], ['hw', 'Der Hersteller der Hardware']]);
  const SEL_PEGEL = optList([['direkt', 'Sensor direkt an einen GPIO-Pin anschließen'], ['teiler', 'Spannungsteiler oder Pegelwandler dazwischen schalten'], ['v5', 'Das Signal an den 5-V-Versorgungspin legen']]);
  const SEL_SQL = optList([['a', 'SELECT platz_id, AVG(temp) FROM messwert GROUP BY platz_id;'], ['b', 'SELECT platz_id, AVG(temp) FROM messwert;'], ['c', 'SELECT AVG(temp) FROM messwert GROUP BY zeit;'], ['d', 'SELECT platz_id, temp FROM messwert WHERE AVG(temp);']]);
  const SEL_PK = optList([['id', 'id'], ['platz_id', 'platz_id'], ['zeit', 'zeit'], ['temp', 'temp']]);
  const SEL_STRUKT = optList([['s1', 'Schleife über alle Werte, darin eine Verzweigung "Wert größer als Schwelle"'], ['s2', 'Eine einzelne Verzweigung am Anfang, keine Schleife'], ['s3', 'Schleife über alle Werte, jeder Wert wird ohne Bedingung gezählt'], ['s4', 'Verzweigung am Anfang, danach eine Schleife nur über die Werte unter der Schwelle']]);
  const SEL_WACHS = optList([['gleich', 'Die Laufzeit bleibt gleich'], ['doppelt', 'Die Laufzeit verdoppelt sich'], ['vier', 'Die Laufzeit wird viermal so lang']]);
  const SEL_FARBE = optList([['gruen', 'grün'], ['gelb', 'gelb'], ['rot', 'rot']]);
  const SEL_ARCH = optList([['db', 'Die App liest aus der Datenbank, die Sammler schreiben dort hinein'], ['pi', 'Der Browser fragt jeden einzelnen Pi direkt ab'], ['datei', 'Alle Pis schreiben in dieselbe Textdatei auf einem Büro-Rechner']]);
  const SEL_RECHTE = optList([['600', '600'], ['640', '640'], ['644', '644'], ['660', '660'], ['777', '777']]);
  const SEL_REGEL = optList([['2', '2 Kopien'], ['3', '3 Kopien'], ['4', '4 Kopien']]);
  const mut = (name, fn, fail) => ({ name: name, mutate: fn, expectFail: fail });

  function checkEck(data, ctx) {
    const P = P_(ctx), v = vals(data), s = sollEck(P), ownRec = numOf(v.rec);
    return [
      numLine('Messplätze insgesamt', v.nMess, s.nMess, 0.001, '', 0, 10),
      numLine('Messwerte pro Tag', v.rec, s.rec, 0.005 * TOL(ctx), '', 0, 15),
      numLine('Datenmenge pro Tag in MB (dezimal)', v.mb, [s.mb, fin(ownRec) ? ownRec * FACH.recB / 1e6 : NaN], 0.01 * TOL(ctx), 'MB', 3, 15),
      numLine('Datenmenge pro Tag in MiB (binär)', v.mib, [s.mib, fin(ownRec) ? ownRec * FACH.recB / 1048576 : NaN], 0.01 * TOL(ctx), 'MiB', 3, 20),
      selLine('Wer schreibt das Lastenheft', v.frage, 'ag', 10)
    ].concat(taskLines(STATIONS[0], data, 30));
  }
  function checkHw(data, ctx) {
    const P = P_(ctx), v = vals(data), mb = ownNum(ctx, 'werknetz.eckdaten', 'mb', sollEck(P).mb), s = sollHw(P, mb);
    const b = numOf(v.bedarf), bUse = fin(b) ? b : s.bedarf, ssd = numOf(v.ssd), p = numOf(v.pSumme), pUse = fin(p) ? p : s.p, ssdUse = fin(ssd) ? ssd : s.ssd;
    const need = smallest(FACH.ssd, bUse), psuNeed = psuOf(pUse);
    return [
      numLine('Speicherbedarf mit Reserve', v.bedarf, s.bedarf, 0.03 * TOL(ctx), 'GB', 1, 15),
      L(fin(ssd) && ssd === need, 'SSD-Größe: ' + (fin(ssd) ? (ssd === need ? 'passt zu deinem Bedarf' : (ssd < need ? 'reicht für deinen Bedarf nicht' : 'reicht, ist aber größer als nötig')) : 'noch nichts gewählt'), 10),
      numLine('Anzeige im Betriebssystem in GiB', v.gib, gibOf(ssdUse), 0.01 * TOL(ctx), 'GiB', 1, 10),
      numLine('Summe der Leistungsaufnahme', v.pSumme, s.p, 0.01 * TOL(ctx), 'W', 0, 10),
      L(fin(numOf(v.psu)) && numOf(v.psu) === psuNeed, 'Netzteil: ' + (fin(numOf(v.psu)) ? (numOf(v.psu) === psuNeed ? 'passt zu deiner Leistung mit Reserve' : (numOf(v.psu) < psuNeed ? 'zu schwach für deine Leistung mit Reserve' : 'reicht, ist aber größer als nötig')) : 'noch nichts gewählt'), 10),
      numLine('Stromkosten pro Jahr', v.kosten, kostenOf(pUse, P), 0.02 * TOL(ctx), 'EUR', 2, 15)
    ].concat(taskLines(STATIONS[1], data, 30));
  }
  function checkNetz(data, ctx) {
    const P = P_(ctx), v = vals(data), n = nOwn(ctx, P), a = alloc(P, n);
    const pl = (label, x, soll, pts) => { x = numOf(x); return L(fin(x) && x === soll, label + ': ' + (fin(x) ? 'dein Präfix /' + fm(x, 0) + (x === soll ? ' passt' : (x > soll ? ' macht das Netz zu klein' : ' macht das Netz größer als nötig')) : 'kein Wert'), pts); };
    return [
      numLine('Adressbedarf im Messnetz (mit Gateway und Reserve)', v.bedarf, a.mess.need, 0.001, '', 0, 10),
      pl('Präfix Messnetz', v.pMess, a.mess.p, 12), pl('Präfix Büronetz', v.pBuero, a.buero.p, 10), pl('Präfix Servernetz', v.pSrv, a.srv.p, 10),
      ipLine('Netzadresse Messnetz', v.netzMess, a.mess.net, 14), ipLine('Netzadresse Servernetz', v.netzSrv, a.srv.net, 14)
    ].concat(taskLines(STATIONS[2], data, 30));
  }
  function piBase(ctx, P) {
    const n = nOwn(ctx, P), a = alloc(P, n), vn = vals(slotOf(ctx, 'werknetz.netz')), net = ipInt(typeof vn.netzMess === 'string' ? vn.netzMess : ''), p = numOf(vn.pMess);
    return { n: n, net: net === null ? a.mess.net : net, p: fin(p) && p >= 8 && p <= 30 && Math.floor(p) === p ? p : a.mess.p };
  }
  function checkPi(data, ctx) {
    const P = P_(ctx), v = vals(data), b = piBase(ctx, P), t = TOL(ctx);
    return [
      ipLine('IP-Adresse des ersten Pi', v.ipFirst, b.net + 2, 10), ipLine('IP-Adresse des letzten Pi', v.ipLast, b.net + 1 + b.n, 10),
      ipLine('Subnetzmaske', v.maske, ipInt(maskStr(b.p)), 10),
      numLine('Messwerte je Pi und Stunde', v.proStunde, proStunde(P), 0.005 * t, '', 0, 10),
      numLine('Spannung am GPIO-Pin', v.uGpio, uGpio(P), 0.02 * t, 'V', 2, 15),
      selLine('Schutz des GPIO-Pins', v.pegel, 'teiler', 15, '3,3 V Pegel beachten')
    ].concat(taskLines(STATIONS[3], data, 30));
  }
  function checkDb(data, ctx) {
    const P = P_(ctx), v = vals(data), n = nOwn(ctx, P), ps = ownNum(ctx, 'werknetz.pi', 'proStunde', proStunde(P)), t = TOL(ctx);
    return [
      numLine('Mittelwert der Temperatur von Platz 3', v.mittel3, dbAvg3(), 0.005 * t, '°C', 2, 10),
      numLine('Höchste Temperatur der Tabelle', v.maxAlle, dbMax(), 0.005 * t, '°C', 1, 10),
      numLine('Zeilen über der Alarmschwelle', v.anzAlarm, dbOver(P.tAlarm), 0.001, '', 0, 12),
      selLine('Abfrage für den Mittelwert je Platz', v.sql, 'a', 14),
      selLine('Primärschlüssel der Tabelle', v.pk, 'id', 10),
      numLine('Zeilen am Ende der Aufbewahrungszeit', v.zeilen, zeilenMio(n, ps, P), 0.02 * t, 'Mio.', 1, 14)
    ].concat(taskLines(STATIONS[4], data, 30));
  }
  function checkAlgo(data, ctx) {
    const P = P_(ctx), v = vals(data), s = sollAlgo(P), z = ownNum(ctx, 'werknetz.db', 'zeilen', NaN), t = TOL(ctx);
    const mio = fin(z) ? z : zeilenMio(P.nMess, proStunde(P), P);
    return [
      numLine('Mittelwert der Beispielreihe', v.mittel, s.mittel, 0.005 * t, '°C', 2, 12), numLine('Höchstwert der Beispielreihe', v.max, s.max, 0.001, '°C', 0, 10),
      numLine('Werte über der Alarmschwelle', v.anz, s.anz, 0.001, '', 0, 12),
      selLine('Aufbau des Struktogramms', v.struktur, 's1', 12),
      selLine('Laufzeit bei doppelter Datenmenge', v.wachstum, 'doppelt', 12),
      numLine('Laufzeit für die ganze Tabelle', v.laufzeit, laufS(mio), 0.02 * t, 's', 2, 12)
    ].concat(taskLines(STATIONS[5], data, 30));
  }
  function checkApp(data, ctx) {
    const P = P_(ctx), v = vals(data), n = nOwn(ctx, P), t = TOL(ctx);
    return [
      selLine('Farbe beim ersten Testwert', v.farbe1, farbeOf(P.live[0], P), 12, 'Grenzwert genau beachten'), selLine('Farbe beim zweiten Testwert', v.farbe2, farbeOf(P.live[1], P), 12, 'Grenzwert genau beachten'),
      selLine('Farbe beim dritten Testwert', v.farbe3, farbeOf(P.live[2], P), 12),
      numLine('Kachelzeilen der Übersicht', v.zeilen, Math.ceil(n / FACH.spalten), 0.001, '', 0, 12),
      numLine('Abfragen pro Minute am Server', v.abfragen, abfragen(P), 0.005 * t, '', 0, 12),
      selLine('Datenweg der Anzeige-App', v.arch, 'db', 10)
    ].concat(taskLines(STATIONS[6], data, 30));
  }
  function checkSich(data, ctx) {
    const P = P_(ctx), v = vals(data), mb = ownNum(ctx, 'werknetz.eckdaten', 'mb', sollEck(P).mb), s = sollSich(P, mb), t = TOL(ctx);
    return [
      numLine('Höchster Datenverlust (RPO)', v.rpo, s.rpo, 0.001, 'h', 0, 10),
      numLine('Sicherungsläufe pro Woche', v.laeufe, s.laeufe, 0.001, '', 0, 10),
      numLine('Speicherbedarf der Sicherung', v.backup, s.backup, 0.03 * t, 'GB', 1, 18),
      numLine('Ausfallzeit pro Jahr', v.ausfall, s.ausfall, 0.02 * t, 'h', 1, 12),
      selLine('Dateirechte der Messdaten-Datei', v.rechte, '640', 10, 'Besitzer schreibt, Gruppe liest, andere nichts'),
      selLine('Kopien nach der 3-2-1-Regel', v.regel, '3', 10)
    ].concat(taskLines(STATIONS[7], data, 30));
  }

  const STATIONS = [
    { id: 'vn1', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Lastenheft auswerten', level: 1,
      on: 'vb',
      text: 'Lies das Lastenheft und halte die Eckdaten fest: Wie viele Messplätze gibt es insgesamt, wie viele Messwerte fallen pro Tag an und wie groß ist die Datenmenge pro Tag? Jeder Messwert wird als Datensatz mit 32 Byte gespeichert (A). Gib die Datenmenge einmal dezimal in MB (1 MB = 1 000 000 Byte) und einmal binär in MiB (1 MiB = 1 048 576 Byte) an. Beantworte außerdem, wer das Lastenheft schreibt.',
      in: [], out: 'werknetz.eckdaten', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'hwl', id: 'hwl23', min: 70 }, { lab: 'alg', id: 'alg48', min: 70 }],
      form: [{ key: 'nMess', label: 'Messplätze insgesamt', type: 'number' }, { key: 'rec', label: 'Messwerte pro Tag (alle Messplätze, alle Kanäle)', type: 'number' },
        { key: 'mb', label: 'Datenmenge pro Tag (dezimal)', type: 'number', unit: 'MB' }, { key: 'mib', label: 'Datenmenge pro Tag (binär)', type: 'number', unit: 'MiB' },
        { key: 'frage', label: 'Wer schreibt das Lastenheft?', type: 'select', options: SEL_LH }],
      hint: ['Anzahl Messplätze = Hallen mal Plätze je Halle. Ein Tag hat 86 400 Sekunden.', 'Messwerte pro Tag = Messplätze · Kanäle · 86 400 s ÷ Intervall. Datenmenge in Byte = Messwerte · 32.', 'MB: Byte durch 10^6 teilen. MiB: Byte durch 2^20 = 1 048 576 teilen. Das Lastenheft schreibt, wer etwas bestellt.'],
      check: safe(checkEck, 'Lastenheft'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const s = sollEck(P_(ctx)); return { vals: { nMess: s.nMess, rec: s.rec, mb: s.mb, mib: Math.round(s.mib * 1e6) / 1e6, frage: 'ag' }, tasks: tasksDone(STATIONS[0]) }; },
      mutants: [mut('Nur einen Kanal je Messplatz gerechnet', (d, c) => { d.vals.rec = d.vals.rec / P_(c).kan; return d; }, ['Messwerte pro Tag']),
        mut('MiB und MB verwechselt', d => { d.vals.mib = d.vals.mb; return d; }, ['Datenmenge pro Tag in MiB']),
        mut('Nur die Hallen gezählt', (d, c) => { d.vals.nMess = P_(c).hallen; return d; }, ['Messplätze insgesamt']),
        mut('Rolle im Lastenheft falsch', d => { d.vals.frage = 'an'; return d; }, ['Wer schreibt das Lastenheft'])] },
    { id: 'vn2', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Server und Speicher auswählen', level: 2,
      on: 'vb',
      text: 'Plane den Messdaten-Server. Der Speicherbedarf: deine Datenmenge pro Tag (MB) mal 365 Tage mal Aufbewahrungsjahre, dazu 50 % für Indizes und Reserve (A) und 40 GB für Betriebssystem und Programme (A). Wähle die kleinste SSD aus 120, 240, 480, 960 oder 1920 GB (Herstellerangabe dezimal, zwei SSD als RAID 1, nutzbar ist eine, A) und gib an, wie viel GiB das Betriebssystem anzeigt. Leistung: Mainboard 40 W, Arbeitsspeicher 20 W, zwei SSD zusammen 8 W, Netzwerk und Lüfter 12 W (A), dazu die CPU aus dem Lastenheft. Das Netzteil braucht 30 % Reserve (A) und kommt aus der Reihe 200, 250, 300, 400, 500 W. Der Server läuft rund um die Uhr (8 760 h im Jahr) im Mittel mit 60 % der Summenleistung (A): Wie hoch sind die Stromkosten pro Jahr?',
      in: ['werknetz.eckdaten'], out: 'werknetz.hardware', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'hwl', id: 'hwl3', min: 70 }, { lab: 'hwl', id: 'hwl25', min: 70 }, { lab: 'hwl', id: 'hwl29', min: 70 }],
      form: [{ key: 'bedarf', label: 'Speicherbedarf mit Reserve (dezimal)', type: 'number', unit: 'GB' },
        { key: 'ssd', label: 'SSD-Größe', type: 'select', options: FACH.ssd.map(x => ({ value: String(x), label: x + ' GB' })) },
        { key: 'gib', label: 'Angezeigte Größe der SSD im Betriebssystem (binär)', type: 'number', unit: 'GiB' },
        { key: 'pSumme', label: 'Summe der Leistungsaufnahme', type: 'number', unit: 'W' },
        { key: 'psu', label: 'Netzteil', type: 'select', options: FACH.psu.map(x => ({ value: String(x), label: x + ' W' })) },
        { key: 'kosten', label: 'Stromkosten pro Jahr', type: 'number', unit: 'EUR' }],
      hint: ['Rechne zuerst die Daten über die ganze Aufbewahrungszeit in GB aus (MB geteilt durch 1000), dann Reserve und System.', 'GiB = Hersteller-GB · 10^9 ÷ 2^30. Netzteil: Summe · 1,3, dann die kleinste Stufe, die reicht. kWh = Watt · Stunden ÷ 1000.', 'Mittlere Leistung = 0,6 · Summe. Jahresenergie = mittlere Leistung · 8,76 (kWh je Watt und Jahr). Mal Strompreis.'],
      check: safe(checkHw, 'Server'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), s = sollHw(P, ownNum(ctx, 'werknetz.eckdaten', 'mb', sollEck(P).mb)); return { vals: { bedarf: Math.round(s.bedarf * 1000) / 1000, ssd: String(s.ssd), gib: Math.round(s.gib * 1000) / 1000, pSumme: s.p, psu: String(s.psu), kosten: Math.round(s.kosten * 1000) / 1000 }, tasks: tasksDone(STATIONS[1]) }; },
      mutants: [mut('Platz für das Betriebssystem vergessen', d => { d.vals.bedarf = d.vals.bedarf - FACH.sysGB; return d; }, ['Speicherbedarf mit Reserve']),
        mut('GiB gleich GB gesetzt', d => { d.vals.gib = +d.vals.ssd; return d; }, ['Anzeige im Betriebssystem']),
        mut('Netzteil zu schwach gewählt', d => { d.vals.psu = String(+d.vals.psu - 50); return d; }, ['Netzteil']),
        mut('Stromkosten mit voller Leistung gerechnet', (d, c) => { d.vals.kosten = d.vals.kosten / FACH.last; return d; }, ['Stromkosten pro Jahr'])] },
    { id: 'vn3', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Subnetze und Adressen planen', level: 2,
      on: 'vb',
      text: 'Plane drei Netze mit VLSM im Basisnetz aus dem Lastenheft (A: 192.168.x.0/24): Messnetz (alle Pis, Gateway, dazu die Wachstumsreserve aufgerundet), Büronetz (alle Büro-Rechner und ein Gateway) und Servernetz (alle Server-Geräte und ein Gateway). Verteile von groß nach klein, lückenlos ab .0; bei gleicher Größe gilt die Reihenfolge Messnetz, Büronetz, Servernetz (A). Jedes Gateway bekommt die erste nutzbare Adresse (A). Die Präfixe /31 und /32 setzt du nicht ein (A). Trage Adressbedarf, Präfixe und die Netzadressen von Messnetz und Servernetz ein.',
      in: ['werknetz.eckdaten'], out: 'werknetz.netz', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'net', id: 'net19', min: 70 }, { lab: 'net', id: 'net20', min: 70 }],
      form: [{ key: 'bedarf', label: 'Adressbedarf im Messnetz (Pis, Reserve, Gateway)', type: 'number' },
        { key: 'pMess', label: 'Präfixlänge Messnetz', type: 'number', unit: '/' }, { key: 'pBuero', label: 'Präfixlänge Büronetz', type: 'number', unit: '/' }, { key: 'pSrv', label: 'Präfixlänge Servernetz', type: 'number', unit: '/' },
        { key: 'netzMess', label: 'Netzadresse Messnetz', type: 'text', hint: 'Schreibweise 192.168.x.y' }, { key: 'netzSrv', label: 'Netzadresse Servernetz', type: 'text', hint: 'Schreibweise 192.168.x.y' }],
      hint: ['Messnetz: Messplätze mal (1 + Reserve), aufrunden, plus ein Gateway. Hosts je Netz = 2^(32 - Präfix) - 2.', 'Suche je Netz die kleinste Zweierpotenz, deren Hosts den Bedarf decken. Das größte Netz beginnt bei .0, das nächste direkt dahinter.', 'Die Netzadresse eines Netzes ist die Summe der Größen aller vorher verteilten Netze, ab .0 gezählt.'],
      check: safe(checkNetz, 'Netz'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), a = alloc(P, nOwn(ctx, P)); return { vals: { bedarf: a.mess.need, pMess: a.mess.p, pBuero: a.buero.p, pSrv: a.srv.p, netzMess: ipStr(a.mess.net), netzSrv: ipStr(a.srv.net) }, tasks: tasksDone(STATIONS[2]) }; },
      mutants: [mut('Gateway vergessen', d => { d.vals.bedarf -= 1; return d; }, ['Adressbedarf im Messnetz']),
        mut('Messnetz zu klein gewählt', d => { d.vals.pMess += 1; return d; }, ['Präfix Messnetz']),
        mut('Servernetz an die falsche Stelle gelegt', d => { const m = d.vals.netzSrv.split('.'); m[3] = String((+m[3] + 8) % 256); d.vals.netzSrv = m.join('.'); return d; }, ['Netzadresse Servernetz']),
        mut('Büronetz übergroß', d => { d.vals.pBuero -= 1; return d; }, ['Präfix Büronetz'])] },
    { id: 'vn4', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Raspberry Pi als Sammler', level: 2,
      on: 'vb',
      text: 'Jeder Messplatz hat einen Raspberry Pi als Sammler im Messnetz. Das Gateway hat die erste nutzbare Adresse, der erste Pi die nächste, die weiteren folgen lückenlos (A). Trage die IP-Adresse des ersten und des letzten Pi ein (aus deinem Netzplan), dazu die Subnetzmaske in Punktschreibweise und wie viele Messwerte ein Pi pro Stunde aufnimmt. Der Sensor liefert ein 5-V-Signal, die GPIO-Pins des Pi vertragen höchstens 3,3 V (A): Rechne die Spannung am GPIO hinter dem Spannungsteiler (Werte im Lastenheft) und wähle die richtige Schutzmaßnahme.',
      in: ['werknetz.netz', 'werknetz.eckdaten'], out: 'werknetz.pi', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'lin', id: 'lin23', min: 70 }, { lab: 'lin', id: 'lin24', min: 70 }],
      form: [{ key: 'ipFirst', label: 'IP-Adresse des ersten Pi', type: 'text' }, { key: 'ipLast', label: 'IP-Adresse des letzten Pi', type: 'text' }, { key: 'maske', label: 'Subnetzmaske des Messnetzes', type: 'text', hint: 'Schreibweise 255.255.x.y' },
        { key: 'proStunde', label: 'Messwerte je Pi und Stunde', type: 'number' }, { key: 'uGpio', label: 'Spannung am GPIO-Pin', type: 'number', unit: 'V' },
        { key: 'pegel', label: 'Wie schützt du den GPIO-Pin?', type: 'select', options: SEL_PEGEL }],
      hint: ['Gateway = Netzadresse + 1, der erste Pi = Netzadresse + 2. Die Maske ergibt sich aus der Präfixlänge deines Messnetzes.', 'Letzter Pi = Netzadresse + 1 + Anzahl der Messplätze. Messwerte je Stunde = Kanäle · 3 600 s ÷ Intervall.', 'Spannungsteiler: U = 5 V · R2 ÷ (R1 + R2). Der Pi verträgt am Eingang höchstens 3,3 V.'],
      check: safe(checkPi, 'Pi'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), b = piBase(ctx, P); return { vals: { ipFirst: ipStr(b.net + 2), ipLast: ipStr(b.net + 1 + b.n), maske: maskStr(b.p), proStunde: proStunde(P), uGpio: Math.round(uGpio(P) * 1000) / 1000, pegel: 'teiler' }, tasks: tasksDone(STATIONS[3]) }; },
      mutants: [mut('Gateway-Adresse für den ersten Pi genommen', d => { const m = d.vals.ipFirst.split('.'); m[3] = String(+m[3] - 1); d.vals.ipFirst = m.join('.'); return d; }, ['IP-Adresse des ersten Pi']),
        mut('Falsche Subnetzmaske', d => { d.vals.maske = '255.255.255.0'; return d; }, ['Subnetzmaske']),
        mut('Spannung mit R1 statt R2 gerechnet', (d, c) => { const P = P_(c); d.vals.uGpio = FACH.uSig * P.r1 / (P.r1 + P.r2); return d; }, ['Spannung am GPIO-Pin']),
        mut('Sensor direkt angeschlossen', d => { d.vals.pegel = 'direkt'; return d; }, ['Schutz des GPIO-Pins'])] },
    { id: 'vn5', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Datenbank und SQL-Abfragen', level: 2,
      on: 'vb',
      text: 'Die Messwerte landen in der Tabelle messwert mit den Spalten id, platz_id, zeit und temp. Eine kleine Probe (id: Platz, Temperatur in °C): 1: Platz 1, 21,5 | 2: Platz 1, 22,5 | 3: Platz 1, 23 | 4: Platz 2, 55 | 5: Platz 2, 61 | 6: Platz 2, 68 | 7: Platz 3, 70 | 8: Platz 3, 74 | 9: Platz 3, 79,5 | 10: Platz 3, 83,5. Werte aus: Mittelwert von Platz 3, höchste Temperatur der Tabelle und die Zahl der Zeilen mit temp über der Alarmschwelle aus dem Lastenheft (über = größer als, A). Wähle die richtige Abfrage für den Mittelwert je Platz und den Primärschlüssel. Dann rechne mit deinen Werten (Messplätze, Messwerte je Pi und Stunde) aus, wie viele Zeilen die Tabelle am Ende der Aufbewahrungszeit hat (365 Tage je Jahr), in Millionen.',
      in: ['werknetz.eckdaten', 'werknetz.pi'], out: 'werknetz.db', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'sql', id: 'sql18', min: 70 }, { lab: 'sql', id: 'sql19', min: 70 }, { lab: 'sql', id: 'sql37', min: 70 }],
      form: [{ key: 'mittel3', label: 'Mittelwert der Temperatur von Platz 3', type: 'number', unit: '°C' }, { key: 'maxAlle', label: 'Höchste Temperatur der ganzen Tabelle', type: 'number', unit: '°C' },
        { key: 'anzAlarm', label: 'Zeilen mit temp über der Alarmschwelle', type: 'number' },
        { key: 'sql', label: 'Welche Abfrage liefert den Mittelwert je Platz?', type: 'select', options: SEL_SQL }, { key: 'pk', label: 'Welche Spalte ist der Primärschlüssel?', type: 'select', options: SEL_PK },
        { key: 'zeilen', label: 'Zeilen am Ende der Aufbewahrungszeit', type: 'number', unit: 'Mio.' }],
      hint: ['Mittelwert: Summe geteilt durch Anzahl, nur für die Zeilen von Platz 3. Zähle bei der Schwelle genau: "über" heißt, der Wert selbst zählt nicht.', 'Für Ergebnis je Gruppe braucht SQL eine Aggregatfunktion und GROUP BY. Der Primärschlüssel ist eindeutig und unveränderlich.', 'Zeilen = Messplätze · Messwerte je Pi und Stunde · 24 · 365 · Jahre. Durch eine Million teilen.'],
      check: safe(checkDb, 'Datenbank'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), n = nOwn(ctx, P), ps = ownNum(ctx, 'werknetz.pi', 'proStunde', proStunde(P)); return { vals: { mittel3: dbAvg3(), maxAlle: dbMax(), anzAlarm: dbOver(P.tAlarm), sql: 'a', pk: 'id', zeilen: Math.round(zeilenMio(n, ps, P) * 1000) / 1000 }, tasks: tasksDone(STATIONS[4]) }; },
      mutants: [mut('Eine Zeile zu viel gezählt (Schwelle selbst mitgezählt)', d => { d.vals.anzAlarm += 1; return d; }, ['Zeilen über der Alarmschwelle']),
        mut('GROUP BY vergessen', d => { d.vals.sql = 'b'; return d; }, ['Abfrage für den Mittelwert je Platz']),
        mut('Mittelwert aller Plätze statt Platz 3', d => { d.vals.mittel3 = sum(DB.map(r => r[1])) / DB.length; return d; }, ['Mittelwert der Temperatur von Platz 3']),
        mut('Aufbewahrungsjahre vergessen', (d, c) => { d.vals.zeilen = d.vals.zeilen / P_(c).jahre; return d; }, ['Zeilen am Ende der Aufbewahrungszeit'])] },
    { id: 'vn6', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Auswertung als Algorithmus', level: 3,
      on: 'vb',
      text: 'Schreibe die Auswertung als Ablauf: In einer Schleife über alle Werte einer Reihe bestimmst du den Mittelwert, den Höchstwert und zählst, wie viele Werte über der Alarmschwelle liegen (über = größer als, A). Nimm die Beispielreihe aus dem Lastenheft und trage die Ergebnisse ein. Wähle das passende Struktogramm für die Alarmzählung. Schätze dann die Laufzeit: Die ganze Tabelle (deine Zeilenzahl aus der Datenbank) wird einmal durchlaufen, mit 5 Millionen Schleifendurchläufen pro Sekunde (A). Wie ändert sich die Laufzeit bei doppelter Datenmenge?',
      in: ['werknetz.db'], out: 'werknetz.algo', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'alg', id: 'alg12', min: 70 }, { lab: 'alg', id: 'alg16', min: 70 }, { lab: 'alg', id: 'alg30', min: 70 }],
      form: [{ key: 'mittel', label: 'Mittelwert der Beispielreihe', type: 'number', unit: '°C' }, { key: 'max', label: 'Höchstwert der Beispielreihe', type: 'number', unit: '°C' },
        { key: 'anz', label: 'Werte über der Alarmschwelle', type: 'number' },
        { key: 'struktur', label: 'Welches Struktogramm passt zur Alarmzählung?', type: 'select', options: SEL_STRUKT },
        { key: 'wachstum', label: 'Laufzeit bei doppelt so vielen Werten', type: 'select', options: SEL_WACHS },
        { key: 'laufzeit', label: 'Laufzeit für die ganze Tabelle', type: 'number', unit: 's' }],
      hint: ['Setze einen Zähler und eine Summe auf null, gehe jeden Wert einmal durch und merke dir den größten bisher gesehenen.', 'Alarmzählung: Schleife über alle Werte, darin eine Verzweigung "größer als Schwelle", die den Zähler erhöht. Die Laufzeit wächst mit der Zahl der Durchläufe.', 'Laufzeit in Sekunden = Zeilenzahl ÷ Durchläufe pro Sekunde. Achte auf Millionen gegen Einzelzahlen.'],
      check: safe(checkAlgo, 'Algorithmus'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), s = sollAlgo(P), z = ownNum(ctx, 'werknetz.db', 'zeilen', zeilenMio(P.nMess, proStunde(P), P)); return { vals: { mittel: Math.round(s.mittel * 1e4) / 1e4, max: s.max, anz: s.anz, struktur: 's1', wachstum: 'doppelt', laufzeit: Math.round(laufS(z) * 1e4) / 1e4 }, tasks: tasksDone(STATIONS[5]) }; },
      mutants: [mut('Wert auf der Schwelle mitgezählt', d => { d.vals.anz += 1; return d; }, ['Werte über der Alarmschwelle']),
        mut('Mittelwert durch die falsche Anzahl geteilt', (d, c) => { d.vals.mittel = sum(P_(c).reihe) / (P_(c).reihe.length - 1); return d; }, ['Mittelwert der Beispielreihe']),
        mut('Laufzeit quadratisch geschätzt', d => { d.vals.wachstum = 'vier'; return d; }, ['Laufzeit bei doppelter Datenmenge']),
        mut('Schleife ohne Bedingung gezeichnet', d => { d.vals.struktur = 's3'; return d; }, ['Aufbau des Struktogramms'])] },
    { id: 'vn7', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Kleine Anzeige-App', level: 2,
      on: 'vb',
      text: 'Im Büro soll eine kleine Web-App alle Messplätze als Kacheln zeigen (4 Kacheln je Zeile, A). Die Farbe der Kachel hängt vom aktuellen Wert ab: grün bis einschließlich Warnschwelle, gelb über der Warnschwelle bis einschließlich Alarmschwelle, rot über der Alarmschwelle (A). Bestimme die Farbe für die drei Testwerte aus dem Lastenheft. Rechne die Zahl der Kachelzeilen für deine Messplätze und die Last am Server: Alle Büro-Rechner haben die Seite offen und laden sie im Takt des Lastenhefts neu. Wähle auch, woher die App ihre Daten holt.',
      in: ['werknetz.eckdaten'], out: 'werknetz.app', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'alg', id: 'alg2', min: 70 }, { lab: 'alg', id: 'alg5', min: 70 }],
      form: [{ key: 'farbe1', label: 'Farbe beim ersten Testwert', type: 'select', options: SEL_FARBE }, { key: 'farbe2', label: 'Farbe beim zweiten Testwert', type: 'select', options: SEL_FARBE }, { key: 'farbe3', label: 'Farbe beim dritten Testwert', type: 'select', options: SEL_FARBE },
        { key: 'zeilen', label: 'Zeilen mit Kacheln (4 je Zeile)', type: 'number' }, { key: 'abfragen', label: 'Abfragen pro Minute am Server (alle Büro-Rechner)', type: 'number' },
        { key: 'arch', label: 'Woher holt die App ihre Daten?', type: 'select', options: SEL_ARCH }],
      hint: ['Warnschwelle = Alarmschwelle minus 10 K. Ein Wert genau auf der Schwelle liegt noch nicht darüber.', 'Kachelzeilen: Messplätze durch 4, immer aufrunden. Abfragen pro Minute = Büro-Rechner · 60 s ÷ Neuladezeit.', 'Eine zentrale Stelle für die Daten ist besser als viele Einzelabfragen: Die Sammler schreiben, die App liest.'],
      check: safe(checkApp, 'Anzeige-App'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx); return { vals: { farbe1: farbeOf(P.live[0], P), farbe2: farbeOf(P.live[1], P), farbe3: farbeOf(P.live[2], P), zeilen: Math.ceil(nOwn(ctx, P) / FACH.spalten), abfragen: abfragen(P), arch: 'db' }, tasks: tasksDone(STATIONS[6]) }; },
      mutants: [mut('Wert auf der Alarmschwelle rot gefärbt', d => { d.vals.farbe2 = 'rot'; return d; }, ['Farbe beim zweiten Testwert']),
        mut('Wert auf der Warnschwelle gelb gefärbt', d => { d.vals.farbe1 = 'gelb'; return d; }, ['Farbe beim ersten Testwert']),
        mut('Kachelzeilen abgerundet', d => { d.vals.zeilen -= 1; return d; }, ['Kachelzeilen der Übersicht']),
        mut('Browser fragt jeden Pi einzeln', d => { d.vals.arch = 'pi'; return d; }, ['Datenweg der Anzeige-App'])] },
    { id: 'vn8', lab: 'vb', cat: 'Werkstatt-Netz', title: 'Datensicherung und IT-Sicherheit', level: 3,
      on: 'vb',
      text: 'Sichere die Messdaten: wöchentlich ein Voll-Satz, an den anderen 6 Tagen inkrementell im Abstand aus dem Lastenheft, 4 Sätze werden aufbewahrt (A). Rechne mit dem Datenbestand nach einem Jahr (365 Tage deiner Datenmenge pro Tag) und mit dem täglichen Zuwachs als Inkrement, also 6 Tage je Satz (A). Trage ein: den höchsten Datenverlust (RPO) bei dem Sicherungsabstand aus dem Lastenheft, die Sicherungsläufe pro Woche, den Speicherbedarf der Sicherung in GB (dezimal), die Ausfallzeit pro Jahr bei der geforderten Verfügbarkeit (8 760 h) und die Rechte der Messdaten-Datei: Besitzer lesen und schreiben, Gruppe nur lesen, alle anderen nichts (A). Wie viele Kopien verlangt die 3-2-1-Regel insgesamt?',
      in: ['werknetz.eckdaten'], out: 'werknetz.sicherung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'its', id: 'its27', min: 70 }, { lab: 'its', id: 'its29', min: 70 }, { lab: 'lin', id: 'lin7', min: 70 }],
      form: [{ key: 'rpo', label: 'Höchster Datenverlust (RPO)', type: 'number', unit: 'h' }, { key: 'laeufe', label: 'Sicherungsläufe pro Woche', type: 'number' },
        { key: 'backup', label: 'Speicherbedarf der Sicherung (4 Sätze, dezimal)', type: 'number', unit: 'GB' }, { key: 'ausfall', label: 'Ausfallzeit pro Jahr', type: 'number', unit: 'h' },
        { key: 'rechte', label: 'Dateirechte der Messdaten-Datei (oktal)', type: 'select', options: SEL_RECHTE }, { key: 'regel', label: 'Kopien insgesamt nach der 3-2-1-Regel', type: 'select', options: SEL_REGEL }],
      hint: ['Der RPO ist der Abstand zwischen zwei Sicherungen. Läufe pro Woche = Läufe pro Tag · 7.', 'Ein Satz = Datenbestand nach einem Jahr + 6 Tage Zuwachs, alles in MB; mal 4 Sätze, dann durch 1000 für GB. Ausfallzeit = 8 760 h · (100 - Verfügbarkeit in %) ÷ 100.', 'Rechte oktal: Besitzer 4 + 2, Gruppe 4, andere 0. Die 3-2-1-Regel: 3 Kopien, 2 Medien, 1 außer Haus.'],
      check: safe(checkSich, 'Sicherung'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), s = sollSich(P, ownNum(ctx, 'werknetz.eckdaten', 'mb', sollEck(P).mb)); return { vals: { rpo: s.rpo, laeufe: s.laeufe, backup: Math.round(s.backup * 1e4) / 1e4, ausfall: Math.round(s.ausfall * 1e4) / 1e4, rechte: '640', regel: '3' }, tasks: tasksDone(STATIONS[7]) }; },
      mutants: [mut('Nur einen Satz gerechnet', d => { d.vals.backup = d.vals.backup / FACH.zyklen; return d; }, ['Speicherbedarf der Sicherung']),
        mut('Ausfallzeit aus der Verfügbarkeit statt dem Rest', (d, c) => { d.vals.ausfall = FACH.stunden * P_(c).verf / 100; return d; }, ['Ausfallzeit pro Jahr']),
        mut('Messdaten für alle lesbar und schreibbar', d => { d.vals.rechte = '777'; return d; }, ['Dateirechte der Messdaten-Datei']),
        mut('Nur zwei Kopien', d => { d.vals.regel = '2'; return d; }, ['Kopien nach der 3-2-1-Regel'])] }
  ];

  /* ---------- Gesamttest: Passt alles zusammen? ---------- */
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, level: level, tol: 1, slots: slots || {}, get: k => (slots || {})[k] };
    let lines, kpis;
    try {
      const hw = vals(slotOf(ctx, 'werknetz.hardware')), nz = vals(slotOf(ctx, 'werknetz.netz')), pi = vals(slotOf(ctx, 'werknetz.pi')), db = vals(slotOf(ctx, 'werknetz.db')), sc = vals(slotOf(ctx, 'werknetz.sicherung'));
      const s = sollEck(P), bed = bedarfGB(s.mb, P), ssd = numOf(hw.ssd), hb = numOf(hw.bedarf), zl = numOf(db.zeilen);
      const pM = numOf(nz.pMess), net = ipInt(typeof nz.netzMess === 'string' ? nz.netzMess : ''), last = ipInt(typeof pi.ipLast === 'string' ? pi.ipLast : '');
      const hostsOk = fin(pM) && pM >= 8 && pM <= 30 && Math.floor(pM) === pM && net !== null && last !== null && usable(pM) >= P.nMess + 1 && last >= net + 2 && last <= net + usable(pM) && last - net - 1 >= P.nMess;
      const bk = numOf(sc.backup), aus = numOf(sc.ausfall), sb = sollSich(P, s.mb);
      const fromRows = fin(zl) ? zl * 1e6 * FACH.recB / 1e9 * FACH.reserve + FACH.sysGB : NaN;
      lines = [
        L(fin(ssd) && ssd >= bed, 'Speicher: ' + (fin(ssd) ? (ssd >= bed ? 'die gewählte SSD fasst alle Messwerte der Aufbewahrungszeit' : 'die gewählte SSD ist für die Aufbewahrungszeit zu klein') : 'keine SSD gewählt'), 25),
        L(hostsOk, 'Messnetz: ' + (hostsOk ? 'alle Messplätze und das Gateway passen in das Netz, die Pi-Adressen liegen darin' : 'Netzplan und Pi-Adressen passen nicht zu den Messplätzen'), 20),
        L(fin(bk) && bk <= P.nasGB && bk >= 0.9 * sb.backup && sb.backup <= P.nasGB, 'Sicherung: ' + (fin(bk) ? (bk <= P.nasGB ? (bk >= 0.9 * sb.backup ? 'der Satz passt auf die Sicherungsplatte' : 'dein Bedarf ist zu knapp gerechnet') : 'der Satz passt nicht auf die Sicherungsplatte') : 'kein Wert'), 20),
        L(fin(aus) && aus <= P.maxAusfall && aus >= 0.9 * sb.ausfall, 'Verfügbarkeit: ' + (fin(aus) ? (aus <= P.maxAusfall ? (aus >= 0.9 * sb.ausfall ? 'die Ausfallzeit hält die Vorgabe ein' : 'die Ausfallzeit ist zu optimistisch gerechnet') : 'die Ausfallzeit überschreitet die Vorgabe') : 'kein Wert'), 15),
        L(fin(fromRows) && fin(hb) && Math.abs(fromRows - hb) <= 0.03 * hb, 'Durchgängigkeit: ' + (fin(fromRows) && fin(hb) ? (Math.abs(fromRows - hb) <= 0.03 * hb ? 'Zeilenzahl der Datenbank und Speicherbedarf des Servers gehören zusammen' : 'Zeilenzahl der Datenbank und Speicherbedarf des Servers passen nicht zusammen') : 'Werte fehlen'), 20)
      ];
      const p3 = numOf(hw.pSumme), kost = fin(p3) ? kostenOf(p3, P) : NaN;
      kpis = [
        { key: 'bedarf', label: 'Speicherbedarf', value: fin(hb) ? Math.round(hb * 10) / 10 : null, unit: 'GB', ok: fin(ssd) && ssd >= bed },
        { key: 'ssd', label: 'Gewählte SSD', value: fin(ssd) ? ssd : null, unit: 'GB', ok: fin(ssd) && ssd >= bed },
        { key: 'hosts', label: 'Nutzbare Adressen im Messnetz', value: fin(pM) && pM >= 8 && pM <= 30 ? usable(pM) : null, unit: '', ok: hostsOk },
        { key: 'backup', label: 'Sicherung (4 Sätze)', value: fin(bk) ? Math.round(bk * 10) / 10 : null, unit: 'GB', ok: fin(bk) && bk <= P.nasGB },
        { key: 'ausfall', label: 'Ausfallzeit pro Jahr', value: fin(aus) ? Math.round(aus * 10) / 10 : null, unit: 'h', ok: fin(aus) && aus <= P.maxAusfall },
        { key: 'kosten', label: 'Stromkosten pro Jahr', value: fin(kost) ? Math.round(kost * 100) / 100 : null, unit: 'EUR', ok: fin(kost) }
      ];
    } catch (e) {
      lines = [L(false, 'Gesamttest: Prüfung nicht möglich', 100)]; kpis = [];
    }
    return { lines: lines, kpis: kpis };
  }
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, slots: slots || {}, get: k => (slots || {})[k] };
    const g = (slot, key) => { const x = vals(slotOf(ctx, slot))[key]; return x == null || x === '' ? '-' : (typeof x === 'number' ? fm(x, 2) : String(x)); };
    return [
      { h: 'Eckdaten', rows: [['Messplätze', g('werknetz.eckdaten', 'nMess')], ['Messwerte pro Tag', g('werknetz.eckdaten', 'rec')], ['Datenmenge pro Tag (MB, dezimal)', g('werknetz.eckdaten', 'mb')], ['Datenmenge pro Tag (MiB, binär)', g('werknetz.eckdaten', 'mib')]] },
      { h: 'Server', rows: [['Speicherbedarf (GB)', g('werknetz.hardware', 'bedarf')], ['SSD (GB)', g('werknetz.hardware', 'ssd')], ['Anzeige im Betriebssystem (GiB)', g('werknetz.hardware', 'gib')], ['Leistung (W)', g('werknetz.hardware', 'pSumme')], ['Netzteil (W)', g('werknetz.hardware', 'psu')], ['Stromkosten pro Jahr (EUR)', g('werknetz.hardware', 'kosten')]] },
      { h: 'Netzplan', rows: [['Adressbedarf Messnetz', g('werknetz.netz', 'bedarf')], ['Präfixe Mess/Büro/Server', g('werknetz.netz', 'pMess') + ' / ' + g('werknetz.netz', 'pBuero') + ' / ' + g('werknetz.netz', 'pSrv')], ['Netzadresse Messnetz', g('werknetz.netz', 'netzMess')], ['Netzadresse Servernetz', g('werknetz.netz', 'netzSrv')]] },
      { h: 'Sammler und Datenbank', rows: [['Erster Pi', g('werknetz.pi', 'ipFirst')], ['Letzter Pi', g('werknetz.pi', 'ipLast')], ['Messwerte je Pi und Stunde', g('werknetz.pi', 'proStunde')], ['Zeilen am Ende (Mio.)', g('werknetz.db', 'zeilen')]] },
      { h: 'Auswertung, Anzeige und Sicherung', rows: [['Laufzeit ganze Tabelle (s)', g('werknetz.algo', 'laufzeit')], ['Kachelzeilen', g('werknetz.app', 'zeilen')], ['Abfragen pro Minute', g('werknetz.app', 'abfragen')], ['Sicherung (GB)', g('werknetz.sicherung', 'backup')], ['Ausfallzeit pro Jahr (h)', g('werknetz.sicherung', 'ausfall')]] }
    ];
  }

  const def = {
    id: PID, name: 'Werkstatt-Netz mit Messdaten-Server', icon: '🖧', prefix: 'vn', order: 11, beruf: ['fi'],
    story: 'In der Werkstatt der Tonfunk GmbH Ermsleben stehen viele Messplätze, und die Temperaturen werden bisher auf Zetteln notiert. Jetzt sollen alle Messwerte automatisch in einem Server landen. Du planst das ganze Netz: vom Lastenheft über Server, Subnetze und die Raspberry-Pi-Sammler bis zur Datenbank, der Auswertung, der Anzeige und der Datensicherung. Alle Zahlen reichst du von Station zu Station weiter, und am Ende muss alles zusammenpassen.',
    company: 'Tonfunk GmbH Ermsleben', labs: ['net', 'hwl', 'alg', 'sql', 'its', 'lin'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft, stations: STATIONS,
    final: { id: 'vnF', title: 'Abschlusstest: Das Werkstatt-Netz im Betrieb', check: finalCheck },
    kpis: ['bedarf', 'ssd', 'hosts', 'backup', 'ausfall', 'kosten'], report: reportParts,
    _test: { FACH: FACH, DB: DB, sollEck: sollEck, sollHw: sollHw, sollSich: sollSich, alloc: alloc, prefixFor: prefixFor, ipInt: ipInt, ipStr: ipStr, maskStr: maskStr, bedarfGB: bedarfGB, psuOf: psuOf, kostenOf: kostenOf, gibOf: gibOf, uGpio: uGpio, proStunde: proStunde, zeilenMio: zeilenMio, sollAlgo: sollAlgo, farbeOf: farbeOf, abfragen: abfragen, dbAvg3: dbAvg3, dbMax: dbMax, dbOver: dbOver, laufS: laufS, nasOf: nasOf }
  };
  /* Registrierung; die Schutzzeile meldet den Typ vb.form an, falls der Kern ihn noch nicht kennt (schadet später nicht) */
  const vForm = d => { const e = []; if (!isObj(d)) return ['Daten fehlen']; if (!isObj(d.vals) || Object.keys(d.vals).length > 80) e.push('vals fehlt'); if (d.tasks !== undefined && !(isObj(d.tasks) && Object.keys(d.tasks).every(k => fin(d.tasks[k])))) e.push('tasks muss Zahlen enthalten'); return e; };
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') { if (V.types().indexOf('vb.form') < 0) V.registerType('vb.form', { validate: vForm }); V.registerProject(def); }
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
})(typeof window !== 'undefined' ? window : globalThis);
