'use strict';
/* Tonfunk Linien-Lab: reine Rechenlogik (Kennung 'fli', Stufe 'studium'). window.FLI_CORE bzw. module.exports.
   Das Lab arbeitet mit der frei erfundenen Modell-Linie "Linie A" (neun Stationen) aus pcbfehler.js (PCB_FEHLER): Stationen, Ausbeute-Rechnung,
   Hebel und Rückverfolgungsdaten werden von dort genutzt und hier nicht noch einmal geschrieben.
   WICHTIG zum Datenschutz: Linie A ist ein Lernmodell. Alle Zahlen sind Übungswerte, keine Werte eines Betriebs. Es kommen keine Namen von Firmen,
   Personen, Kunden, Produkten oder Maschinen vor. Grenzwerte und Rezepte stehen immer in der jeweiligen Prüfanweisung und werden hier nicht genannt.
   Lernmodell der Linie (vereinfacht, siehe Reiter Hilfe):
     - Jede aktive Station i hat die Taktzeit t_i (Sekunden je Stück) und die Ausbeute y_i im ersten Durchlauf (Anteil 0 bis 1).
     - Stücke, die eine Station im ersten Durchlauf nicht bestehen, verlassen den Fluss (Ausschuss oder Nacharbeit außerhalb der Linie).
     - Kapazität c_i = 3600 / t_i Stück je Stunde. In Station i kommen nur die Stücke an, die alle Stationen davor bestanden haben: K_(i-1) = Produkt der y davor.
     - Start-Rate r0 = kleinster Wert von c_i / K_(i-1). Die Station mit diesem Wert ist der Engpass. Gutstücke je Stunde = r0 mal Gesamtausbeute (RTY).
     - Puffer P vor dem Engpass: Durchlaufzeit = Summe der Taktzeiten + P mal Taktzeit des Engpasses. Bestand = Durchsatz mal Durchlaufzeit (Little).
   Aufgaben-Lösungen entstehen in solve(); der Test rechnet sie mit eigenen Formeln unabhängig nach (quelle/fli/test_flicore.js). */
