'use strict';
/* Tonfunk EMS-Lab: Rechenkern (Namensraum EMS_CORE). Kein DOM, in Node testbar (quelle/ems/test_ems.js).
   Rechner der Reiter: Ausbeute (Fertigung), Prüfkosten (Prüfen), MSL-Uhr (Material), Zehnerregel (Qualität), Rückverfolgung (Daten),
   Drehmoment (Montage), Kalkulation (Kunde). Dazu Zahlen lesen und schreiben, Antworten prüfen. Alle Zahlen sind Lernwerte, keine Betriebswerte. */
(function (root) {
  /* ---------- Zahlen ---------- */
  function fmt(v, d) {
    if (!Number.isFinite(v)) return '?';
    const s = v.toFixed(d == null ? 2 : d).replace('.', ','), [g, n] = s.split(',');
    return g.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (n && !/^0+$/.test(n) ? ',' + n.replace(/0+$/, '') : '');
  }
  function parseDe(s) {
    let t = String(s == null ? '' : s).trim().replace(/\s|€|%/g, '').replace(/[A-Za-zÄÖÜäöüß]+$/, '');   // Einheit am Ende (h, Stück, Nm) weglassen
    if (!t) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');   // 1.250,5 = Tausenderpunkte
    return Number(t.replace(',', '.'));
  }

  /* ---------- Rechner ---------- */
  /* Ausbeute im ersten Durchlauf (First Pass Yield): Produkt der Stufen-Ausbeuten (0..1) */
  const fpy = ys => ys.reduce((p, y) => p * y, 1);
  /* Prüfkosten: ICT mit Adapter gegen Flying-Probe ohne Adapter. Gleichstand bei n = Adapter / (fp - ict) */
  function pruefKosten(p) {
    const ict = p.adapter + p.n * p.ict, fp = p.n * p.fp, d = p.fp - p.ict;
    return { ict, fp, gleich: d > 0 ? p.adapter / d : Infinity, besser: ict < fp ? 'ict' : 'fp' };
  }
  /* MSL-Klasse nach J-STD-020, Bodenlebensdauer nach J-STD-033 (höchstens 30 °C und 60 % rF, MSL 1 bis 85 % rF):Bodenlebensdauer in Stunden, Infinity = unbegrenzt, 0 = vor Gebrauch backen */
  const MSL = [['1', Infinity], ['2', 365 * 24], ['2a', 4 * 7 * 24], ['3', 168], ['4', 72], ['5', 48], ['5a', 24], ['6', 0]];
  function mslRest(level, offen) {
    const e = MSL.find(m => m[0] === String(level)); if (!e) return null;
    const rest = e[1] - offen;
    return { leben: e[1], rest: Math.max(0, rest), ok: e[1] > 0 && rest > 0 };
  }
  /* Zehnerregel: Kosten eines Fehlers je Stufe, basis = Kosten in der ersten Stufe */
  const STUFEN = ['Wareneingang', 'Fertigung', 'Endprüfung', 'Beim Kunden'];
  const zehner = (stufe, basis) => basis * Math.pow(10, stufe);
  /* Rückverfolgung: Lernbeispiel mit sechs Baugruppen und den Losen ihrer Bauteile */
  const RUECK = [
    { sn: 'SN-1001', los: { kond: 'K-17', ic: 'I-04' } }, { sn: 'SN-1002', los: { kond: 'K-17', ic: 'I-04' } },
    { sn: 'SN-1003', los: { kond: 'K-18', ic: 'I-04' } }, { sn: 'SN-1004', los: { kond: 'K-18', ic: 'I-05' } },
    { sn: 'SN-1005', los: { kond: 'K-18', ic: 'I-05' } }, { sn: 'SN-1006', los: { kond: 'K-19', ic: 'I-05' } }];
  const betroffen = (teil, los) => RUECK.filter(r => r.los[teil] === los).map(r => r.sn);
  /* Drehmoment M = F * r (Nm = N * m) */
  const moment = (F, r) => F * r;
  /* Kalkulation je Baugruppe und Angebot mit Zuschlag (zuschlag in Prozent) */
  function kalk(p) {
    const k = p.material + p.punkte * p.preisPunkt + p.loet * p.preisLoet + p.pruefMin * p.minSatz + p.ruest / p.los;
    return { kosten: k, angebot: k * (1 + p.zuschlag / 100) };
  }

  /* ---------- Antworten prüfen ----------
     mc: correct = Index oder Index-Liste (Mehrfachauswahl); ans.s = gewählte Indizes. num: answer, tol (relativ); ans.v = Eingabe */
  function pruefe(t, a) {
    if (t.kind === 'num') {
      const v = parseDe(a.v); if (!Number.isFinite(v)) return null;
      return { ok: Math.abs(v - t.answer) <= Math.abs(t.answer) * (t.tol || 0.01) + 1e-9, given: fmt(v, 3) + (t.unit ? ' ' + t.unit : '') };
    }
    const s = (a.s || []).slice().sort((x, y) => x - y); if (!s.length) return null;
    const c = [].concat(t.correct).sort((x, y) => x - y);
    return { ok: s.length === c.length && s.every((x, i) => x === c[i]), given: s.map(i => t.choices[i]).join(' | ') };
  }
  /* feste Reihenfolge der Antworten je Aufgabe (gleich bei jedem Öffnen, nicht immer die richtige zuerst) */
  function reihe(t) {
    let h = 0x811c9dc5; for (let i = 0; i < t.id.length; i++) { h ^= t.id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    const idx = t.choices.map((c, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; const j = h % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx;
  }

  root.EMS_CORE = { fmt, parseDe, fpy, pruefKosten, MSL, mslRest, STUFEN, zehner, RUECK, betroffen, moment, kalk, pruefe, reihe };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.EMS_CORE;
})(typeof window !== 'undefined' ? window : globalThis);
