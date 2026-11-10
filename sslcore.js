'use strict';
/* Tonfunk Schaltschrank-Lab: reine Rechenlogik (Kennung 'ssl'). window.SSL_CORE bzw. module.exports.
   Alle Bauteilgrößen, Verlustleistungen, Reserven und Zuordnungstabellen sind ÜBUNGSWERTE für die Ausbildung, nicht für die Planung echter Anlagen.
   Maßgebend sind Datenblätter, die Normen (DIN VDE 0100, DIN EN 60204-1) und die Vorgaben des Betriebs. Bauteile heißen neutral (z. B. "Netzteil 24 V").
   Konventionen: Strom in A, Leistung in W, Querschnitt in mm², Breite in TE (1 TE = 17,5 mm, DIN 43880), Temperatur in °C, Differenz in K.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity.
   Schaltschrank-Layout: { items: [ { p: Teile-Kennung, r: Schiene 0..2 (0 = oben), x: Startposition in TE, lab: beschriftet } ], sep: [Trennsteg Kanal 0/1, Kanal 1/2] } */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(mm²|mm2|m³\/h|m3\/h|kw|te|mm|°c|ohm|ω|%|v|a|w|k)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
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

  /* ============================================================ Schutzorgane und Leitungen */
  /* PRUEFEN P1: Normreihe der Bemessungsströme für Leitungsschutzschalter: 6, 10, 13, 16, 20, 25, 32, 40, 50, 63 A (Hausinstallation und Schaltschrank). Fehlen Stufen, die ihr verwendet (z. B. 2, 4, 80, 100 A)? */
  const LS_IN = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
  /* PRUEFEN P2: Auslösebereiche der magnetischen (Kurzschluss-)Auslösung als Vielfaches des Bemessungsstroms: B 3 bis 5, C 5 bis 10, D 10 bis 20. Unterhalb der unteren Grenze löst der Schnellauslöser nicht aus, oberhalb der oberen Grenze sicher. */
  const LS_CHAR = { B: { lo: 3, hi: 5 }, C: { lo: 5, hi: 10 }, D: { lo: 10, hi: 20 } };
  const tripLow = (ch, In) => (LS_CHAR[ch] && num(In) > 0 ? LS_CHAR[ch].lo * In : NAN);
  const tripHigh = (ch, In) => (LS_CHAR[ch] && num(In) > 0 ? LS_CHAR[ch].hi * In : NAN);
  /* PRUEFEN P3: Übungstabelle der Strombelastbarkeit Iz (Kupfer, PVC, zwei belastete Adern, Verlegeart B2, 30 °C Umgebung) bewusst etwas unter den Normtabellen angesetzt: 1,5 mm² = 16 A, 2,5 = 21, 4 = 28, 6 = 36, 10 = 50, 16 = 66 A.
     Damit ergibt sich als größter zulässiger LS: 16, 20, 25, 32, 50, 63 A. Im Schaltschrank mindern Häufung und hohe Temperatur die Belastbarkeit (hier nur qualitativ). Welche Tabelle gilt bei euch (DIN VDE 0298-4, DIN VDE 0100-520, Herstellerangabe)? */
  const CROSS = [1.5, 2.5, 4, 6, 10, 16];
  const IZ = { 1.5: 16, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 66 };
  const izOf = s => (IZ[s] != null ? IZ[s] : NAN);
  const maxIn = s => { const iz = izOf(s); if (!fin(iz)) return NAN; let r = NAN; LS_IN.forEach(x => { if (x <= iz) r = x; }); return r; };
  const pickIn = ib => { if (!(num(ib) > 0)) return NAN; const r = LS_IN.find(x => x >= ib - 1e-9); return r == null ? NAN : r; };
  const minCross = I => { if (!(num(I) > 0)) return NAN; const r = CROSS.find(s => IZ[s] >= I - 1e-9); return r == null ? NAN : r; };
  /* Auslegung eines Abgangs: Ib <= In <= Iz (Betriebsstrom, Bemessungsstrom des LS, Strombelastbarkeit der Leitung) */
  function abgang(ib, In, s) {
    const iz = izOf(s); if (!(num(ib) >= 0) || !(num(In) > 0) || !fin(iz)) return { ok: false, why: 'ungültig', kind: 'ungueltig' };
    if (In > iz) return { ok: false, why: 'Der Bemessungsstrom ' + In + ' A liegt über der Strombelastbarkeit ' + iz + ' A der Leitung: Die Leitung wird nicht mehr geschützt.', kind: 'zugross' };
    if (ib > In + 1e-9) return { ok: false, why: 'Der Betriebsstrom liegt über dem Bemessungsstrom ' + In + ' A: Der LS würde im Betrieb auslösen.', kind: 'zuklein' };
    return { ok: true, why: 'Betriebsstrom ≤ Bemessungsstrom ≤ Strombelastbarkeit.', kind: 'ok' };
  }
  /* Ströme: einphasig I = P / (U · cos φ); dreiphasig I = P / (√3 · U · cos φ · η) (P = Abgabeleistung an der Welle, η = Wirkungsgrad) */
  const i1 = (P, U, cos) => (num(P) >= 0 && num(U) > 0 && num(cos) > 0 && cos <= 1 ? P / (U * cos) : NAN);
  const i3 = (P, U, cos, eta) => (num(P) >= 0 && num(U) > 0 && num(cos) > 0 && cos <= 1 && num(eta) > 0 && eta <= 1 ? P / (Math.sqrt(3) * U * cos * eta) : NAN);
  /* PRUEFEN P4: Schutzleiterquerschnitt bei Außenleiter S in einem getrennt verlegten Schutzleiter aus gleichem Werkstoff: S bis 16 mm² gleich S, über 16 bis 35 mm² gleich 16 mm², über 35 mm² gleich S/2 (DIN VDE 0100-540, allgemein bekannt). */
  const peCross = S => (num(S) > 0 ? (S <= 16 ? S : S <= 35 ? 16 : S / 2) : NAN);

  /* ============================================================ Netzteil und Wärme */
  /* PRUEFEN P5: 24-V-Netzteil: Bedarf plus 25 % Reserve (Übungswert, in der Praxis 20 bis 30 %), dann nächste Übungsstufe 2,5 / 5 / 10 / 20 / 40 A. */
  const PSU_A = [2.5, 5, 10, 20, 40], PSU_RES = 0.25;
  const psuNeed = I => (num(I) >= 0 ? I * (1 + PSU_RES) : NAN);
  const psuPick = I => { const n = psuNeed(I); if (!fin(n)) return NAN; const r = PSU_A.find(x => x >= n - 1e-9); return r == null ? NAN : r; };
  const psuLoss = (Pout, eta) => (num(Pout) >= 0 && num(eta) > 0 && eta <= 1 ? Pout / eta - Pout : NAN);
  const psuIn = (Pout, eta, U) => (num(Pout) >= 0 && num(eta) > 0 && eta <= 1 && num(U) > 0 ? Pout / (eta * U) : NAN);
  /* PRUEFEN P6: Wärmeabfuhr durch die Wand: P = k · A · ΔT mit k = 5,5 W/(m²·K) für lackiertes Stahlblech (üblicher Katalogwert); A = wirksame Oberfläche, ΔT = Innen minus Außen.
     Lüfter: V = 3,1 · P / ΔT in m³/h (Näherung für Luft auf Meereshöhe, aus Dichte und Wärmekapazität; manche Hersteller rechnen mit 3,0). */
  const K_WALL = 5.5, FAN_F = 3.1;
  const wallHeat = (A, dT, k) => (num(A) >= 0 && num(dT) >= 0 ? (k == null ? K_WALL : k) * A * dT : NAN);
  const coolNeed = (Pv, A, dT, k) => { const w = wallHeat(A, dT, k); return fin(w) && num(Pv) >= 0 ? Math.max(0, Pv - w) : NAN; };
  const fanFlow = (P, dT) => (num(P) >= 0 && num(dT) > 0 ? FAN_F * P / dT : NAN);
  const tInside = (Tout, Pv, A, k) => (num(Tout) === Tout && num(Pv) >= 0 && num(A) > 0 ? Tout + Pv / ((k == null ? K_WALL : k) * A) : NAN);

  /* ============================================================ Bauteile und Layout */
  /* PRUEFEN P7: Bauteilgrößen in TE (1 TE = 17,5 mm, DIN 43880) und Verlustleistungen sind Übungswerte (Datenblätter weichen ab). Als Wärmequelle gilt ab 8 W (HEAT_MIN), als wärmeempfindlich gelten SPS und Relais (Elektronik). */
  const TE_MM = 17.5, HEAT_MIN = 8;
  const PARTS = {
    hs: { n: 'Hauptschalter 3-polig', s: 'Hauptschalter', w: 3, pv: 3, z: 'L', k: 'Q', sens: false },
    fi: { n: 'FI-Schutzschalter 4-polig', s: 'FI', w: 4, pv: 3, z: 'L', k: 'F', sens: false },
    ls3: { n: 'Leitungsschutzschalter 3-polig', s: 'LS 3-polig', w: 3, pv: 6, z: 'L', k: 'F', sens: false },
    ls1: { n: 'Leitungsschutzschalter 1-polig', s: 'LS 1-polig', w: 1, pv: 2, z: 'L', k: 'F', sens: false },
    sk: { n: 'Leistungsschütz', s: 'Schütz', w: 3, pv: 8, z: 'L', k: 'K', sens: false },
    nt: { n: 'Netzteil 24 V DC', s: 'Netzteil', w: 5, pv: 13, z: 'L', k: 'G', sens: false },
    fu: { n: 'Frequenzumrichter', s: 'Umrichter', w: 6, pv: 30, z: 'L', k: 'T', sens: false },
    klL: { n: 'Klemmenblock Leistung', s: 'Klemmen L', w: 4, pv: 2, z: 'L', k: 'X', sens: false },
    sps: { n: 'SPS-Ersatzblock (Kleinsteuerung)', s: 'SPS', w: 8, pv: 4, z: 'S', k: 'A', sens: true },
    rel: { n: 'Koppelrelais 24 V', s: 'Relais', w: 1, pv: 1, z: 'S', k: 'K', sens: true },
    klS: { n: 'Klemmenblock Steuerung', s: 'Klemmen S', w: 4, pv: 1, z: 'S', k: 'X', sens: false }
  };
  Object.keys(PARTS).forEach(k => { PARTS[k].id = k; PARTS[k].heat = PARTS[k].pv >= HEAT_MIN; });
  const part = id => PARTS[id] || null;
  /* PRUEFEN P8: Betriebsmittelkennzeichen (Kennbuchstaben) nach dem Muster der Normen der Reihe EN 81346 bzw. üblicher Praxis: Q Schaltgerät, F Schutzeinrichtung, K Schütz/Relais, G Stromversorgung, T Umrichter/Transformator, X Klemmen, A Baugruppe (SPS). Welche Buchstaben nutzt ihr? */
  const BMK_LETTER = { Q: 'Schaltgerät (z. B. Hauptschalter)', F: 'Schutzeinrichtung (LS, FI, Sicherung)', K: 'Schütz oder Relais', G: 'Stromversorgung (Netzteil)', T: 'Umrichter oder Transformator', X: 'Klemmen', A: 'Baugruppe (z. B. SPS)' };
  /* PRUEFEN P9: Montageplatte im Übungsmodell: 3 Hutschienen mit je 20 TE Breite, dazwischen zwei Kabelkanäle; höchstens 80 % je Schiene belegt (20 % Reserve für Erweiterung und Wärme, Übungswert); Trennsteg im Kanal zwischen Leistungs- und Steuerschiene. */
  const RAILS = 3, RAIL_TE = 20, RESERVE = 0.2, MAX_TE = Math.floor(RAIL_TE * (1 - RESERVE) + 1e-9);
  /* PRUEFEN P21: Regeln des Layouts im Übungsmodell: Hauptschalter in der obersten Schiene; Elektronik (SPS, Relais) nicht in einer Schiene oberhalb einer Wärmequelle (ab 8 W) bei seitlicher Überdeckung; zwei Wärmequellen nicht in benachbarten Schienen übereinander; je Schiene nur ein Spannungsbereich; Trennsteg im Kanal zwischen Leistungs- und Steuerschiene; Platzreserve 20 %. Das ist eine Lehrvereinfachung (reale Schränke: Wärmeberechnung, Herstellervorgaben, Abstände). Passen die Regeln zur Werkstattpraxis? */
  const RULES = {
    pass: { t: 'Alle Bauteile sind eingebaut', d: 'Jedes Bauteil der Liste sitzt auf einer Schiene.' },
    fit: { t: 'Alles passt auf die Schienen', d: 'Kein Bauteil ragt über das Schienenende, und zwei Bauteile belegen nie dieselben TE.' },
    haupt: { t: 'Hauptschalter in der obersten Schiene', d: 'Die Einspeisung kommt von oben, der Hauptschalter sitzt in der ersten (obersten) Schiene.' },
    warm: { t: 'Empfindliches nicht über Wärmequellen', d: 'Warme Luft steigt auf: SPS und Relais dürfen nicht in einer Schiene oberhalb einer Wärmequelle (ab 8 W) sitzen, wenn sie sich seitlich überdecken.' },
    stapel: { t: 'Wärmequellen nicht direkt übereinander', d: 'Zwei Wärmequellen in benachbarten Schienen mit seitlicher Überdeckung heizen sich gegenseitig auf.' },
    trenn: { t: 'Leistung und Steuerung getrennt', d: 'Jede Schiene enthält nur Bauteile aus einem Bereich: Leistung (230/400 V) oder Steuerung (24 V).' },
    kanal: { t: 'Trennsteg im Kanal zwischen den Bereichen', d: 'Grenzen eine Leistungs- und eine Steuerschiene an einen Kanal, gehört dort ein Trennsteg hinein.' },
    beschr: { t: 'Alle Bauteile beschriftet', d: 'Jedes Bauteil trägt sein Betriebsmittelkennzeichen, damit es im Schaltplan wiedergefunden wird.' },
    reserve: { t: 'Platzreserve auf jeder Schiene', d: 'Höchstens 80 % der Schiene (16 von 20 TE) sind belegt; der Rest bleibt für Erweiterung und Luftzirkulation frei.' }
  };
  const RULE_ORDER = ['pass', 'fit', 'haupt', 'trenn', 'kanal', 'warm', 'stapel', 'reserve', 'beschr'];
  const emptyLayout = () => ({ items: [], sep: [false, false] });
  const cloneLayout = L => ({ items: (L.items || []).map(i => ({ p: i.p, r: i.r, x: i.x, lab: !!i.lab })), sep: [!!(L.sep && L.sep[0]), !!(L.sep && L.sep[1])] });
  const overlap = (a, b) => a.x < b.x + part(b.p).w && b.x < a.x + part(a.p).w;
  const railItems = (L, r) => L.items.filter(i => i.r === r && part(i.p));
  const railUsed = (L, r) => railItems(L, r).reduce((s, i) => s + part(i.p).w, 0);
  const zonesOf = (L, r) => { const z = {}; railItems(L, r).forEach(i => { z[part(i.p).z] = 1; }); return Object.keys(z); };
  const validItem = i => !!part(i.p) && Number.isInteger(i.r) && Number.isInteger(i.x);
  /* Regelprüfung: need = Liste der Bauteil-Kennungen, die eingebaut sein müssen (Vielfachheit zählt), rules = Regel-Kennungen (Standard alle).
     Ergebnis: { ok, rules: [ { k, t, ok, n (Zahl der Verstöße), det: [Texte] } ], bad: [Kennungen verletzter Regeln] } */
  function checkLayout(L, need, rules) {
    L = L || emptyLayout(); need = need || []; rules = (rules || RULE_ORDER).filter(k => RULES[k]);
    const items = L.items.filter(validItem), res = {};
    const add = (k, txt) => { (res[k] = res[k] || []).push(txt); };
    const nm = i => part(i.p).s;
    /* Bauteile vollständig */
    const have = {}; items.forEach(i => { have[i.p] = (have[i.p] || 0) + 1; });
    const want = {}; need.forEach(p => { want[p] = (want[p] || 0) + 1; });
    Object.keys(want).forEach(p => { if ((have[p] || 0) < want[p]) add('pass', want[p] - (have[p] || 0) + ' × ' + part(p).s + ' fehlt'); });
    Object.keys(have).forEach(p => { if ((have[p] || 0) > (want[p] || 0) && need.length) add('pass', part(p).s + ' ist zu oft eingebaut'); });
    /* Passen und Überlappen */
    items.forEach((i, a) => {
      if (i.r < 0 || i.r >= RAILS || i.x < 0 || i.x + part(i.p).w > RAIL_TE) add('fit', nm(i) + ' liegt nicht vollständig auf einer Schiene');
      for (let b = a + 1; b < items.length; b++) if (items[b].r === i.r && overlap(i, items[b])) add('fit', nm(i) + ' und ' + nm(items[b]) + ' überdecken sich');
    });
    items.forEach(i => { if (i.p === 'hs' && i.r !== 0) add('haupt', 'Der Hauptschalter sitzt in Schiene ' + (i.r + 1) + ', nicht in der obersten'); });
    for (let r = 0; r < RAILS; r++) { if (zonesOf(L, r).length > 1) add('trenn', 'Schiene ' + (r + 1) + ' mischt Leistung und Steuerung'); if (railUsed(L, r) > MAX_TE) add('reserve', 'Schiene ' + (r + 1) + ' ist mit ' + railUsed(L, r) + ' von ' + RAIL_TE + ' TE zu voll'); }
    for (let r = 0; r < RAILS - 1; r++) { const z = {}; zonesOf(L, r).concat(zonesOf(L, r + 1)).forEach(k => { z[k] = 1; }); if (z.L && z.S && !(L.sep && L.sep[r])) add('kanal', 'Im Kanal zwischen Schiene ' + (r + 1) + ' und ' + (r + 2) + ' fehlt der Trennsteg'); }
    items.forEach(s => { if (!part(s.p).sens) return; items.forEach(h => { if (part(h.p).heat && h.r > s.r && overlap(s, h)) add('warm', nm(s) + ' (Schiene ' + (s.r + 1) + ') sitzt über ' + nm(h) + ' (Schiene ' + (h.r + 1) + ')'); }); });
    items.forEach(h1 => { if (!part(h1.p).heat) return; items.forEach(h2 => { if (part(h2.p).heat && h2.r === h1.r + 1 && overlap(h1, h2)) add('stapel', nm(h1) + ' sitzt direkt über ' + nm(h2)); }); });
    items.forEach(i => { if (!i.lab) add('beschr', nm(i) + ' ist nicht beschriftet'); });
    const out = rules.map(k => ({ k, t: RULES[k].t, ok: !res[k], n: (res[k] || []).length, det: res[k] || [] }));
    return { ok: out.every(o => o.ok), rules: out, bad: out.filter(o => !o.ok).map(o => o.k) };
  }
  /* Lösungssuche (für die Aufgaben-Erzeugung und die Tests): verteilt die Bauteile auf Schienen, sortiert sie und setzt Beschriftung und Trennstege.
     Liefert ein Layout, das alle gewählten Regeln erfüllt, oder null. */
  function solveLayout(need, rules) {
    const ps = need.slice().sort((a, b) => part(b).w - part(a).w || (a < b ? -1 : 1)), n = ps.length, ass = new Array(n).fill(0), railZ = [null, null, null], used = [0, 0, 0];
    let best = null, tries = 0;
    const orders = [(a, b) => 0, (a, b) => part(b.p).w - part(a.p).w, (a, b) => part(a.p).w - part(b.p).w, (a, b) => (part(a.p).heat ? 1 : 0) - (part(b.p).heat ? 1 : 0), (a, b) => (part(b.p).heat ? 1 : 0) - (part(a.p).heat ? 1 : 0)];
    const capMax = rules && rules.indexOf('reserve') < 0 ? RAIL_TE : MAX_TE, needHaupt = !rules || rules.indexOf('haupt') >= 0;
    function leaf() {
      tries++;
      const rails = [[], [], []]; ps.forEach((p, i) => rails[ass[i]].push({ p, r: ass[i], x: 0, lab: true }));
      /* Hauptschalter zuerst: Rang vor der Sortierung */
      for (let a = 0; a < orders.length && !best; a++) for (let b = 0; b < orders.length && !best; b++) for (let c = 0; c < orders.length && !best; c++) {
        const ord = [a, b, c];
        const L = emptyLayout();
        for (let r = 0; r < RAILS; r++) { let x = 0; rails[r].slice().sort((u, v) => (u.p === 'hs' ? -1 : 0) - (v.p === 'hs' ? -1 : 0) || orders[ord[r]](u, v)).forEach(i => { L.items.push({ p: i.p, r, x, lab: true }); x += part(i.p).w; }); }
        L.sep = [true, true];
        const chk = checkLayout(L, need, rules);
        if (chk.ok) { best = L; return; }
      }
    }
    function dfs(i) {
      if (best || tries > 3000) return;
      if (i === n) { leaf(); return; }
      const w = part(ps[i]).w, z = part(ps[i]).z;
      for (let r = 0; r < RAILS; r++) {
        if (railZ[r] && railZ[r] !== z) continue; if (used[r] + w > capMax) continue; if (needHaupt && ps[i] === 'hs' && r !== 0) continue;
        const prevZ = railZ[r]; railZ[r] = z; used[r] += w; ass[i] = r; dfs(i + 1); used[r] -= w; railZ[r] = prevZ;
        if (best) return;
      }
    }
    dfs(0);
    if (!best) return null;
    /* Trennstege nur dort, wo nötig (nicht nötig = leer lassen ist ebenfalls zulässig; hier minimal setzen) */
    for (let r = 0; r < RAILS - 1; r++) { const z = {}; zonesOf(best, r).concat(zonesOf(best, r + 1)).forEach(k => { z[k] = 1; }); best.sep[r] = !!(z.L && z.S); }
    return best;
  }
  /* freie Position für ein Bauteil in einer Schiene (links beginnend, nach Möglichkeit ohne Überlappung), sonst -1 */
  function freeSpot(L, p, r) {
    const w = part(p).w, its = railItems(L, r);
    for (let x = 0; x + w <= RAIL_TE; x++) if (!its.some(i => overlap({ p, x }, i))) return x;
    return -1;
  }
  /* Verlustleistung und Wärmebilanz eines Layouts */
  const pvSum = L => L.items.filter(validItem).reduce((s, i) => s + part(i.p).pv, 0);
  const teSum = ids => ids.reduce((s, p) => s + (part(p) ? part(p).w : NAN), 0);

  /* ============================================================ Verdrahtung */
  /* PRUEFEN P10: Aderfarben. Feste Installation (Kabel im Verteiler, VDE 0293): L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb. Maschinenschaltschrank (EN 60204-1, Einzeladern): Hauptstromkreise schwarz, Steuerstromkreise Wechselspannung rot, Steuerstromkreise Gleichspannung (24 V DC) blau, Neutralleiter hellblau, Schutzleiter grün-gelb, Fremdspannung orange.
     In der Praxis wird +24 V oft rot und 0 V blau verdrahtet. Welche Regel gilt in der Werkstatt, und wie unterscheidet ihr die Außenleiter im Schaltschrank (Aderkennzeichnung)? */
  const COL = { braun: 'braun', schwarz: 'schwarz', grau: 'grau', blau: 'blau', hellblau: 'hellblau', gg: 'grün-gelb', rot: 'rot', orange: 'orange', weiss: 'weiß', gelb: 'gelb' };
  const INST_COL = { L1: 'braun', L2: 'schwarz', L3: 'grau', N: 'blau', PE: 'grün-gelb' };
  const SCHR_COL = { 'Hauptstromkreis (Leistung)': 'schwarz', 'Steuerstromkreis AC': 'rot', 'Steuerstromkreis DC (24 V)': 'blau', 'Neutralleiter': 'hellblau', 'Schutzleiter': 'grün-gelb', 'Fremdspannung': 'orange' };
  /* PRUEFEN P11: Farben der Aderendhülsen nach Querschnitt (DIN 46228-4, üblich): 0,5 weiß, 0,75 grau, 1 rot, 1,5 schwarz, 2,5 blau, 4 grau, 6 gelb, 10 rot. Herstellerabhängig; gilt dieser Farbcode in der Werkstatt? */
  const FERRULE = { 0.5: 'weiß', 0.75: 'grau', 1: 'rot', 1.5: 'schwarz', 2.5: 'blau', 4: 'grau', 6: 'gelb', 10: 'rot' };
  /* PRUEFEN P12: Reihenfolge der Einspeiseklemmen (Übung): L1, L2, L3, N, PE (von links nach rechts bzw. oben nach unten). Manche Werkstätten setzen PE vorn oder an den Rand; welche Reihenfolge gilt bei euch? */
  const TERM_ORDER = ['L1', 'L2', 'L3', 'N', 'PE'];
  /* PRUEFEN P13: Dreileiter-Sensorkabel (Näherungsschalter, PNP): braun = +24 V, blau = 0 V, schwarz = Signalausgang, weiß = zweiter Ausgang bzw. Zusatzfunktion (Farbcode der Sensornorm, allgemein bekannt). */
  const SENSOR_COL = { braun: '+24 V', blau: '0 V', schwarz: 'Signalausgang' };

  /* ============================================================ Prüfen vor der Inbetriebnahme */
  /* PRUEFEN P14: Prüfablauf (Übung, nur qualitativ, ohne Zahlenwerte): erst Sichtprüfung, dann spannungsfreie Prüfungen (Schutzleiterdurchgang, Isolation), danach stufenweises Zuschalten mit Spannungsmessung, Funktionsprüfung, zuletzt Protokoll. Stimmt die Reihenfolge mit eurer Prüfanweisung (z. B. DIN EN 60204-1 Abschnitt 18, DIN VDE 0100-600) überein? */
  const PRUEF_STEPS = [
    { t: 'Sichtprüfung: Bauteile, Beschriftung, Klemmen, Aderendhülsen', live: false },
    { t: 'Durchgang des Schutzleiters prüfen', live: false },
    { t: 'Isolationswiderstand messen', live: false },
    { t: 'Hauptschalter einschalten und Spannung messen', live: true },
    { t: 'Funktionsprüfung mit Not-Halt und Schutzschaltern', live: true },
    { t: 'Prüfergebnis im Protokoll festhalten', live: false }
  ];
  /* PRUEFEN P15: Ablauf der Schutzleiterprüfung (Übung, qualitativ): Anlage spannungsfrei, Messgerät nullen bzw. Messleitungen prüfen, Messung von der Schutzleiterschiene zu jedem berührbaren Metallteil, Wert niederohmig und bei jeder Stelle plausibel, Ergebnis notieren. Zahlenwerte und Messstrom sind bewusst nicht Teil der Aufgaben. */
  const PE_STEPS = ['Anlage spannungsfrei schalten und Spannungsfreiheit feststellen', 'Messleitungen prüfen und das Messgerät nullen', 'Von der Schutzleiterschiene zu jedem berührbaren Metallteil messen', 'Niederohmige Werte kontrollieren und auffällige Stelle nacharbeiten', 'Messwerte im Prüfprotokoll eintragen'];

  const api = {
    fin, rd, num, ceilN, parseDe, fmtDe, fmtN, hashStr, rng, ri, pick, shuffle,
    LS_IN, LS_CHAR, tripLow, tripHigh, CROSS, IZ, izOf, maxIn, pickIn, minCross, abgang, i1, i3, peCross,
    PSU_A, PSU_RES, psuNeed, psuPick, psuLoss, psuIn, K_WALL, FAN_F, wallHeat, coolNeed, fanFlow, tInside,
    TE_MM, HEAT_MIN, PARTS, part, BMK_LETTER, RAILS, RAIL_TE, RESERVE, MAX_TE, RULES, RULE_ORDER,
    emptyLayout, cloneLayout, overlap, railItems, railUsed, zonesOf, checkLayout, solveLayout, freeSpot, pvSum, teSum,
    COL, INST_COL, SCHR_COL, FERRULE, TERM_ORDER, SENSOR_COL, PRUEF_STEPS, PE_STEPS
  };
  root.SSL_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