(function (root) {
  const PF = root.PCB_FEHLER || (typeof require === 'function' ? require('./pcbfehler.js') : null);
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/−/g, '-');
    const m = /^([+-]?)(\d[\d.]*(?:,\d+)?|,\d+)((?:[eE][+-]?\d+)?)[A-Za-zµΩ%°/²€]*$/.exec(s);
    if (!m) return NAN;
    let n = m[2];
    /* Tausenderpunkt nur bei mind. zwei Punktgruppen oder zusätzlichem Komma; ein einzelner Punkt ist das Dezimalzeichen (66.362 = 66,362) */
    if (/^\d{1,3}(\.\d{3}){2,}(,\d+)?$/.test(n) || /^\d{1,3}(\.\d{3})+,\d+$/.test(n)) n = n.replace(/\./g, '');
    n = n.replace(',', '.');
    if (!/^\d+(\.\d+)?$|^\.\d+$/.test(n)) return NAN;
    const v = parseFloat(m[1] + n + m[3]);
    return fin(v) ? v : NAN;
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    s = (neg ? '−' : '') + i + (f ? ',' + f : '');
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }

  /* ---------- Stationen und Voreinstellung ---------- */
  const STATIONEN = PF.STATIONEN;
  const ST = {}; STATIONEN.forEach(s => { ST[s.id] = s; });
  const INNEN = PF.UEBUNG_AUSBEUTE.map(x => x.id);   // die sieben Stationen mit Ausbeute (Wareneingang und Versand: Ausbeute fest 100 Prozent)
  /* Taktzeiten in Sekunden je Stück (Übungswerte) */
  const TAKT0 = { we: 20, druck: 32, best: 38, reflow: 30, pruef: 44, lack: 46, verguss: 36, end: 40, versand: 22 };
  const AUSSCHUSS0 = {}; PF.UEBUNG_AUSBEUTE.forEach(x => { AUSSCHUSS0[x.id] = rd((1 - x.y) * 100, 1); });   // in Prozent
  const LIMITS = { takt: [10, 90], ausschuss: [0, 10], puffer: [0, 30], stoer: [0, 60] };
  function defaults() { return { takt: Object.assign({}, TAKT0), ausschuss: Object.assign({}, AUSSCHUSS0), verguss: true, puffer: 6, stoer: 0, stoerSt: 'druck' }; }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, fin(+v) ? +v : a));
  function normiere(p) {
    const d = defaults(); p = p || {};
    STATIONEN.forEach(s => { d.takt[s.id] = clamp(p.takt && p.takt[s.id] != null ? p.takt[s.id] : d.takt[s.id], LIMITS.takt[0], LIMITS.takt[1]); });
    INNEN.forEach(id => { d.ausschuss[id] = clamp(p.ausschuss && p.ausschuss[id] != null ? p.ausschuss[id] : d.ausschuss[id], LIMITS.ausschuss[0], LIMITS.ausschuss[1]); });
    d.verguss = p.verguss !== false; d.puffer = Math.round(clamp(p.puffer == null ? d.puffer : p.puffer, LIMITS.puffer[0], LIMITS.puffer[1]));
    d.stoer = clamp(p.stoer == null ? 0 : p.stoer, LIMITS.stoer[0], LIMITS.stoer[1]); d.stoerSt = ST[p.stoerSt] ? p.stoerSt : 'druck';
    return d;
  }

  /* ---------- Linie berechnen ---------- */
  /* st: [{ id, t (s), y (0..1), aus (true = nicht durchlaufen) }], opt: { puffer, stoerMin, stoerId } */
  function linie(st, opt) {
    opt = opt || {};
    const akt = (st || []).filter(s => !s.aus && s.t > 0);
    let K = 1; const zeilen = [];
    akt.forEach(s => {
      const y = Math.max(0, Math.min(1, s.y == null ? 1 : s.y)), cap = 3600 / s.t, lim = y >= 0 ? cap / Math.max(K, 1e-12) : 0;
      zeilen.push({ id: s.id, t: s.t, y, cap, kvor: K, grenze: lim });
      K *= y;
    });
    const rty = K;
    let eng = null; zeilen.forEach(z => { if (!eng || z.grenze < eng.grenze - 1e-9) eng = z; });
    const r0 = eng ? eng.grenze : 0;
    zeilen.forEach(z => { z.zufluss = r0 * z.kvor; z.auslastung = z.cap > 0 ? z.zufluss / z.cap : 0; });
    const summe = akt.reduce((a, s) => a + s.t, 0), tEng = eng ? eng.t : 0, P = Math.max(0, opt.puffer || 0);
    const dlz = summe + P * tEng;                      // Sekunden
    const out = { zeilen, engpass: eng ? eng.id : null, startRate: r0, gutRate: r0 * rty, rty, dlzSek: dlz, bestand: r0 / 3600 * dlz, summeTakt: summe, tEngpass: tEng, puffer: P, stoerung: null };
    if (eng && opt.stoerId && opt.stoerMin > 0) {
      const idx = zeilen.findIndex(z => z.id === opt.stoerId), ie = zeilen.findIndex(z => z.id === eng.id);
      const reichw = P * tEng, verlustS = Math.max(0, opt.stoerMin * 60 - reichw), stuecke = tEng > 0 ? verlustS / tEng : 0;
      out.stoerung = { vorEngpass: idx >= 0 && idx < ie, reichweiteS: reichw, verlustS: idx >= 0 && idx < ie ? verlustS : opt.stoerMin * 60, stueckeEngpass: idx >= 0 && idx < ie ? stuecke : opt.stoerMin * 60 / Math.max(tEng, 1e-9), gutVerlust: (idx >= 0 && idx < ie ? stuecke : opt.stoerMin * 60 / Math.max(tEng, 1e-9)) * (rty / Math.max(eng.kvor, 1e-12)) };
    }
    return out;
  }
  /* Modell aus den Reglerwerten (p von normiere) */
  function modell(p) {
    p = normiere(p);
    const st = STATIONEN.map(s => ({ id: s.id, t: p.takt[s.id], y: INNEN.indexOf(s.id) >= 0 ? 1 - p.ausschuss[s.id] / 100 : 1, aus: s.id === 'verguss' && !p.verguss }));
    const m = linie(st, { puffer: p.puffer, stoerMin: p.stoer, stoerId: p.stoerSt });
    m.p = p; m.stufen = st;
    const h = INNEN.length ? PF.hebel(st.filter(s => INNEN.indexOf(s.id) >= 0)) : null; m.hebel = h;
    return m;
  }

  /* ---------- Rechenregeln der Aufgaben ---------- */
  const prod = a => a.reduce((x, y) => x * y, 1);
  function rtyProzent(yProzent) { return prod(yProzent.map(v => v / 100)) * 100; }
  function betroffenAnzahl(k1, w1, k2, w2) {
    const a = PF.betroffen(PF.RUECK, k1, w1), b = PF.betroffen(PF.RUECK, k2, w2), s = new Set(a.concat(b)); return s.size;
  }
  const SOLVE = {
    kundentakt: p => p.zeitMin * 60 / p.bedarf,
    engpassRate: p => 3600 / Math.max.apply(null, p.takte),
    ausschussRate: p => linie(p.stationen.map((s, i) => ({ id: 's' + i, t: s.t, y: s.y }))).gutRate,
    nutzenTakt: p => p.zyklus / p.nutzen,
    littleDlz: p => p.bestand / p.rate,
    littleBestand: p => p.dlzH * p.rate,
    dlzSumme: p => p.takte.reduce((a, b) => a + b, 0) + p.puffer * Math.max.apply(null, p.takte),
    pufferVerlust: p => Math.max(0, p.stoerMin * 60 - p.puffer * p.tEng) / p.tEng,
    fpy: p => p.gut / p.geprueft * 100,
    rty: p => rtyProzent(p.y),
    startmenge: p => Math.ceil(p.bedarf / (rtyProzent(p.y) / 100) - 1e-9),
    hebelGewinn: p => { const h = PF.hebel(p.y.map((y, i) => ({ id: 'y' + i, y: y / 100 }))); return h.gain * 100; },
    abdeckung: p => (1 - (1 - p.a1 / 100) * (1 - p.a2 / 100)) * 100,
    fehlerkosten: p => p.n * (p.quote / 100) * p.kFrueh + p.n * (1 - p.quote / 100) * p.kSpaet,
    unionAnzahl: p => betroffenAnzahl(p.k1, p.w1, p.k2, p.w2),
    trocken: p => p.nass * p.fest / 100,
    haerten: p => p.stueck * 60 / p.minuten,
    topfzeit: p => Math.floor(p.topf / p.je + 1e-9),
    mischung: p => p.gesamt * p.b / (p.a + p.b),
    vergussMasse: p => (p.hohl - p.bauteil) * p.dichte
  };
  function solve(kind, inp) { const f = SOLVE[kind]; return f ? f(inp) : NAN; }

  /* ---------- Antworten prüfen ----------
     q.ask.type: 'num' (q.value, q.tol), 'match' (q.sol = { itemKey: optionKey }), 'multi' (q.sol = [optionKey]). a: { v } | { m: {item: opt} } | { s: [opt] } */
  function pruefe(q, a) {
    a = a || {};
    if (q.ask.type === 'num') {
      const v = parseDe(a.v); if (!fin(v)) return null;
      const ok = Math.abs(v - q.value) <= q.tol + 1e-9; return { ok, pct: ok ? 100 : 0, given: fmtN(v, 3, true) + (q.ask.unit ? ' ' + q.ask.unit : '') };
    }
    if (q.ask.type === 'match') {
      const keys = q.ask.items.map(i => i.k), m = a.m || {};
      if (keys.some(k => !m[k])) return null;
      const hit = keys.filter(k => m[k] === q.sol[k]).length;
      return { ok: hit === keys.length, pct: Math.round(100 * hit / keys.length), given: hit + ' von ' + keys.length + ' richtig', zeilen: keys.map(k => ({ k, ok: m[k] === q.sol[k] })) };
    }
    const s = Array.isArray(a.s) ? a.s : []; if (!s.length) return null;
    const opts = q.ask.options.map(o => o.k); let hit = 0, wrong = 0;
    opts.forEach(k => { const want = q.sol.indexOf(k) >= 0, got = s.indexOf(k) >= 0; if (want && got) hit++; if (!want && got) wrong++; });
    return { ok: hit === q.sol.length && wrong === 0, pct: Math.max(0, Math.round(100 * (hit - wrong) / q.sol.length)), given: hit + ' richtig, ' + wrong + ' falsch angekreuzt', zeilen: opts.map(k => ({ k, ok: (q.sol.indexOf(k) >= 0) === (s.indexOf(k) >= 0) })) };
  }

  const API = {
    version: '1.0', PF, STATIONEN, ST, INNEN, TAKT0, AUSSCHUSS0, LIMITS, defaults, normiere, linie, modell, SOLVE, solve, pruefe,
    parseDe, fmtN, rd, rtyProzent, betroffenAnzahl, RUECK: PF.RUECK
  };
  root.FLI_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
