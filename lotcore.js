'use strict';
/* Tonfunk Löt-Lab: reine Rechenlogik (Kennung 'lot'). window.LOT_CORE bzw. module.exports.
   ALLE Zahlen (Temperaturen, Zeiten, Schwellen, Raten, Kosten) sind ÜBUNGSWERTE bzw. Richtwerte für die Ausbildung. Verbindlich sind Lötanweisung, Datenblatt von Lot und Paste und die Vorgaben der Prüfung.
   Themen: Lötprozess und Werkstoffe, THT-Lötstelle beurteilen (Lötstellen-Modell), SMD und Reflow-Profil, Klassen und Qualitätskennzahlen, ESD, Nacharbeit.
   Das Lötstellen-Modell ist ein Lernmodell: Das Lötauge heizt wie ein Körper mit einer Zeitkonstante auf die Spitzentemperatur auf, Benetzung wächst mit der Zeit über der Fließtemperatur
   und mit dem Flussmittel. Es ersetzt keine Norm und keine Prüfung. Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN bzw. null, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Zahlen deutsch ---------- */
  const UNIT = /(?:k\/s|mm³|mm|µs|µa|µm|mg|ppm|lötstellen|stück|stk|min|ma|kω|mω|ω|ohm|°c|°|%|€|eur|s|h|v|a|g|m)$/i;
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(UNIT, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '?';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '?'; dec = dec == null ? 2 : dec;
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

  /* ============================================================ Lötstelle (Handlöten, Durchsteck) */
  /* PRUEFEN L1: Schmelztemperaturen (SnAgCu ca. 217 °C, SnPb ca. 183 °C) sind Rundwerte aus gängigen Lehrunterlagen; Fließreserve 15 K ist ein Lernwert. */
  const ALLOYS = {
    sac: { k: 'sac', n: 'bleifrei (SnAgCu, z. B. SAC305)', kurz: 'bleifrei', tm: 217 },
    snpb: { k: 'snpb', n: 'bleihaltig (SnPb)', kurz: 'bleihaltig', tm: 183 }
  };
  const T0 = 25, OVER = 15;
  const TAU = { normal: 1, masse: 2.6 };   /* Zeitkonstante des Lötauges in s: normale Fläche oder große Massefläche */
  const FLUX = { kein: { n: 'kein', f: 0.3 }, wenig: { n: 'wenig', f: 0.75 }, normal: { n: 'normal', f: 1 } };
  const LEV = ['ziel', 'annehmbar', 'prozess', 'fehler'];
  const LEVN = { ziel: 'Zielzustand', annehmbar: 'Annehmbar', prozess: 'Prozessindikator', fehler: 'Fehler' };
  const worst = ls => ls.reduce((a, b) => (LEV.indexOf(b) > LEV.indexOf(a) ? b : a), 'ziel');

  /* Temperatur des Lötauges nach t Sekunden bei Spitzentemperatur Tsp (Aufheizkurve erster Ordnung) */
  const padTemp = (Tsp, t, tau) => (num(Tsp) > T0 && num(t) >= 0 && num(tau) > 0 ? T0 + (Tsp - T0) * (1 - Math.exp(-t / tau)) : NAN);
  /* Zeit, bis das Lötauge die Fließtemperatur (Schmelztemperatur + 15 K) erreicht; NaN, wenn die Spitze dafür zu kalt ist */
  const reachTime = (Tsp, Tm, tau) => (num(Tsp) > Tm + OVER && num(Tm) > 0 && num(tau) > 0 ? -tau * Math.log(1 - (Tm + OVER - T0) / (Tsp - T0)) : NAN);

  const lotLevel = l => (l < 60 ? 'fehler' : l < 80 ? 'prozess' : l < 90 ? 'annehmbar' : l <= 115 ? 'ziel' : l <= 130 ? 'annehmbar' : l <= 150 ? 'prozess' : 'fehler');
  const thetaLevel = t => (t <= 30 ? 'ziel' : t <= 55 ? 'annehmbar' : t <= 90 ? 'prozess' : 'fehler');
  const fillLevel = f => (f >= 90 ? 'ziel' : f >= 75 ? 'annehmbar' : f >= 60 ? 'prozess' : 'fehler');
  const NAMEN = { waerme: 'Temperatur und Zeit', lot: 'Lotmenge', benetz: 'Benetzung', fill: 'Durchstieg' };

  /* p: { lot (% der Idealmenge), temp (°C Spitze), zeit (s), flux ('kein'|'wenig'|'normal'), alloy ('sac'|'snpb'), mass ('normal'|'masse') } */
  function joint(p) {
    if (!p || !(num(p.lot) > 0) || !(num(p.temp) > T0) || !(num(p.zeit) > 0) || !ALLOYS[p.alloy] || !FLUX[p.flux] || !TAU[p.mass]) return null;
    const al = ALLOYS[p.alloy], tau = TAU[p.mass], tr = reachTime(p.temp, al.tm, tau);
    const twet = fin(tr) ? Math.max(0, p.zeit - tr) : 0, melted = twet > 0.15;
    const x = Math.min(1, twet / 1.5), W = melted ? (3 * x * x - 2 * x * x * x) * FLUX[p.flux].f : 0;
    const dose = melted ? twet * (p.temp - al.tm) : 0, tEnd = padTemp(p.temp, p.zeit, tau);
    const theta = melted ? Math.round(clamp(15 + 135 * (1 - W) + 0.6 * (p.lot - 100), 8, 150)) : 150;
    const fill = melted ? Math.round(clamp(Math.pow(p.lot / 100, 1.2) * (0.2 + 0.8 * W), 0, 1) * 100) : 0;
    const wetPct = Math.round(W * 100);
    /* Befunde: je Prüfpunkt Stufe und Satz */
    let wl = 'ziel', wt = 'Temperatur und Zeit passen: Das Lot floss, ohne zu überhitzen.';
    if (!melted) { wl = 'fehler'; wt = fin(tr) ? 'Das Lot ist nicht richtig geflossen: Die Zeit reicht nicht (nötig sind etwa ' + fmtN(tr, 1) + ' s).' : 'Die Spitze ist zu kalt: Das Lötauge erreicht die Fließtemperatur des Lots nie.'; }
    else if (dose > 1000) { wl = 'fehler'; wt = 'Überhitzt: Das Flussmittel ist verbrannt, Lötauge und Bauteil leiden.'; }
    else if (dose > 600 || p.temp > 420) { wl = 'prozess'; wt = 'Sehr heiß oder sehr lang: Das Flussmittel verbrennt, die Lötstelle altert schneller.'; }
    const ll = lotLevel(p.lot), lt = { fehler: p.lot < 100 ? 'Zu wenig Lot: Es reicht nicht für einen Meniskus rund um den Anschluss.' : 'Viel zu viel Lot: Kugel, der Anschluss ist nicht mehr zu erkennen, Brückengefahr.', prozess: p.lot < 100 ? 'Knapp: Die Hohlkehle ist sehr flach.' : 'Reichlich: Der Meniskus ist fast gerade oder bauchig.', annehmbar: p.lot < 100 ? 'Etwas weniger als ideal, noch in Ordnung.' : 'Etwas mehr als ideal, noch in Ordnung.', ziel: 'Genau richtig: Hohlkehle bis nahe an die Drahtspitze.' }[ll];
    const bl = thetaLevel(theta), bt = { ziel: 'Das Lot breitet sich flach aus (kleiner Winkel).', annehmbar: 'Brauchbar benetzt, der Winkel ist größer als beim Idealbild.', prozess: 'Grenzwertig benetzt: Der Winkel nähert sich 90°.', fehler: 'Schlecht benetzt: Das Lot steht als Kugel (Winkel über 90°).' }[bl];
    const fl = fillLevel(fill), ft = { ziel: 'Die Hülse ist (fast) ganz gefüllt.', annehmbar: 'Mindestens drei Viertel der Hülse sind gefüllt.', prozess: 'Weniger als drei Viertel der Hülse sind gefüllt.', fehler: 'Die Hülse ist kaum oder gar nicht gefüllt.' }[fl];
    const findings = [{ k: 'waerme', n: NAMEN.waerme, lvl: wl, txt: wt }, { k: 'lot', n: NAMEN.lot, lvl: ll, txt: lt }, { k: 'benetz', n: NAMEN.benetz, lvl: bl, txt: bt }, { k: 'fill', n: NAMEN.fill, lvl: fl, txt: ft }];
    const verdict = worst(findings.map(f => f.lvl)), main = verdict === 'ziel' ? 'ziel' : findings.find(f => f.lvl === verdict).k;
    const look = !melted ? 'rau' : wl !== 'ziel' ? 'verbrannt' : (W >= 0.9 && p.lot >= 85 && p.lot <= 130 ? 'glatt' : 'seidenmatt');
    /* Was kann man ändern? */
    const tips = [];
    if (p.flux !== 'normal') tips.push('Flussmittel nachlegen: Lötdraht mit Flussmittelseele nutzen oder Flussmittel auftragen. Ohne löst sich das Oxid nicht, das Lot perlt ab.');
    if (p.mass === 'masse' && (!melted || W < 0.9)) tips.push('Die Massefläche zieht die Wärme ab: länger erwärmen, größere Spitze oder mehr Leistung nehmen oder die Platine vorheizen.');
    if (!melted || (p.mass !== 'masse' && W < 0.9 && p.flux === 'normal')) tips.push('Mehr Wärme ins Lötauge: Die Spitze muss Lötauge und Anschluss gemeinsam berühren, dann reichen wenige Sekunden. Nur im Notfall die Temperatur erhöhen.');
    if (wl === 'prozess' || (wl === 'fehler' && melted)) tips.push('Kürzer löten oder die Temperatur senken: Nach dem Fließen die Spitze sofort wegnehmen.');
    if (ll === 'fehler' || ll === 'prozess') tips.push(p.lot < 100 ? 'Mehr Lot zuführen, bis die Hohlkehle rund um den Anschluss geschlossen ist.' : 'Weniger Lot zuführen oder überschüssiges Lot mit der Spitze abziehen.');
    return { p: Object.assign({}, p), alloy: p.alloy, tm: al.tm, tau, tr, twet, melted, W, wetPct, theta, fill, dose, tEnd, findings, verdict, main, look, tips };
  }

  /* ============================================================ Reflow-Profil */
  /* PRUEFEN L2: Richtwerte des Profils (Anstieg höchstens 3 K/s, Halten 60 bis 120 s bei 150 bis 180 °C, Spitze bleifrei höchstens 260 °C, SnPb höchstens 235 °C, Zeit über Schmelztemperatur 30 bis 90 s,
     Abkühlen 1 bis 4 K/s) entsprechen allgemein üblichen Pastenunterlagen, sind aber Lernwerte; Datenblatt von Paste und Bauteilen gilt. Das Modell "großes Bauteil bleibt um 2 + 2 · Anstieg K kälter" ist erfunden. */
  const RF = { halt1: 150, halt2: 180, spitze: 15, ende: 100, max: { sac: 260, snpb: 235 } };
  const talSimple = (peak, tm, up, down, hold) => (num(peak) > tm && num(up) > 0 && num(down) > 0 && num(hold) >= 0 ? (peak - tm) / up + hold + (peak - tm) / down : NAN);
  /* Dauer über der Temperatur T entlang eines Linienzugs [[t, T], ...] */
  function timeAbove(pts, T) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ta, a] = pts[i - 1], [tb, b] = pts[i];
      if (a >= T && b >= T) s += tb - ta;
      else if ((a >= T) !== (b >= T)) { const f = (T - a) / (b - a); s += a >= T ? f * (tb - ta) : (1 - f) * (tb - ta); }
    }
    return s;
  }
  function tempAt(pts, t) {
    if (!pts.length || !(num(t) >= 0)) return NAN;
    for (let i = 1; i < pts.length; i++) { if (t <= pts[i][0]) { const [ta, a] = pts[i - 1], [tb, b] = pts[i]; return tb > ta ? a + (b - a) * (t - ta) / (tb - ta) : b; } }
    return pts[pts.length - 1][1];
  }
  const RFN = { anstieg: 'Aufheizrate', halten: 'Haltezeit', spitze: 'Spitzentemperatur', tal: 'Zeit über Schmelztemperatur', kuehl: 'Abkühlrate' };
  /* p: { up (K/s), hold (s), peak (°C), down (K/s), alloy } */
  function reflow(p) {
    if (!p || !(num(p.up) >= 0.2) || !(num(p.hold) >= 0) || !(num(p.peak) > RF.halt2 + 10) || !(num(p.down) >= 0.2) || !ALLOYS[p.alloy]) return null;
    const tm = ALLOYS[p.alloy].tm, t1 = (RF.halt1 - T0) / p.up, t2 = t1 + p.hold, t3 = t2 + (p.peak - RF.halt2) / p.up, t4 = t3 + RF.spitze, t5 = t4 + (p.peak - RF.ende) / p.down;
    const small = [[0, T0], [t1, RF.halt1], [t2, RF.halt2], [t3, p.peak], [t4, p.peak], [t5, RF.ende]];
    const dBig = 2 + 2 * p.up, peakBig = p.peak - dBig, big = small.map(([t, T]) => [t, T0 + (T - T0) * (peakBig - T0) / (p.peak - T0)]);
    const talS = timeAbove(small, tm), talB = timeAbove(big, tm), max = RF.max[p.alloy];
    const F = [];
    F.push({ k: 'anstieg', n: RFN.anstieg, lvl: p.up > 3 ? 'bad' : p.up < 1 ? 'warn' : 'ok', txt: p.up > 3 ? 'Zu steil: Das Flussmittel kocht, es gibt Lotperlen und Spritzer, kleine Bauteile stellen sich auf (Grabstein), Keramik bekommt Spannung.' : p.up < 1 ? 'Sehr flach: Das Flussmittel ist verbraucht, bevor das Lot schmilzt, und der Ofen braucht lange.' : 'Der Anstieg ist sanft genug.' });
    F.push({ k: 'halten', n: RFN.halten, lvl: p.hold < 40 || p.hold > 160 ? 'bad' : p.hold < 60 || p.hold > 120 ? 'warn' : 'ok', txt: p.hold < 60 ? 'Zu kurz: Kleine und große Bauteile gleichen ihre Temperatur nicht aus, das Flussmittel wirkt nicht lange genug.' : p.hold > 120 ? 'Zu lang: Das Flussmittel ist verbraucht, die Oberflächen oxidieren wieder.' : 'Die Haltezeit gleicht die Temperaturen aus und lässt das Flussmittel wirken.' });
    F.push({ k: 'spitze', n: RFN.spitze, lvl: p.peak > max || peakBig < tm + 8 ? 'bad' : peakBig < tm + 15 ? 'warn' : 'ok', txt: p.peak > max ? 'Zu heiß: Bauteile und Platine werden über ihre Grenze belastet (feuchte Gehäuse platzen, Popcorn-Effekt).' : peakBig < tm + 8 ? 'Zu kalt: Am großen Bauteil schmilzt die Paste nicht richtig auf, es entsteht eine kalte Lötstelle.' : peakBig < tm + 15 ? 'Knapp: Am großen Bauteil bleibt nur wenig Reserve über der Schmelztemperatur.' : 'Die Spitze schmilzt das Lot auch am großen Bauteil und bleibt unter der Bauteilgrenze.' });
    F.push({ k: 'tal', n: RFN.tal, lvl: talB < 30 || talS > 120 ? 'bad' : talS > 90 ? 'warn' : 'ok', txt: talB < 30 ? 'Zu kurz über der Schmelztemperatur: Das Lot benetzt nicht vollständig (am großen Bauteil nur ' + fmtN(talB, 0) + ' s).' : talS > 90 ? 'Zu lang flüssig: Die Zwischenschicht zum Kupfer wird dick und spröde, die Bauteile werden belastet.' : 'Das Lot ist lange genug flüssig, um zu benetzen, aber nicht zu lang.' });
    F.push({ k: 'kuehl', n: RFN.kuehl, lvl: p.down > 6 ? 'bad' : p.down > 4 || p.down < 1 ? 'warn' : 'ok', txt: p.down > 4 ? 'Zu schnell: Keramikbauteile bekommen Risse durch Temperaturschock.' : p.down < 1 ? 'Zu langsam: grobes Gefüge und dicke Zwischenschicht, die Lötstelle wird spröde.' : 'Die Abkühlung ist zügig, aber ohne Schock.' });
    const bad = F.filter(f => f.lvl === 'bad'), warn = F.filter(f => f.lvl === 'warn'), main = (bad[0] || warn[0] || { k: 'gut' }).k;
    return { tm, t1, t2, t3, t4, t5, small, big, peakBig, talS, talB, findings: F, main, urteil: bad.length ? 'schlecht' : warn.length ? 'bedingt' : 'gut', pasteOk: talB >= 30 && peakBig >= tm + 8, max };
  }
  /* Zustand der Lötstelle am kleinen Bauteil zur Zeit t (Sekunden seit Ofeneingang) */
  function reflowState(r, t) {
    if (!r || !(num(t) >= 0)) return null;
    const T = tempAt(r.small, Math.min(t, r.t5)), peak = r.small[3][1], zone = t < r.t1 ? 'vor' : t < r.t2 ? 'halten' : t <= r.t4 ? 'spitze' : 'kuehl';
    let phase = 'paste';
    if (peak > r.tm) { const up = r.t2 + (r.tm - RF.halt2) / ((peak - RF.halt2) / (r.t3 - r.t2)), down = r.t4 + (peak - r.tm) / ((peak - RF.ende) / (r.t5 - r.t4)); phase = t < up ? 'paste' : t <= down ? 'fluessig' : 'fest'; }
    return { T, zone, phase };
  }

  /* ============================================================ Rechenhelfer für Aufgaben */
  const smdOhm = code => { const s = String(code); if (!/^\d{3,4}$/.test(s)) return NAN; return parseInt(s.slice(0, -1), 10) * Math.pow(10, +s.slice(-1)); };
  const solderMg = (d, l, rho) => (num(d) > 0 && num(l) > 0 && num(rho) > 0 ? Math.PI / 4 * d * d * l * rho : NAN);   /* mm³ · g/cm³ = mg */
  const areaPct = (dw, dp) => (num(dw) > 0 && num(dp) > 0 && dw <= dp ? dw * dw / (dp * dp) * 100 : NAN);
  const fillPct = (h, t) => (num(h) >= 0 && num(t) > 0 && h <= t ? h / t * 100 : NAN);
  const trimLen = (ueber, ziel) => (num(ueber) > 0 && num(ziel) > 0 && ueber > ziel ? ueber - ziel : NAN);
  const rampTime = (a, b, rate) => (num(a) >= 0 && num(b) > a && num(rate) > 0 ? (b - a) / rate : NAN);
  const perHundred = (err, n) => (num(err) >= 0 && num(n) > 0 ? err / n * 100 : NAN);
  const dpmo = (err, boards, per) => (num(err) >= 0 && num(boards) > 0 && num(per) > 0 ? err / (boards * per) * 1e6 : NAN);
  /* Pareto: Fehlerarten absteigend, mit Anteil und kumuliertem Anteil in % */
  function pareto(items) {
    if (!Array.isArray(items) || !items.length || !items.every(x => num(x.n) >= 0)) return null;
    const tot = items.reduce((s, x) => s + x.n, 0); if (!(tot > 0)) return null;
    let cum = 0; return items.slice().sort((a, b) => b.n - a.n).map(x => { cum += x.n; return { k: x.k, n: x.n, pct: x.n / tot * 100, cum: cum / tot * 100 }; });
  }
  const costTen = (n, stage, base) => (num(n) >= 0 && Number.isInteger(stage) && stage >= 0 && stage <= 4 && num(base) > 0 ? n * base * Math.pow(10, stage) : NAN);
  const strapMicroA = (U, Rm) => (num(U) > 0 && num(Rm) > 0 ? U / Rm : NAN);   /* V / MΩ = µA */
  const tauUs = (Rm, Cp) => (num(Rm) > 0 && num(Cp) > 0 ? Rm * Cp : NAN);   /* MΩ · pF = µs */
  const reworkMin = (n, sec, extra) => (num(n) >= 0 && num(sec) >= 0 && num(extra) >= 0 ? n * sec / 60 + extra : NAN);

  const API = { parseDe, fmtDe, fmtN, rd, num, clamp, hashStr, rng, ri, pick, shuffle,
    ALLOYS, T0, OVER, TAU, FLUX, LEV, LEVN, NAMEN, worst, padTemp, reachTime, lotLevel, thetaLevel, fillLevel, joint,
    RF, RFN, talSimple, timeAbove, tempAt, reflow, reflowState,
    smdOhm, solderMg, areaPct, fillPct, trimLen, rampTime, perHundred, dpmo, pareto, costTen, strapMicroA, tauUs, reworkMin };
  root.LOT_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
