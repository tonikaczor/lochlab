'use strict';
/* Tonfunk Regelkreis-Lab: reine Rechenlogik (Kennung 'rkr'). window.RKR_CORE bzw. module.exports.
   ALLE Zahlenwerte (Zeiten, Verstärkungen, Grenzen) sind ÜBUNGSWERTE für die Ausbildung, nicht für eine echte Anlage.
   Größen sind normiert: Regelgröße x, Führungsgröße w, Stellgröße y und Störgröße z in % (oder gleicher Einheit), Zeiten in s.
   Ungültige Eingaben (Division durch 0, fehlende Zahlen) liefern NaN, nie Infinity.
   Simulation: Zeitdiskret mit Schrittweite dt (Standard 10 ms). Verzögerungsglieder werden exakt je Schritt gerechnet (stabil), die Totzeit ist ein Verzögerungspuffer. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(°c|°|%|s|sek|sekunden|m\/s|m|v|a|kp|mm|min|k|k\/a|°c\/a|stück)$/i, '');
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

  /* ---------- Einfache Beziehungen ---------- */
  /* Regelabweichung e = w − x (Vorzeichen: positiv, wenn der Istwert unter dem Sollwert liegt) */
  /* PRUEFEN P1: Vorzeichen der Regelabweichung e = w − x (Führungsgröße minus Regelgröße, wie in DIN 19226 und der Mitschrift). Manche Bücher rechnen x − w. Welche Konvention gilt im Unterricht? */
  const diff = (w, x) => (fin(w) && fin(x) ? w - x : NAN);
  /* Übertragungsbeiwert der Strecke Ks = Δx / Δy */
  const ks = (dx, dy) => (fin(dx) && num(dy) !== 0 && fin(dy) ? dx / dy : NAN);
  /* Totzeit eines Förderbandes: Weg durch Geschwindigkeit */
  /* PRUEFEN P2: Totzeit Tt = Länge / Geschwindigkeit (Transportzeit zwischen Stellort und Messort, z. B. Förderband, Rohrleitung). Passt das Beispiel für den Unterricht? */
  const tt = (len, v) => (num(len) >= 0 && num(v) > 0 ? len / v : NAN);
  /* Proportionalbereich Xp in % = 100 % / Kp */
  /* PRUEFEN P3: Proportionalbereich Xp = 100 % / Kp (Eingangsbereich, der die Stellgröße über ihren ganzen Bereich fährt). Wird Xp im Unterricht so eingeführt? */
  const xp = Kp => (num(Kp) > 0 ? 100 / Kp : NAN);
  /* PT1-Sprungantwort: x(t) = Ks · Δu · (1 − e^(−t/T)) */
  const pt1 = (t, Ks, T, du) => (num(t) >= 0 && num(T) > 0 && fin(Ks) && fin(du) ? Ks * du * (1 - Math.exp(-t / T)) : NAN);
  /* Zeit, bis die PT1-Sprungantwort den Bruchteil frac ihres Endwertes erreicht (0 < frac < 1); frac = 0,632 gibt ca. T */
  const pt1Time = (frac, T) => (num(frac) > 0 && frac < 1 && num(T) > 0 ? -T * Math.log(1 - frac) : NAN);
  /* Regelbarkeit einer Strecke nach dem Verhältnis Verzugszeit Tu / Ausgleichszeit Tg */
  /* PRUEFEN P4: Grenzen für die Regelbarkeit: Tu/Tg kleiner 0,1 gut regelbar, 0,1 bis 0,3 noch regelbar (mäßig), größer 0,3 schlecht regelbar. Mitschrift ist an dieser Stelle schlecht lesbar; Werte nach gängiger Lehrbuchangabe. Stimmt das? */
  function regelbarkeit(Tu, Tg) {
    if (!(num(Tu) >= 0 && num(Tg) > 0)) return { ratio: NAN, urteil: '' };
    const r = Tu / Tg; return { ratio: r, urteil: r < 0.1 ? 'gut' : r <= 0.3 ? 'mäßig' : 'schlecht' };
  }

  /* ---------- Bleibende Regelabweichung (Strecke mit Ausgleich, Proportionalstrecke im Beharrungszustand) ---------- */
  /* P-Regler: x = Ks·Kp·w / (1 + Ks·Kp), e = w / (1 + Ks·Kp) */
  const bleibP = (w, Kp, Ks) => (fin(w) && num(Kp) >= 0 && num(Ks) >= 0 ? w / (1 + Kp * Ks) : NAN);
  const xEndP = (w, Kp, Ks) => (fin(w) && num(Kp) >= 0 && num(Ks) >= 0 ? w * Kp * Ks / (1 + Kp * Ks) : NAN);
  /* Mit Störgröße z (Sprung, wirkt additiv am Streckeneingang): x = Ks·(Kp·w + z) / (1 + Ks·Kp) */
  /* PRUEFEN P5: Die Störgröße z wirkt in diesem Modell additiv am Eingang der Strecke (gleiche Einheit wie die Stellgröße y, ohne Totzeit). In der Praxis greifen Störgrößen auch an anderen Stellen an (Streckenmitte, Ausgang). Ist das Modell fürs Üben ok? */
  const xEndPz = (w, z, Kp, Ks) => (fin(w) && fin(z) && num(Kp) >= 0 && num(Ks) >= 0 ? Ks * (Kp * w + z) / (1 + Ks * Kp) : NAN);
  const bleibPz = (w, z, Kp, Ks) => { const x = xEndPz(w, z, Kp, Ks); return fin(x) ? w - x : NAN; };

  /* ---------- Reglerverhalten ---------- */
  const NDF = 10; /* D-Anteil mit Filter: Tf = Tv / NDF */
  /* PRUEFEN P6: Reglergleichungen (ideale Form nach DIN): P: y = Kp·e · I: y = (1/Tn)·∫e dt (Tn = Integrierzeit) · PI: y = Kp·(e + 1/Tn·∫e dt) · PID: y = Kp·(e + 1/Tn·∫e dt + Tv·de/dt). In der Mitschrift/Lehrbuch heißt Kp teils K_PR oder K_R, Tn Nachstellzeit, Tv Vorhaltezeit. Entsprechen die Namen dem Unterricht? */
  /* PRUEFEN P7: Der D-Anteil wird in der Simulation durch ein Verzögerungsglied mit Tf = Tv/10 begrenzt (ein ideal differenzierender Regler hätte beim Sprung eine unendlich hohe Nadel). Der Faktor 10 ist ein Übungswert. Ist das für das 3.–4. Lehrjahr verständlich genug? */
  const REGLER = { P: 'P-Regler', I: 'I-Regler', PI: 'PI-Regler', PID: 'PID-Regler', '2P': 'Zweipunktregler' };
  /* Sprungantwort des Reglers auf einen Sprung der Regelabweichung der Höhe e0 (t > 0) */
  function ctrlStep(typ, Kp, Tn, Tv, t, e0) {
    e0 = e0 == null ? 1 : e0; if (!(num(t) >= 0) || !fin(e0)) return NAN;
    if (typ === 'P') return Kp * e0;
    if (typ === 'I') return num(Tn) > 0 ? e0 * t / Tn : NAN;
    if (typ === 'PI') return num(Tn) > 0 ? Kp * e0 * (1 + t / Tn) : NAN;
    if (typ === 'PID') { if (!(num(Tn) > 0) || !(num(Tv) >= 0)) return NAN; const Tf = Tv / NDF; return Kp * e0 * (1 + t / Tn + (Tf > 0 ? (Tv / Tf) * Math.exp(-t / Tf) : 0)); }
    return NAN;
  }
  /* Ausgang bei konstanter Regelabweichung e über die Zeit t (nur I-Anteil) */
  const iRamp = (e, Ti, t) => (fin(e) && num(Ti) > 0 && num(t) >= 0 ? e * t / Ti : NAN);
  /* Ausgang des idealen PID-Reglers bei linear steigender Regelabweichung e(t) = a·t (D-Anteil im Beharrungsanteil Tv·a) */
  const pidRamp = (Kp, Tn, Tv, a, t) => (fin(Kp) && num(Tn) > 0 && num(Tv) >= 0 && fin(a) && num(t) >= 0 ? Kp * (a * t + a * t * t / (2 * Tn) + Tv * a) : NAN);
  /* Einstellregel nach Ziegler und Nichols (Dauerschwingversuch): Kkrit und Tkrit am Rand der Stabilität */
  /* PRUEFEN P8: Einstellregeln nach Ziegler/Nichols: P: Kp = 0,5·Kkrit · PI: Kp = 0,45·Kkrit, Tn = 0,85·Tkrit · PID: Kp = 0,6·Kkrit, Tn = 0,5·Tkrit, Tv = 0,12·Tkrit (häufig genannte Lehrbuchwerte, in der Literatur gibt es Varianten, z. B. Tv = 0,125·Tkrit). Welche Werte gelten bei euch? */
  const ZN = { P: [0.5, 0, 0], PI: [0.45, 0.85, 0], PID: [0.6, 0.5, 0.12] };
  function zn(typ, Kkrit, Tkrit) {
    const z = ZN[typ]; if (!z || !(num(Kkrit) > 0) || !(num(Tkrit) > 0)) return { Kp: NAN, Tn: NAN, Tv: NAN };
    return { Kp: z[0] * Kkrit, Tn: z[1] ? z[1] * Tkrit : NAN, Tv: z[2] ? z[2] * Tkrit : NAN };
  }
  /* Kritische Einstellung (Dauerschwingung) für I-Regler an einer Strecke mit zwei Verzögerungen (PT2): Hurwitz-Bedingung.
     Kreisverstärkung K = Ks/Ti; bei K = (T1 + T2)/(T1·T2) steht der Kreis an der Stabilitätsgrenze, Kreisfrequenz ω = 1/√(T1·T2). */
  /* PRUEFEN P9: Rand der Stabilität eines I-Reglers an PT2 (Ti_krit = Ks·T1·T2/(T1+T2), Periodendauer 2π·√(T1·T2)) ist aus der Hurwitz-Bedingung abgeleitet und dient nur dazu, die Simulation sicher an die Stabilitätsgrenze zu setzen. Muss das im Unterricht erklärt werden oder reicht "Kp zu groß, Kreis schwingt"? */
  function critI2(Ks, T1, T2) {
    if (!(num(Ks) > 0 && num(T1) > 0 && num(T2) > 0)) return { Ti: NAN, period: NAN };
    return { Ti: Ks * T1 * T2 / (T1 + T2), period: 2 * Math.PI * Math.sqrt(T1 * T2) };
  }

  /* ---------- Zweipunktregler (ideal, Strecke PT1 mit Umgebungswert xa) ---------- */
  /* PRUEFEN P10: Zweipunktregler mit symmetrischer Schaltdifferenz um den Sollwert: unten schaltet er bei w − h/2 ein, oben bei w + h/2 aus (Schaltdifferenz h = Xsd, Schaltpunkte Xu und Xo in der Mitschrift). Bei realen Thermostaten kann die Lage der Schaltdifferenz anders sein. Passt das? */
  const schalt = (w, h) => (fin(w) && num(h) >= 0 ? { xo: w + h / 2, xu: w - h / 2 } : { xo: NAN, xu: NAN });
  /* Schwankung und Periodendauer im eingeschwungenen Schaltspiel. Ks·yh = Endwert bei EIN (xinf), xa = Endwert bei AUS (Umgebung), T Zeitkonstante, Tt Totzeit (Verzugszeit der Mitschrift) */
  /* PRUEFEN P11: Formeln für Schwankung und Periodendauer des Zweipunktreglers: x_max = xinf − (xinf − xo)·e^(−Tt/T), x_min = xa + (xu − xa)·e^(−Tt/T). Die Verzugszeit Tu der Mitschrift wird hier als Totzeit Tt nachgebildet (Näherung). Ist das vertretbar? */
  function zweipunkt(w, h, xinf, xa, T, Tt) {
    if (!(fin(w) && num(h) >= 0 && fin(xinf) && fin(xa) && num(T) > 0 && num(Tt) >= 0)) return { xmax: NAN, xmin: NAN, swing: NAN, period: NAN, tOn: NAN, tOff: NAN, duty: NAN, mean: NAN };
    const xo = w + h / 2, xu = w - h / 2;
    if (!(xinf > xo && xa < xu)) return { xmax: NAN, xmin: NAN, swing: NAN, period: NAN, tOn: NAN, tOff: NAN, duty: NAN, mean: NAN };
    const q = Math.exp(-Tt / T), xmax = xinf - (xinf - xo) * q, xmin = xa + (xu - xa) * q;
    const t1 = T * Math.log((xinf - xmin) / (xinf - xo)), t2 = T * Math.log((xmax - xa) / (xu - xa));
    const tOn = t1 + Tt, tOff = t2 + Tt, period = tOn + tOff;
    return { xmax, xmin, swing: xmax - xmin, period, tOn, tOff, duty: tOn / period, mean: (xmax + xmin) / 2 };
  }

  /* ---------- Simulation des Regelkreises ---------- */
  const DEF = { reg: 'P', Kp: 1, Tn: 5, Tv: 0, h: 4, yh: 100, xa: 0, str: 'PT1', Ks: 1, T1: 2, T2: 1, Tt: 0, w: 1, z: 0, tz: 0, tEnd: 30, dt: 0.01 };
  /* reg: 'offen' (Sprung direkt auf die Strecke), 'P', 'I', 'PI', 'PID', '2P'; str: 'PT1', 'PT2' (zwei Verzögerungen T1 und T2), 'I' (Strecke ohne Ausgleich, Ks in 1/s) */
  /* PRUEFEN P12: Die Strecke ohne Ausgleich (I-Strecke, z. B. Füllstand eines Behälters) hat hier den Übertragungsbeiwert Ks in 1/s: x' = Ks·u. Reicht diese Idealisierung für den Unterricht? */
  function simulate(cfg) {
    const c = Object.assign({}, DEF, cfg), dt = c.dt, n = Math.round(c.tEnd / dt) + 1, k = Math.max(0, Math.round(c.Tt / dt));
    const t = new Array(n), x = new Array(n), y = new Array(n), e = new Array(n), yb = new Array(n);
    const a1 = c.T1 > 0 ? 1 - Math.exp(-dt / c.T1) : 1, a2 = c.T2 > 0 ? 1 - Math.exp(-dt / c.T2) : 1;
    const Tf = c.Tv > 0 ? c.Tv / NDF : 0, af = Tf > 0 ? 1 - Math.exp(-dt / Tf) : 1;
    let x1 = 0, x2 = 0, integ = 0, ef = 0, on = false;
    const CL = 1e12;
    for (let i = 0; i < n; i++) {
      const ti = i * dt, xi = c.str === 'PT2' ? x2 : x1;
      const zi = c.z && ti >= c.tz - 1e-9 ? c.z : 0;
      const ei = c.reg === 'offen' ? 0 : c.w - xi;
      let yi;
      if (c.reg === 'offen') yi = c.w;
      else if (c.reg === 'P') yi = c.Kp * ei;
      else if (c.reg === 'I') { integ += ei * dt; yi = integ / c.Tn; }
      else if (c.reg === 'PI') { integ += ei * dt; yi = c.Kp * (ei + integ / c.Tn); }
      else if (c.reg === 'PID') { integ += ei * dt; ef += af * (ei - ef); yi = c.Kp * (ei + integ / c.Tn + (Tf > 0 ? c.Tv * (ei - ef) / Tf : 0)); }
      else { if (xi <= c.w - c.h / 2) on = true; else if (xi >= c.w + c.h / 2) on = false; yi = on ? c.yh : 0; }
      yb[i] = yi;
      const u = (i - k >= 0 ? yb[i - k] : 0) + zi;
      t[i] = ti; x[i] = xi; y[i] = yi; e[i] = ei;
      if (c.str === 'PT2') { x1 += a1 * (c.Ks * u - x1); x2 += a2 * (x1 - x2); }
      else if (c.str === 'I') x1 += c.Ks * u * dt;
      else x1 += a1 * (c.Ks * u - x1);
      if (c.str === 'PT2') { if (x2 > CL) x2 = CL; else if (x2 < -CL) x2 = -CL; if (x1 > CL) x1 = CL; else if (x1 < -CL) x1 = -CL; }
      else { if (x1 > CL) x1 = CL; else if (x1 < -CL) x1 = -CL; }
    }
    return { cfg: c, t, x, y, e, dt };
  }
  /* Beharrungswert der Regelgröße nach Sollwert- und Störsprung (nur für stabile lineare Kreise sinnvoll) */
  function equil(c) {
    c = Object.assign({}, DEF, c);
    if (c.reg === 'offen') return c.str === 'I' ? NAN : c.Ks * (c.w + c.z);
    if (c.reg === '2P') return c.w;
    if (c.reg === 'P') return c.str === 'I' ? c.w + c.z / c.Kp : xEndPz(c.w, c.z, c.Kp, c.Ks);
    return c.w;
  }
  const mean = (a, i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) s += a[i]; return s / Math.max(1, i1 - i0); };
  /* Kennwerte einer Simulation (Regelkreis mit P, I, PI, PID) */
  /* PRUEFEN P13: Definitionen: Überschwingweite ü = (x_max − x_end) / x_end · 100 %, Anregelzeit = erstes Erreichen des Sollwerts, Ausregelzeit = letzter Zeitpunkt außerhalb des Bandes ±2 % von w um den Endwert. Manche Bücher nehmen ±5 % oder beziehen ü auf die Sprunghöhe. Welche Definitionen gelten im Unterricht? */
  /* PRUEFEN P14: Das Stabilitätsurteil der Simulation ist eine Näherung: Verhältnis aufeinanderfolgender Schwingungsspitzen kleiner 0,93 = stabil, 0,93 bis 1,07 = grenzstabil (Dauerschwingung), größer 1,07 = instabil. Reicht diese Einteilung für die Ausbildung? */
  function analyse(S) {
    const c = S.cfg, n = S.x.length, w = c.w, tail = Math.max(2, Math.floor(n * 0.05));
    const xend = mean(S.x, n - tail, n), xref = equil(c);
    let xmax = -Infinity, xmin = Infinity, tan = null, tmaxIdx = 0;
    for (let i = 0; i < n; i++) { const v = S.x[i]; if (v > xmax) { xmax = v; tmaxIdx = i; } if (v < xmin) xmin = v; if (tan === null && w > 0 && v >= w - 1e-9) tan = S.t[i]; }
    /* Ist der Kreis (fast) eingeschwungen, gilt der rechnerische Beharrungswert als Endwert, sonst der Mittelwert am Ende */
    const xe = fin(xref) && Math.abs(xend - xref) < 0.03 * Math.abs(w) ? xref : xend;
    const ebl = w - xe, ueb = xe > 1e-9 ? Math.max(0, (xmax - xe) / xe * 100) : 0;
    let taus = null; const bandW = 0.02 * Math.abs(w);
    if (fin(xe)) { let last = -1; for (let i = 0; i < n; i++) if (Math.abs(S.x[i] - xe) > bandW + 1e-9) last = i; taus = last < 0 ? 0 : last >= n - 1 ? null : S.t[last + 1]; }
    /* Schwingungsspitzen um den Beharrungswert */
    const ref = fin(xref) ? xref : xend, thr = Math.max(1e-3 * Math.abs(w), 1e-9), ext = [];
    let dir = 0;
    for (let i = 1; i < n - 1; i++) {
      const d0 = S.x[i] - S.x[i - 1], d1 = S.x[i + 1] - S.x[i];
      if (d0 > 0 && d1 <= 0 || d0 < 0 && d1 >= 0) { const dv = S.x[i] - ref; if (Math.abs(dv) > thr && (!ext.length || Math.sign(dv) !== Math.sign(ext[ext.length - 1].dv))) ext.push({ t: S.t[i], dv }); else if (ext.length && Math.sign(dv) === Math.sign(ext[ext.length - 1].dv) && Math.abs(dv) > Math.abs(ext[ext.length - 1].dv)) ext[ext.length - 1] = { t: S.t[i], dv }; }
      dir = d1;
    }
    let ratio = NAN, period = NAN, stab = 'stabil';
    if (ext.length >= 4) {
      const m = ext.length, r = Math.abs(ext[m - 1].dv) / Math.abs(ext[m - 3].dv); ratio = r;
      period = (ext[m - 1].t - ext[m - 3].t);
      stab = r < 0.93 ? 'stabil' : r <= 1.07 ? 'grenzstabil' : 'instabil';
    } else if (ext.length >= 2) {
      const m = ext.length; ratio = Math.abs(ext[m - 1].dv) / Math.abs(ext[m - 2].dv);
      stab = Math.abs(ext[m - 1].dv) > 5 * Math.abs(w) ? 'instabil' : 'stabil';
    }
    if (Math.abs(S.x[n - 1] - ref) > 5 * Math.abs(w) + 1) stab = 'instabil';
    return { xend: xe, xref, ebl, xmax, xmin, tmax: S.t[tmaxIdx], ueb, tan, taus, ext: ext.length, ratio, period, stab };
  }
  /* Kennwerte eines Zweipunktreglers aus der Simulation (zweite Hälfte der Zeit) */
  function analyse2P(S) {
    const n = S.x.length, i0 = Math.floor(n / 2); let mx = -Infinity, mn = Infinity; const ons = [];
    for (let i = i0; i < n; i++) { if (S.x[i] > mx) mx = S.x[i]; if (S.x[i] < mn) mn = S.x[i]; if (i > i0 && S.y[i] > 0 && S.y[i - 1] <= 0) ons.push(S.t[i]); }
    let period = NAN; if (ons.length >= 2) period = (ons[ons.length - 1] - ons[0]) / (ons.length - 1);
    let hi = 0; for (let i = i0; i < n; i++) if (S.y[i] > 0) hi++;
    return { xmax: mx, xmin: mn, swing: mx - mn, mean: (mx + mn) / 2, period, duty: hi / Math.max(1, n - i0), switches: ons.length };
  }

  const API = { parseDe, fmtDe, fmtN, rd, num, ceilN, hashStr, rng, ri, pick, shuffle,
    diff, ks, tt, xp, pt1, pt1Time, regelbarkeit, bleibP, xEndP, xEndPz, bleibPz,
    NDF, REGLER, ctrlStep, iRamp, pidRamp, ZN, zn, critI2, schalt, zweipunkt,
    DEF, simulate, equil, analyse, analyse2P };
  root.RKR_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
