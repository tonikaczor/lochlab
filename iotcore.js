'use strict';
/* Tonfunk Industrie-4.0-Lab: reine Rechenlogik (Kennung 'iot'). window.IOT_CORE bzw. module.exports.
   ALLE Zahlen (Intervalle, Bytes, Sensorzahlen, Grenzwerte, Laufzeiten) sind ÜBUNGSWERTE für die Ausbildung. Keine Produkt- oder Anbieternamen.
   Themen: Datenmengen der IoT-Kette (Abtastintervall, Bytes, Sensoren, Bandbreite, Speicher), MQTT (Topics, Platzhalter, Broker mit Retain),
   Zustandsüberwachung (Verlauf, Grenzwert, Trend, Restzeit).
   Datenmengen dezimal: 1 kB = 1.000 Byte, 1 MB = 1.000.000 Byte, 1 GB = 1.000.000.000 Byte.
   Fachannahmen stehen als PRUEFEN-Kommentare im Code und gesammelt in quelle/iot/PRUEFEN.md.
   Ungültige Eingaben (Division durch 0, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);
  const floorN = x => (fin(x) ? Math.floor(x + 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(kbit\/s|Mbit\/s|bit\/s|Byte|MB|GB|kB|Werte|Register|Abfragen|Abonnenten|Topics|Tage|Tagen|Tag|ms|s|%|°C|mm\/s|bar)$/i, '');
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
  /* Datenmenge in Byte als Text mit passender Einheit (dezimal) */
  function fmtBytes(b) {
    if (!fin(b) || b < 0) return '-';
    const U = ['Byte', 'kB', 'MB', 'GB', 'TB']; let i = 0, v = b;
    while (v >= 1000 && i < U.length - 1) { v /= 1000; i++; }
    return fmtN(v, v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2, true) + ' ' + U[i];
  }
  /* Datenrate in bit/s als Text mit passender Einheit */
  function fmtRate(bits) {
    if (!fin(bits) || bits < 0) return '-';
    if (bits < 1000) return fmtN(bits, bits < 10 ? 2 : 1, true) + ' bit/s';
    if (bits < 1e6) return fmtN(bits / 1e3, 2, true) + ' kbit/s';
    return fmtN(bits / 1e6, 2, true) + ' Mbit/s';
  }

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Datenmengen */
  const DAY = 86400;
  /* Werte je Tag: n Sensoren, je einer alle t Sekunden */
  const valuesPerDay = (t, n) => (num(t) > 0 && num(n) >= 0 ? n * DAY / t : NAN);
  /* Byte je Tag bei b Byte je Wert */
  const bytesPerDay = (t, b, n) => (num(t) > 0 && num(b) >= 0 && num(n) >= 0 ? n * DAY / t * b : NAN);
  /* mittlere Datenrate in bit/s */
  const bitRate = (t, b, n) => (num(t) > 0 && num(b) >= 0 && num(n) >= 0 ? n * b * 8 / t : NAN);
  /* Anteil der Nutzdaten an der übertragenen Menge in Prozent (b Byte Nutzdaten, h Byte Kopf und Topic je Nachricht) */
  const payloadShare = (b, h) => (num(b) > 0 && num(h) >= 0 ? b / (b + h) * 100 : NAN);
  /* wie viele volle Tage passen auf einen Speicher (cap und perDay in Byte) */
  const daysFit = (cap, perDay) => (num(cap) >= 0 && num(perDay) > 0 ? floorN(cap / perDay) : NAN);
  /* Mittelung über k Werte spart so viel Prozent der Nachrichten */
  const savedShare = k => (num(k) >= 1 ? (1 - 1 / k) * 100 : NAN);
  /* Kette Sensor bis Cloud. p: t Intervall in s, n Sensoren, b Byte je Wert, h Byte Kopf je Nachricht zur Cloud, av Werte je Mittelwert im Gateway.
     Vor dem Gateway laufen alle Rohwerte (nur Nutzdaten, lokales Netz), danach je Sensor ein Wert je av Messungen mit Kopf. */
  function chain(p) {
    if (!(num(p.t) > 0 && num(p.n) >= 1 && num(p.b) > 0 && num(p.h) >= 0 && num(p.av) >= 1)) return null;
    const out = { t: p.t, n: p.n, b: p.b, h: p.h, av: p.av };
    out.rawMsgS = p.n / p.t; out.rawDay = valuesPerDay(p.t, p.n); out.rawBytesDay = bytesPerDay(p.t, p.b, p.n); out.rawBits = bitRate(p.t, p.b, p.n);
    out.outMsgS = p.n / (p.t * p.av); out.outMsgDay = valuesPerDay(p.t * p.av, p.n);
    out.outBytesDay = bytesPerDay(p.t * p.av, p.b + p.h, p.n); out.outBits = bitRate(p.t * p.av, p.b + p.h, p.n);
    out.share = payloadShare(p.b, p.h); out.saved = savedShare(p.av);
    out.store30 = out.outBytesDay * 30; out.store365 = out.outBytesDay * 365;
    return out;
  }

  /* ============================================================ MQTT */
  /* PRUEFEN P1: Übungsregeln für Topics: keine leeren Ebenen, keine Leerzeichen, höchstens 200 Zeichen. In MQTT selbst sind leere Ebenen erlaubt, in der Praxis aber unüblich. */
  const levels = s => String(s).split('/');
  const validTopic = t => typeof t === 'string' && t.length > 0 && t.length <= 200 && !/[+#\s]/.test(t) && levels(t).every(x => x.length > 0);
  /* Filter: Ebene ist ein Name, ein einzelnes + (genau eine Ebene) oder ein # (nur als letzte Ebene, beliebig viele Ebenen) */
  function validFilter(f) {
    if (typeof f !== 'string' || !f.length || f.length > 200 || /\s/.test(f)) return false;
    const p = levels(f); return p.every((x, i) => x.length > 0 && (x === '#' ? i === p.length - 1 : x === '+' || !/[+#]/.test(x)));
  }
  function match(filter, topic) {
    if (!validFilter(filter) || !validTopic(topic)) return false;
    const fl = levels(filter), tl = levels(topic);
    for (let i = 0; i < fl.length; i++) {
      if (fl[i] === '#') return true;
      if (i >= tl.length) return false;
      if (fl[i] !== '+' && fl[i] !== tl[i]) return false;
    }
    return fl.length === tl.length;
  }
  const receivers = (subs, topic) => subs.map((s, i) => (match(s.f, topic) ? i : -1)).filter(i => i >= 0);
  /* Broker: m = { topic, payload, qos, retain }. Liefert die Nummern der Abonnenten und den neuen Retain-Speicher (leere Nachricht mit Retain löscht). */
  function publish(retained, subs, m) {
    if (!m || !validTopic(m.topic)) return null;
    const r = Object.assign({}, retained);
    if (m.retain) { if (m.payload === '') delete r[m.topic]; else r[m.topic] = { payload: m.payload, qos: m.qos }; }
    return { to: receivers(subs, m.topic), retained: r };
  }
  /* zurückgehaltene Nachrichten, die ein neuer Filter sofort bekommt */
  const retainedFor = (retained, filter) => Object.keys(retained).filter(t => match(filter, t)).sort().map(t => ({ topic: t, payload: retained[t].payload, qos: retained[t].qos }));
  const PORTS = { mqtt: 1883, mqtts: 8883, modbus: 502, opcua: 4840 };

  /* ============================================================ Zustandsüberwachung */
  /* PRUEFEN P2: Verläufe sind erfundene Übungskurven: gesunder Zustand mit Rauschen und einem Ausreißer, danach beschleunigter Anstieg (quadratisch). Keine Grenzwerte aus Normen. */
  const DAYS = 60, TREND_W = 10;
  const KINDS = {
    temp: { k: 'temp', name: 'Lagertemperatur', unit: '°C', lo: 40, hi: 100, base: 52, noise: 1.2, rise: 36, spike: 9, limit: 75, lmin: 55, lmax: 95, step: 1, dec: 0 },
    vib: { k: 'vib', name: 'Schwingung (Effektivwert)', unit: 'mm/s', lo: 0, hi: 10, base: 2, noise: 0.25, rise: 6, spike: 2.2, limit: 5, lmin: 2.5, lmax: 9, step: 0.5, dec: 1 }
  };
  function series(kind, seed) {
    const K = KINDS[kind]; if (!K) return [];
    const R = rng('iot-zu-' + kind + '-' + seed), d0 = ri(R, 22, 30), sp = ri(R, 8, 18), out = [];
    for (let i = 0; i < DAYS; i++) {
      let v = K.base + (R() * 2 - 1) * K.noise;
      if (i === sp) v += K.spike;
      if (i > d0) v += K.rise * Math.pow((i - d0) / (DAYS - 1 - d0), 1.5);
      out.push(rd(v, 2));
    }
    return out;
  }
  /* erster Tag, an dem k Werte in Folge die Grenze erreicht oder überschritten haben (die Meldung kommt am k-ten Tag), sonst -1 */
  function firstAlarm(vals, limit, k, upto) {
    if (!Array.isArray(vals) || !(num(limit) >= 0) || !(num(k) >= 1)) return -1;
    let run = 0; const end = upto == null ? vals.length - 1 : Math.min(upto, vals.length - 1);
    for (let i = 0; i <= end; i++) { run = vals[i] >= limit ? run + 1 : 0; if (run >= k) return i; }
    return -1;
  }
  /* Tage bis zur Grenze bei gleichbleibendem Anstieg je Tag */
  const daysToLimit = (now, slope, limit) => (num(now) >= 0 && num(slope) > 0 && num(limit) >= 0 && now < limit ? (limit - now) / slope : NAN);
  /* Trend: Ausgleichsgerade durch die letzten TREND_W Werte bis zum Tag upto; fit = Wert der Geraden am Tag upto */
  function trend(vals, upto, limit) {
    if (!Array.isArray(vals) || !Number.isInteger(upto) || upto < TREND_W - 1 || upto >= vals.length) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = upto - TREND_W + 1; i <= upto; i++) { sx += i; sy += vals[i]; sxx += i * i; sxy += i * vals[i]; }
    const n = TREND_W, b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n, fit = a + b * upto;
    return { slope: b, fit, days: daysToLimit(fit, b, limit) };
  }
  /* Stand am Tag day: aktueller Wert, erster Meldetag (-1 = keine Meldung) und Trend (oder null in den ersten Tagen) */
  const zustand = (vals, day, limit, k) => ({ now: vals[day], alarmDay: firstAlarm(vals, limit, k, day), tr: trend(vals, day, limit) });

  const API = { parseDe, fmtDe, fmtN, fmtBytes, fmtRate, rd, num, ceilN, floorN, hashStr, rng, ri, pick, shuffle,
    DAY, valuesPerDay, bytesPerDay, bitRate, payloadShare, daysFit, savedShare, chain,
    validTopic, validFilter, match, receivers, publish, retainedFor, PORTS,
    DAYS, TREND_W, KINDS, series, firstAlarm, daysToLimit, trend, zustand };
  root.IOT_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
