'use strict';
/* Tonfunk Touren-Lab: reine Rechenlogik (Kennung 'tou'). window.TOU_CORE bzw. module.exports.
   ALLE Zahlen (Entfernungen, Fahrzeuge, Kostensätze, Zeitfenster, Standzeiten) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Lenk- und Ruhezeiten nach EU-Verordnung 561/2006 (Grundregeln, ohne Sonderfälle).
   Themen: Touren bilden (Karte, Nächster Nachbar), Fahrzeug wählen, Ladereihenfolge, Zeitplanung, Kosten.
   Nicht hier (siehe wfllab/ladlab): Kommissionierung, Versandart, Frachtpapiere, Ladungssicherung.
   Konventionen: Strecken in km, Zeiten in Minuten (Uhrzeit = Minuten ab 0:00), Massen in kg, Maße in m.
   Ungültige Eingaben liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);
  const floorN = x => (fin(x) ? Math.floor(x + 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€\/km|€\/h|€|eur|euro|km\/h|km|kg|t|m³|m3|ldm|m|%|min|h|paletten|stellplätze|plätze|stück)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '-';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '-'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }
  /* Uhrzeit aus Minuten ab 0:00, z. B. 365 -> "06:05" */
  const hm = m => { if (!fin(m)) return '-'; m = Math.round(m); const h = Math.floor(m / 60) % 24, mi = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi; };
  /* Dauer aus Minuten, z. B. 135 -> "2 h 15 min" */
  const dauer = m => { if (!fin(m) || m < 0) return '-'; m = Math.round(m); const h = Math.floor(m / 60), mi = m % 60; return (h ? h + ' h' : '') + (h && mi ? ' ' : '') + (mi || !h ? mi + ' min' : ''); };

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Karte und Touren */
  /* Frei erfundene Kartenskizze: Lager L des Modellbetriebs und Kunden A bis H. x, y nur zum Zeichnen. */
  const ORTE = [
    { k: 'L', n: 'Lager', x: 200, y: 150 }, { k: 'A', n: 'Kunde A', x: 90, y: 60 }, { k: 'B', n: 'Kunde B', x: 210, y: 40 }, { k: 'C', n: 'Kunde C', x: 330, y: 70 },
    { k: 'D', n: 'Kunde D', x: 360, y: 170 }, { k: 'E', n: 'Kunde E', x: 300, y: 250 }, { k: 'F', n: 'Kunde F', x: 180, y: 270 }, { k: 'G', n: 'Kunde G', x: 60, y: 220 }, { k: 'H', n: 'Kunde H', x: 110, y: 140 }
  ];
  const KEYS = ORTE.map(o => o.k), KUNDEN_KEYS = KEYS.slice(1);
  /* Straßen mit Länge in km (Übungswerte) */
  const STRASSEN = [['L', 'H', 18], ['L', 'B', 22], ['L', 'C', 31], ['L', 'D', 32], ['L', 'E', 28], ['L', 'F', 24], ['H', 'A', 16], ['H', 'G', 19], ['A', 'B', 24], ['B', 'C', 25], ['C', 'D', 21], ['D', 'E', 20], ['E', 'F', 24], ['F', 'G', 26]];
  const idx = k => KEYS.indexOf(k);
  /* kürzeste Wege über das Straßennetz (Floyd-Warshall), einmal berechnet */
  const NETZ = (function () {
    const n = KEYS.length, D = [], NX = [];
    for (let i = 0; i < n; i++) { D.push([]); NX.push([]); for (let j = 0; j < n; j++) { D[i].push(i === j ? 0 : Infinity); NX[i].push(j); } }
    STRASSEN.forEach(([a, b, km]) => { const i = idx(a), j = idx(b); D[i][j] = D[j][i] = km; });
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][k] + D[k][j] < D[i][j]) { D[i][j] = D[i][k] + D[k][j]; NX[i][j] = NX[i][k]; }
    return { D, NX };
  })();
  const km = (a, b) => { const i = idx(a), j = idx(b); return i < 0 || j < 0 ? NAN : NETZ.D[i][j]; };
  /* Orte auf dem kürzesten Weg von a nach b (mit a und b) */
  function weg(a, b) {
    let i = idx(a); const j = idx(b); if (i < 0 || j < 0) return [];
    const out = [KEYS[i]]; while (i !== j) { i = NETZ.NX[i][j]; out.push(KEYS[i]); } return out;
  }
  const strasse = (a, b) => { const s = STRASSEN.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a)); return s ? s[2] : NAN; };
  const okOrder = o => Array.isArray(o) && o.every(k => KUNDEN_KEYS.includes(k)) && new Set(o).size === o.length;
  /* Rundtour: Lager, Kunden in Reihenfolge, zurück zum Lager */
  function tourKm(order) { if (!okOrder(order)) return NAN; let s = 0, cur = 'L'; order.concat(['L']).forEach(k => { s += km(cur, k); cur = k; }); return s; }
  function tourLegs(order) { if (!okOrder(order)) return []; let cur = 'L'; return order.concat(['L']).map(k => { const l = { von: cur, nach: k, km: km(cur, k) }; cur = k; return l; }); }
  /* Nächster-Nachbar-Verfahren auf einer Entfernungstabelle M (Index 0 = Lager); bei Gleichstand gewinnt der kleinere Index */
  function nnM(M) {
    if (!Array.isArray(M) || !M.length) return [];
    const n = M.length, used = new Set([0]), out = []; let cur = 0;
    while (out.length < n - 1) { let best = -1; for (let j = 1; j < n; j++) if (!used.has(j) && (best < 0 || M[cur][j] < M[cur][best])) best = j; used.add(best); out.push(best); cur = best; }
    return out;
  }
  /* kürzeste Reihenfolge durch Ausprobieren (höchstens 8 Orte) */
  function bestM(M) {
    const n = M.length - 1; if (n < 0 || n > 8) return { order: [], len: NAN };
    let best = Infinity, bo = []; const used = Array(n + 1).fill(false), cur = [];
    (function rec(last, len) {
      if (len >= best) return;
      if (cur.length === n) { const t = len + M[last][0]; if (t < best) { best = t; bo = cur.slice(); } return; }
      for (let j = 1; j <= n; j++) if (!used[j]) { used[j] = true; cur.push(j); rec(j, len + M[last][j]); cur.pop(); used[j] = false; }
    })(0, 0);
    return { order: bo, len: best };
  }
  /* Tabelle für eine Menge von Kunden aus der Karte (Index 0 = Lager) */
  const matrixOf = keys => { const all = ['L'].concat(keys); return all.map(a => all.map(b => km(a, b))); };
  function nearest(keys) { if (!okOrder(keys)) return []; return nnM(matrixOf(keys)).map(j => keys[j - 1]); }
  function bestTour(keys) { if (!okOrder(keys) || keys.length > 8) return { order: [], km: NAN }; const b = bestM(matrixOf(keys)); return { order: b.order.map(j => keys[j - 1]), km: b.len }; }

  /* ============================================================ Fahrzeuge */
  /* Europalette 1,2 m x 0,8 m. Stellplätze in diesem Lab: Paletten längs (1,2 m in Fahrtrichtung), nebeneinander so viele, wie in die Breite passen. */
  /* PRUEFEN P1: Stellplätze = abgerundet(Ladelänge / 1,2) · abgerundet(Ladebreite / 0,8), also nur "längs geladen". Sattelauflieger 13,6 m x 2,45 m ergibt 33. Radkästen, Quer-Beladung und gemischte Beladung (34 Paletten) bleiben außen vor. Reicht das? */
  const EURO = { l: 1.2, b: 0.8 };
  /* PRUEFEN P2: Fahrzeugdaten und Kostensätze sind frei gewählte Übungswerte (Transporter 3,5 t, Lkw 7,5 t, Lkw 12 t, Sattelzug 40 t). Passen die Größenordnungen für den Unterricht? */
  const FZG = [
    { k: 't35', n: 'Transporter 3,5 t', l: 3.4, b: 1.7, h: 1.9, zgg: 3500, leer: 2400, kmS: 0.35, hS: 32 },
    { k: 'l75', n: 'Lkw 7,5 t', l: 6.2, b: 2.45, h: 2.4, zgg: 7500, leer: 4700, kmS: 0.55, hS: 36 },
    { k: 'l12', n: 'Lkw 12 t', l: 7.3, b: 2.45, h: 2.5, zgg: 12000, leer: 6500, kmS: 0.7, hS: 38 },
    { k: 's40', n: 'Sattelzug 40 t', l: 13.6, b: 2.45, h: 2.7, zgg: 40000, leer: 15000, kmS: 1.1, hS: 42 }
  ];
  const fzgOf = k => FZG.find(f => f.k === k) || null;
  const stell = (l, b) => (num(l) > 0 && num(b) > 0 ? floorN(l / EURO.l) * floorN(b / EURO.b) : NAN);
  const nutzlast = (zgg, leer) => (num(zgg) > 0 && num(leer) >= 0 && leer <= zgg ? zgg - leer : NAN);
  const volumen = (l, b, h) => ([l, b, h].every(v => num(v) > 0) ? l * b * h : NAN);
  /* Lademeter: belegte Ladelänge bei voller Breite 2,4 m. Für Ladung: Länge · Breite / 2,4 */
  /* PRUEFEN P3: Lademeter = Länge · Breite / 2,4 je Packstück (nicht stapelbar), Europalette also 0,4 ldm. Gleiche Formel wie in euren Speditionsunterlagen? */
  const ldm = (l, b, n) => (num(l) > 0 && num(b) > 0 && num(n) >= 0 ? n * l * b / 2.4 : NAN);
  const ldmPal = n => ldm(EURO.l, EURO.b, n);
  const pct = (a, b) => (num(a) >= 0 && num(b) > 0 ? a / b * 100 : NAN);
  /* Ladung prüfen: Paletten und Masse gegen Stellplätze und Nutzlast */
  function ladung(f, pal, kg) {
    if (!f || !(num(pal) >= 0) || !(num(kg) >= 0)) return null;
    const sp = stell(f.l, f.b), nl = nutzlast(f.zgg, f.leer);
    return { stell: sp, nutz: nl, pal, kg, palPct: pct(pal, sp), kgPct: pct(kg, nl), okPal: pal <= sp, okKg: kg <= nl, ueberKg: Math.max(0, kg - nl), ueberPal: Math.max(0, pal - sp) };
  }
  /* kleinstes passendes Fahrzeug (Reihenfolge der Liste) */
  const passend = (pal, kg) => FZG.find(f => { const l = ladung(f, pal, kg); return l && l.okPal && l.okKg; }) || null;

  /* ============================================================ Ladereihenfolge */
  /* Last In First Out: wer zuletzt beliefert wird, wird zuerst (vorn an der Stirnwand) geladen; der erste Kunde steht an der Tür. */
  const ladeFolge = order => (Array.isArray(order) ? order.slice().reverse() : []);
  /* Paletten, die beim ersten Kunden im Weg stehen, wenn in Tourreihenfolge (falsch) geladen wurde: alle anderen */
  const umsetzen = (palJe) => (Array.isArray(palJe) && palJe.length && palJe.every(v => num(v) >= 0) ? palJe.slice(1).reduce((a, v) => a + v, 0) : NAN);

  /* ============================================================ Zeit, Lenk- und Ruhezeiten */
  const fahrMin = (kmV, v) => (num(kmV) >= 0 && num(v) > 0 ? kmV / v * 60 : NAN);
  /* EU-Verordnung 561/2006 (Grundregeln) */
  const REGEL = { block: 270, pause: 45, teil1: 15, teil2: 30, tag: 540, tag10: 600, tag10max: 2, woche: 3360, doppel: 5400, ruhe: 660, ruheRed: 540 };
  /* Mindestpausen (Minuten) bei einer Lenkzeit von T Minuten an einem Stück geplant: nach je 4,5 h Lenkzeit 45 min */
  const pauseMin = T => (num(T) >= 0 ? Math.max(0, ceilN(T / REGEL.block) - 1) * REGEL.pause : NAN);
  /* Aufteilung der Pause: erst mindestens 15 min, dann mindestens 30 min */
  const teilOk = (a, b) => num(a) >= REGEL.teil1 && num(b) >= REGEL.teil2;
  /* Woche prüfen: Tageslenkzeiten in Minuten, Vorwoche in Minuten */
  function wocheCheck(tage, vor) {
    if (!Array.isArray(tage) || !tage.every(v => num(v) >= 0) || !(num(vor) >= 0)) return null;
    const sum = tage.reduce((a, v) => a + v, 0), n10 = tage.filter(v => v > REGEL.tag).length, zuLang = tage.filter(v => v > REGEL.tag10).length;
    const v = [];
    if (zuLang) v.push(zuLang + ' Tag(e) über 10 h Lenkzeit');
    if (n10 > REGEL.tag10max) v.push(n10 + ' Tage über 9 h, erlaubt sind höchstens 2 Tage mit bis zu 10 h');
    if (sum > REGEL.woche) v.push('Wochenlenkzeit über 56 h');
    if (sum + vor > REGEL.doppel) v.push('Doppelwoche über 90 h');
    return { sum, n10, dop: sum + vor, rest: Math.max(0, Math.min(REGEL.woche - sum, REGEL.doppel - vor - sum)), verst: v, ok: !v.length };
  }

  /* ============================================================ Kunden des Übungstags und Tourenplaner */
  /* PRUEFEN P4: Kundendaten (Paletten, Gewicht je Palette, Zeitfenster) und die Standzeit (10 min je Halt plus 5 min je Palette) sind Übungswerte. Realistisch für eure Touren? */
  const KUNDEN = {
    A: { pal: 2, kgPal: 350, von: 480, bis: 600 }, B: { pal: 3, kgPal: 400, von: 420, bis: 720 }, C: { pal: 1, kgPal: 250, von: 540, bis: 660 }, D: { pal: 4, kgPal: 500, von: 600, bis: 840 },
    E: { pal: 2, kgPal: 300, von: 360, bis: 540 }, F: { pal: 3, kgPal: 450, von: 660, bis: 900 }, G: { pal: 1, kgPal: 200, von: 480, bis: 960 }, H: { pal: 2, kgPal: 380, von: 420, bis: 570 }
  };
  const standMin = (pal, grund, jePal) => (num(pal) >= 0 && num(grund) >= 0 && num(jePal) >= 0 ? grund + jePal * pal : NAN);
  /* Tour durchrechnen. o = { order, fz (Kennung), start (min), v (km/h), grund, jePal, ext10 (bool) }
     Pausen: Sobald 4,5 h Lenkzeit am Stück erreicht sind, wird unterwegs eine Pause von 45 min eingeplant. Standzeit beim Kunden ist Arbeitszeit und zählt NICHT als Pause. */
  /* PRUEFEN P5: Der Planer plant die Pause genau bei 4,5 h Lenkzeit ein (unterwegs) und wertet Warte- und Entladezeiten nicht als Fahrtunterbrechung. Ist das als Vereinfachung in Ordnung? Arbeitszeitgesetz (Pausen nach 6 h Arbeitszeit) wird nicht geprüft. */
  function planTour(o) {
    const f = fzgOf(o && o.fz);
    if (!o || !okOrder(o.order) || !f || !(num(o.start) >= 0) || !(num(o.v) > 0) || !(num(o.grund) >= 0) || !(num(o.jePal) >= 0)) return null;
    let t = o.start, block = 0, lenk = 0, pausen = 0, warten = 0, stand = 0; const ev = [], stops = [];
    const fahre = (min, von, nach) => {
      let rest = Math.round(min);
      while (block + rest > REGEL.block) { const teil = REGEL.block - block; if (teil > 0) { ev.push({ art: 'fahrt', von: t, bis: t + teil, txt: von + ' → ' + nach }); t += teil; lenk += teil; rest -= teil; } ev.push({ art: 'pause', von: t, bis: t + REGEL.pause, txt: 'Pause 45 min' }); t += REGEL.pause; pausen += REGEL.pause; block = 0; }
      if (rest > 0) { ev.push({ art: 'fahrt', von: t, bis: t + rest, txt: von + ' → ' + nach }); t += rest; lenk += rest; block += rest; }
    };
    let cur = 'L', pal = 0, kg = 0;
    o.order.forEach((k, i) => {
      const K = KUNDEN[k], d = km(cur, k); fahre(fahrMin(d, o.v), cur, k);
      const an = t; let w = 0; if (an < K.von) { w = K.von - an; ev.push({ art: 'warten', von: t, bis: K.von, txt: 'Warten bei ' + k }); t = K.von; warten += w; }
      const sm = standMin(K.pal, o.grund, o.jePal); ev.push({ art: 'stand', von: t, bis: t + sm, txt: 'Entladen bei ' + k }); t += sm; stand += sm;
      stops.push({ k, nr: i + 1, km: d, an, warten: w, ab: t, von: K.von, bis: K.bis, spaet: an > K.bis, pal: K.pal, kg: K.pal * K.kgPal });
      pal += K.pal; kg += K.pal * K.kgPal; cur = k;
    });
    fahre(fahrMin(km(cur, 'L'), o.v), cur, 'L');
    const ende = t, einsatz = ende - o.start, kmT = tourKm(o.order), lad = ladung(f, pal, kg);
    const kosten = kmT * f.kmS + einsatz / 60 * f.hS;
    const verst = [];
    if (!lad.okPal) verst.push({ k: 'pal', t: 'Zu viele Paletten: ' + pal + ' Paletten, aber nur ' + lad.stell + ' Stellplätze' });
    if (!lad.okKg) verst.push({ k: 'kg', t: 'Überladen: ' + fmtN(kg, 0, true) + ' kg Ladung, Nutzlast nur ' + fmtN(lad.nutz, 0, true) + ' kg' });
    stops.filter(s => s.spaet).forEach(s => verst.push({ k: 'zeit', t: 'Zeitfenster bei Kunde ' + s.k + ' verpasst: Ankunft ' + hm(s.an) + ', Zeitfenster bis ' + hm(s.bis) }));
    const grenze = o.ext10 ? REGEL.tag10 : REGEL.tag;
    if (lenk > grenze) verst.push({ k: 'lenk', t: 'Tageslenkzeit ' + dauer(lenk) + ' ist länger als ' + (o.ext10 ? '10 h' : '9 h') });
    return { f, km: kmT, start: o.start, ende, einsatz, lenk, pausen, warten, stand, pal, kg, lad, kosten, jePal: pal > 0 ? kosten / pal : NAN, stops, ev, verst, lade: ladeFolge(o.order) };
  }

  /* ============================================================ Kosten */
  /* PRUEFEN P6: Kostenmodell nur mit zwei Sätzen (Kilometersatz für fahrleistungsabhängige Kosten, Stundensatz für zeitabhängige Kosten inkl. Fahrerlohn). Fixkosten, Maut und Gewinnzuschlag bleiben außen vor. Reicht das für LF 7? */
  const kmKosten = (k, s) => (num(k) >= 0 && num(s) >= 0 ? k * s : NAN);
  const zeitKosten = (h, s) => (num(h) >= 0 && num(s) >= 0 ? h * s : NAN);
  const tourKosten = (k, ks, h, hs) => { const a = kmKosten(k, ks), b = zeitKosten(h, hs); return fin(a) && fin(b) ? a + b : NAN; };
  const jePalette = (kost, pal) => (num(kost) >= 0 && num(pal) > 0 ? kost / pal : NAN);
  const spedKosten = (pal, preis) => (num(pal) >= 0 && num(preis) >= 0 ? pal * preis : NAN);
  /* ab wie vielen Paletten ist die eigene Tour günstiger als der Spediteur (eigene Tour kostet fest kost) */
  const abPaletten = (kost, preis) => (num(kost) >= 0 && num(preis) > 0 ? floorN(kost / preis) + 1 : NAN);
  const leerAnteil = (leer, ges) => pct(leer, ges);

  const API = { parseDe, fmtDe, fmtN, hm, dauer, rd, num, ceilN, floorN, hashStr, rng, ri, pick, shuffle,
    ORTE, KEYS, KUNDEN_KEYS, STRASSEN, km, weg, strasse, okOrder, tourKm, tourLegs, nnM, bestM, matrixOf, nearest, bestTour,
    EURO, FZG, fzgOf, stell, nutzlast, volumen, ldm, ldmPal, pct, ladung, passend, ladeFolge, umsetzen,
    fahrMin, REGEL, pauseMin, teilOk, wocheCheck, KUNDEN, standMin, planTour,
    kmKosten, zeitKosten, tourKosten, jePalette, spedKosten, abPaletten, leerAnteil };
  root.TOU_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
