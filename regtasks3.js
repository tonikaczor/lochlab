/* regtasks3.js - Regelungstechnik-Lab: Einsteiger-Aufgaben rg31 bis rg47 (Grundlagen, Kurven ablesen, Totzeit und Ordnung, Reglerkennlinie, Stabilität, Störung und Führung)
 * und rg48 bis rg53 (Berufsschulstoff Lernfeld 7.2: Übertragungsbeiwert, Zweipunktregler mit Schwankungsbreite, Streckenarten, Größen am Drehzahlregelkreis).
 * Stammt aus dem früheren Regelkreis-Lab (rkr), das in dieses Lab eingearbeitet wurde; übernommen sind nur Themen, die rg1 bis rg30 nicht schon haben.
 * Meldet sich mit REG_TASKS.register([...]) bei regdata.js an (Registry und Hilfsfunktionen in REG_TASKS.util). Läuft ohne Browser.
 * Form wie regtasks1.js und regtasks2.js: { id, lab:'reg', cat, title, level, rig:'', text, hint[3], start(), sol(), check(answer), hintVals(), fields?, choices?, figure? }.
 *   rig ist leer (Rechner-Aufgaben wie rg23): Sie brauchen keinen Prüfstand, die Antworten gehen über fields (Zahlen) und choices (Auswahl).
 *   figure() liefert die Kurven, die die Oberfläche unter dem Aufgabentext zeichnet (regui-lesen.js): { caption?, panels:[{ title, tMax, yLabel, series:[{ name, kind, pts }], band?, clip? }] }.
 * Die Kurven kommen aus dem kleinen Rechenkern REG_TASKS.kurve (zeitdiskrete Simulation von PT1, PT2 und I-Strecke mit P-, I-, PI-, PID-Regler und Totzeit);
 *   er ist unabhängig von den Prüfständen, damit die Aufgaben jederzeit gleiche Kurven liefern (kein Zufall, feste Zahlen).
 * Regeln wie in regtasks1.js: (1) Zahlen in hint[1], hint[2] stammen aus hintVals() (Audit REG_TASKS.audit). (2) Prüfzeilen sagen nur, was geprüft wurde.
 *   (3) Verdeckte-Fehler-Prinzip: Titel und Texte verraten weder Ergebnis noch Ursache; sie müssen am Diagramm gefunden werden.
 * ALLE ZAHLENWERTE SIND ÜBUNGSWERTE, keine echte Anlage. Unsichere fachliche Stellen sind mit PRUEFEN Pn markiert (Liste: quelle/reg/PRUEFEN-rkr-Einsteiger.md). */
(function (root) {
  'use strict';
  if (!root.REG_TASKS && typeof require === 'function') { try { require('./regdata.js'); } catch (e) { /* ohne regdata.js keine Registry */ } }
  const T = root.REG_TASKS;
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('regtasks3.js: regdata.js fehlt, Aufgaben nicht registriert.'); return; }
  const U = T.util, fm = U.fm, fin = U.fin, isObj = U.isObj;

  /* ====================================================================== Rechenkern für Kurven */
  const K = (function () {
    const NAN = NaN, num = v => (typeof v === 'number' && isFinite(v) ? v : NAN);
    /* PRUEFEN P7: Der D-Anteil wird mit einem Verzögerungsglied Tf = Tv/10 begrenzt (ein ideal differenzierender Regler hätte beim Sprung eine unendlich hohe Nadel). Faktor 10 = Übungswert. Für das 3. bis 4. Lehrjahr verständlich genug? */
    const NDF = 10;
    /* PRUEFEN P5: Die Störgröße z wirkt in diesem Modell additiv am Eingang der Strecke (gleiche Einheit wie die Stellgröße y, hinter der Totzeit des Stellwegs). In der Praxis greifen Störungen auch an anderen Stellen an. Reicht das fürs Üben? */
    const DEF = { reg: 'P', Kp: 1, Tn: 5, Tv: 0, str: 'PT1', Ks: 1, T1: 2, T2: 1, Tt: 0, w: 1, w0: 0, tw: 0, z: 0, tz: 0, tEnd: 30, dt: 0.01, eq: false };
    /* cfg: reg 'offen' (Sprung w direkt auf die Strecke), 'P', 'I', 'PI', 'PID'; str 'PT1', 'PT2' (T1, T2), 'I'; Tt Totzeit; w Sollwert (ab tw, vorher w0); z Störsprung ab tz;
       eq: Start im eingeschwungenen Zustand beim Sollwert w0 (nur I, PI, PID). Ergebnis { cfg, t[], x[], y[], e[], w[], dt } */
    function simulate(cfg) {
      const c = Object.assign({}, DEF, cfg), dt = c.dt, n = Math.round(c.tEnd / dt) + 1, k = Math.max(0, Math.round(c.Tt / dt));
      const t = new Array(n), x = new Array(n), y = new Array(n), e = new Array(n), wv = new Array(n), yb = new Array(n);
      const a1 = c.T1 > 0 ? 1 - Math.exp(-dt / c.T1) : 1, a2 = c.T2 > 0 ? 1 - Math.exp(-dt / c.T2) : 1;
      const Tf = c.Tv > 0 ? c.Tv / NDF : 0, af = Tf > 0 ? 1 - Math.exp(-dt / Tf) : 1;
      let x1 = 0, x2 = 0, integ = 0, ef = 0, yPre = 0;
      if (c.eq) {
        x1 = x2 = c.w0; yPre = c.w0 / c.Ks;
        if (c.reg === 'I') integ = yPre * c.Tn; else if (c.reg === 'PI' || c.reg === 'PID') integ = yPre * c.Tn / c.Kp;
      }
      const CL = 1e12;
      for (let i = 0; i < n; i++) {
        const ti = i * dt, xi = c.str === 'PT2' ? x2 : x1;
        const zi = c.z && ti >= c.tz - 1e-9 ? c.z : 0, wi = c.tw > 0 && ti < c.tw - 1e-9 ? c.w0 : c.w;
        const ei = c.reg === 'offen' ? 0 : wi - xi;
        let yi;
        if (c.reg === 'offen') yi = c.w;
        else if (c.reg === 'P') yi = c.Kp * ei;
        else if (c.reg === 'I') { integ += ei * dt; yi = integ / c.Tn; }
        else if (c.reg === 'PI') { integ += ei * dt; yi = c.Kp * (ei + integ / c.Tn); }
        else { integ += ei * dt; ef += af * (ei - ef); yi = c.Kp * (ei + integ / c.Tn + (Tf > 0 ? c.Tv * (ei - ef) / Tf : 0)); }
        yb[i] = yi;
        const u = (i - k >= 0 ? yb[i - k] : yPre) + zi;
        t[i] = ti; x[i] = xi; y[i] = yi; e[i] = ei; wv[i] = wi;
        if (c.str === 'PT2') { x1 += a1 * (c.Ks * u - x1); x2 += a2 * (x1 - x2); }
        else if (c.str === 'I') x1 += c.Ks * u * dt;
        else x1 += a1 * (c.Ks * u - x1);
        if (x1 > CL) x1 = CL; else if (x1 < -CL) x1 = -CL; if (x2 > CL) x2 = CL; else if (x2 < -CL) x2 = -CL;
      }
      return { cfg: c, t, x, y, e, w: wv, dt };
    }
    /* Sprungantwort des Reglers auf einen Sprung der Regelabweichung der Höhe e0 bei t = 0 (Wert für t > 0) */
    /* PRUEFEN P6: Reglergleichungen in idealer Form: P: y = Kp·e, I: y = (1/Tn)·∫e dt (hier Tn auch als Integrierzeit), PI: y = Kp·(e + 1/Tn·∫e dt), PID: y = Kp·(e + 1/Tn·∫e dt + Tv·de/dt). Entsprechen Kp, Tn (Nachstellzeit), Tv (Vorhaltezeit) dem Unterricht (teils K_PR, K_R)? */
    function ctrlStep(typ, Kp, Tn, Tv, t, e0) {
      e0 = e0 == null ? 1 : e0; if (!(num(t) >= 0) || !isFinite(e0)) return NAN;
      if (typ === 'P') return Kp * e0;
      if (typ === 'I') return num(Tn) > 0 ? e0 * t / Tn : NAN;
      if (typ === 'PI') return num(Tn) > 0 ? Kp * e0 * (1 + t / Tn) : NAN;
      if (typ === 'PID') { if (!(num(Tn) > 0) || !(num(Tv) >= 0)) return NAN; const Tf = Tv / NDF; return Kp * e0 * (1 + t / Tn + (Tf > 0 ? (Tv / Tf) * Math.exp(-t / Tf) : 0)); }
      return NAN;
    }
    /* PT1-Sprungantwort: x(t) = Ks · Δu · (1 − e^(−t/T)) */
    const pt1 = (t, Ks, T, du) => (num(t) >= 0 && num(T) > 0 && isFinite(Ks) && isFinite(du) ? Ks * du * (1 - Math.exp(-t / T)) : NAN);
    /* Totzeit eines Förderbandes: Tt = Länge / Geschwindigkeit */
    const tt = (len, v) => (num(len) >= 0 && num(v) > 0 ? len / v : NAN);
    /* PRUEFEN P4: Regelbarkeit nach dem Verhältnis Tg/Tu, in der Konvention dieses Labs (REG_CORE.fitStep): über 10 gut, 3 bis 10 noch regelbar, unter 3 schwer regelbar.
       Das frühere rkr-Lab rechnete Tu/Tg mit den Grenzen 0,1 und 0,3 (fast dasselbe). Welche Grenzen gelten im Unterricht? */
    const regelbar = (Tu, Tg) => { const r = num(Tg) > 0 && num(Tu) > 0 ? Tg / Tu : NAN; return { ratio: r, urteil: !isFinite(r) ? '' : r > 10 ? 'gut' : r >= 3 ? 'noch' : 'schwer' }; };
    /* Rand der Stabilität eines I-Reglers an PT2: Ti_krit = Ks·T1·T2/(T1+T2), Periodendauer 2π·√(T1·T2) (Hurwitz) */
    /* PRUEFEN P9: Diese Grenze ist nur aus der Hurwitz-Bedingung abgeleitet, um die Kurven gezielt an die Stabilitätsgrenze zu setzen. Muss das im Unterricht erklärt werden oder reicht "Verstärkung zu groß, Kreis schwingt"? */
    const critI2 = (Ks, T1, T2) => ({ Ti: Ks * T1 * T2 / (T1 + T2), period: 2 * Math.PI * Math.sqrt(T1 * T2) });
    const xEnd = c => { c = Object.assign({}, DEF, c); return c.reg === 'offen' ? (c.str === 'I' ? NAN : c.Ks * c.w) : c.reg === 'P' ? c.w * c.Kp * c.Ks / (1 + c.Kp * c.Ks) : c.w; };
    const mean = (a, i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) s += a[i]; return s / Math.max(1, i1 - i0); };
    /* Kennwerte eines Kreises mit einem Sollwertsprung bei t = 0 (kein eq) */
    /* PRUEFEN P13: Definitionen: Überschwingweite ü = (x_max − x_end) / x_end · 100 %, Ausregelzeit = Zeitpunkt, ab dem x dauerhaft im Band ±2 % von w um den Endwert bleibt. Manche Bücher nehmen ±5 % oder beziehen ü auf die Sprunghöhe. Welche Definitionen gelten im Unterricht? */
    /* PRUEFEN P14: Das Stabilitätsurteil ist eine Näherung: Verhältnis aufeinanderfolgender Schwingungsspitzen (gleiche Richtung) kleiner 0,93 = stabil, bis 1,07 = grenzstabil (Dauerschwingung), darüber instabil. Reicht diese Einteilung für die Ausbildung? */
    function analyse(S) {
      const c = S.cfg, n = S.x.length, w = c.w, tail = Math.max(2, Math.floor(n * 0.05));
      const xend = mean(S.x, n - tail, n), xref = xEnd(c);
      let xmax = -Infinity, tmaxIdx = 0;
      for (let i = 0; i < n; i++) { const v = S.x[i]; if (v > xmax) { xmax = v; tmaxIdx = i; } }
      const xe = isFinite(xref) && Math.abs(xend - xref) < 0.03 * Math.abs(w) ? xref : xend;
      const ueb = xe > 1e-9 ? Math.max(0, (xmax - xe) / xe * 100) : 0, bandW = 0.02 * Math.abs(w);
      let last = -1; for (let i = 0; i < n; i++) if (Math.abs(S.x[i] - xe) > bandW + 1e-9) last = i;
      const taus = last < 0 ? 0 : last >= n - 1 ? null : S.t[last + 1];
      const ref = isFinite(xref) ? xref : xend, thr = Math.max(1e-3 * Math.abs(w), 1e-9), ext = [];
      for (let i = 1; i < n - 1; i++) {
        const d0 = S.x[i] - S.x[i - 1], d1 = S.x[i + 1] - S.x[i];
        if (d0 > 0 && d1 <= 0 || d0 < 0 && d1 >= 0) {
          const dv = S.x[i] - ref, lastE = ext[ext.length - 1];
          if (Math.abs(dv) > thr && (!lastE || Math.sign(dv) !== Math.sign(lastE.dv))) ext.push({ t: S.t[i], dv });
          else if (lastE && Math.sign(dv) === Math.sign(lastE.dv) && Math.abs(dv) > Math.abs(lastE.dv)) ext[ext.length - 1] = { t: S.t[i], dv };
        }
      }
      let ratio = NAN, stab = 'stabil';
      if (ext.length >= 4) { const m = ext.length, r = Math.abs(ext[m - 1].dv) / Math.abs(ext[m - 3].dv); ratio = r; stab = r < 0.93 ? 'stabil' : r <= 1.07 ? 'grenzstabil' : 'instabil'; }
      else if (ext.length >= 2) { const m = ext.length; ratio = Math.abs(ext[m - 1].dv) / Math.abs(ext[m - 2].dv); stab = Math.abs(ext[m - 1].dv) > 5 * Math.abs(w) ? 'instabil' : 'stabil'; }
      if (Math.abs(S.x[n - 1] - ref) > 5 * Math.abs(w) + 1) stab = 'instabil';
      return { xend: xe, xmax, tmax: S.t[tmaxIdx], ueb, taus, ratio, stab };
    }
    /* erstes t >= t0, ab dem x um mehr als tol vom Wert bei t0 abweicht (Beginn der Wirkung); NaN wenn nie */
    function onset(S, t0, tol) {
      const i0 = Math.round(t0 / S.dt), x0 = S.x[i0]; for (let i = i0; i < S.x.length; i++) if (Math.abs(S.x[i] - x0) > tol) return S.t[i]; return NAN;
    }
    return { DEF, simulate, ctrlStep, pt1, tt, regelbar, critI2, analyse, onset, xEnd, NDF };
  })();
  T.kurve = K;

  /* ====================================================================== gemeinsame Hilfen */
  const hv = (t, fn) => U.memo(t, 'vals', fn);
  const hn = (t, fn) => { const h = U.memo(t, 'hint', () => fn(t.hintVals())); return Array.isArray(h) ? h : ['Der Hinweis konnte nicht gerechnet werden.', 'Der Hinweis konnte nicht gerechnet werden.', 'Der Lösungsweg konnte nicht gerechnet werden.']; };
  const fg = (t, fn) => U.memo(t, 'fig', fn);
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);
  const fieldNum = (a, k) => U.fieldNum(a, k);
  const sameChoice = (v, right) => v !== undefined && v !== null && String(v) === String(right);
  /* Prüfung bauen: fn(r, a) schreibt Zeilen mit r(bedingung, text, warum); wirft nie */
  const mk = fn => function (a) {
    try {
      const rows = [], r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || '') }); };
      fn(r, isObj(a) ? a : {});
      if (!rows.length) rows.push({ ok: false, text: 'Die Prüfung hat nichts geprüft', why: 'Bitte melde das deinem Ausbilder.' });
      return rows;
    } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
  };
  /* Zahl prüfen: tol absolut; mistakes = [[Wert, Text], ...] typische Fehler (gleiche Toleranz) */
  function numRow(r, label, v, want, tol, mistakes, unit) {
    const tx = ' (erlaubte Abweichung ± ' + fm(tol, tol < 1 ? 2 : 1) + (unit ? ' ' + unit : '') + ')';
    if (!fin(v)) { r(false, label + tx, 'Trage hier eine Zahl ein (Komma oder Punkt).'); return false; }
    const ok = Math.abs(v - want) <= tol + 1e-9;
    let why = '';
    if (!ok) { const hit = (mistakes || []).find(m => fin(m[0]) && Math.abs(v - m[0]) <= tol + 1e-9); why = hit ? hit[1] : 'Dein Wert ' + fm(v, 2) + ' ist ' + (v < want ? 'zu klein' : 'zu groß') + '. Prüfe das Ablesen oder die Rechnung noch einmal.'; }
    r(ok, label + tx, why);
    return ok;
  }
  /* Auswahlaufgaben: items [{ key, name, q, opts:[[Wert, Beschriftung]], right, why }] */
  function quiz(items) {
    return {
      choices: items.map(it => ({ key: it.key, q: it.q, options: it.opts.map(o => ({ value: o[0], label: o[1] })) })),
      sol: () => { const o = {}; items.forEach(it => { o[it.key] = it.right; }); return o; },
      rows(r, a) { items.forEach(it => { const v = choiceOf(a, it.key); r(sameChoice(v, it.right), it.name + ': Die Zuordnung stimmt', v === undefined || v === null ? 'Wähle eine Antwort.' : it.why); }); }
    };
  }
  const S = (extra) => Object.assign({ rig: '', controls: {} }, extra || {});
  const nulls = keys => { const o = {}; keys.forEach(k => { o[k] = null; }); return o; };
  const dec = (S0, key, maxN) => { const n = S0.t.length, st = Math.max(1, Math.floor(n / (maxN || 400))), out = []; for (let i = 0; i < n; i += st) out.push([S0.t[i], S0[key][i]]); if ((n - 1) % st) out.push([S0.t[n - 1], S0[key][n - 1]]); return out; };
  const wPts = c => (c.tw > 0 ? [[0, c.w0], [c.tw, c.w0], [c.tw, c.w], [c.tEnd, c.w]] : [[0, c.w], [c.tEnd, c.w]]);
  /* Diagramm einer Strecke ohne Regler (Sprung am Eingang) bzw. eines Regelkreises */
  function openPanel(title, cfg) {
    const S0 = K.simulate(Object.assign({ reg: 'offen' }, cfg)), c = S0.cfg;
    return { title, tMax: c.tEnd, yLabel: 'in %', series: [{ name: 'Regelgröße x', kind: 'x', pts: dec(S0, 'x') }, { name: 'Sprung der Stellgröße y', kind: 'y', pts: [[0, 0], [0, c.w], [c.tEnd, c.w]] }] };
  }
  function closedPanel(title, cfg, o) {
    o = o || {}; const S0 = K.simulate(cfg), c = S0.cfg;
    const p = { title, tMax: c.tEnd, yLabel: 'in %', series: [{ name: 'Regelgröße x', kind: 'x', pts: dec(S0, 'x') }, { name: 'Sollwert w', kind: 'w', pts: wPts(c) }] };
    if (o.band) p.band = [c.w * 0.98, c.w * 1.02];
    if (o.clip) p.clip = { lo: -0.5 * Math.abs(c.w), hi: 3 * Math.abs(c.w) };
    if (o.y) { p.yMin = o.y[0]; p.yMax = o.y[1]; }
    return p;
  }
  function ctrlPanel(title, typ, c) {
    const ts = []; for (let i = 0; i <= 300; i++) ts.push(c.tEnd * i / 300);
    if (typ === 'PID') { const Tf = c.Tv / K.NDF; for (let i = 0; i < 40; i++) { const t = Tf * 0.15 * i; if (t < c.tEnd) ts.push(t); } }
    ts.sort((p, q) => p - q);
    const y = [[0, 0]]; ts.forEach(t => y.push([t, K.ctrlStep(typ, c.Kp, c.Tn, c.Tv, t, c.e0)]));
    return { title, tMax: c.tEnd, yLabel: 'in %', yMin: 0, yMax: c.yMax, series: [{ name: 'Regelabweichung e', kind: 'e', pts: [[0, 0], [0, c.e0], [c.tEnd, c.e0]] }, { name: 'Stellgröße y', kind: 'y', pts: y }] };
  }

  /* ====================================================================== rg31 Steuerung oder Regelung */
  /* PRUEFEN P15: Einteilung der Beispiele in Steuerung (offener Wirkungsablauf, keine Rückmeldung des Istwerts) und Regelung (geschlossener Wirkungsablauf nach DIN 19226). Passen die Alltagsbeispiele zum Unterricht? */
  /* PRUEFEN P20: Die Antwort "Weder noch" (reine Anzeige, hier: Manometer) ist neu gegenüber dem früheren rkr-Lab. Ist eine reine Anzeige für Azubis ein sinnvoller dritter Fall? */
  const OPT31 = [['R', 'Regelung (der Istwert wird zurückgemeldet)'], ['S', 'Steuerung (keine Rückmeldung des Istwerts)'], ['W', 'Weder noch: Es wird nur ein Wert angezeigt']];
  const Q31 = quiz([
    { key: 's1', name: 'Raumthermostat', q: 'Ein Raumthermostat misst die Raumtemperatur und öffnet oder schließt das Heizkörperventil, bis die Wunschtemperatur erreicht ist.', opts: OPT31, right: 'R', why: 'Der Thermostat misst den Istwert (Raumtemperatur) und vergleicht ihn mit dem Sollwert. Er beeinflusst die Heizung so lange, bis beide übereinstimmen: geschlossener Wirkungsablauf, also eine Regelung.' },
    { key: 's2', name: 'Scheibenwischer', q: 'Ein Scheibenwischer läuft in Stufe 2 immer gleich schnell, egal wie nass die Scheibe ist.', opts: OPT31, right: 'S', why: 'Die Wischgeschwindigkeit hängt nicht davon ab, wie nass die Scheibe ist. Es gibt keine Rückmeldung des Istwerts: offener Wirkungsablauf, also eine Steuerung.' },
    { key: 's3', name: 'Tempomat', q: 'Ein Tempomat hält die Fahrzeuggeschwindigkeit auch am Berg konstant, indem er die Motorleistung nachführt.', opts: OPT31, right: 'R', why: 'Die Geschwindigkeit wird gemessen und mit der Wunschgeschwindigkeit verglichen. Weicht sie ab, ändert der Regler die Motorleistung: eine Regelung. Der Berg ist die Störgröße.' },
    { key: 's4', name: 'Treppenhauslicht', q: 'Das Treppenhauslicht wird mit einem Zeitrelais nach zwei Minuten abgeschaltet, auch wenn noch jemand im Treppenhaus ist.', opts: OPT31, right: 'S', why: 'Das Relais schaltet nach fester Zeit ab und misst nicht, ob noch jemand im Treppenhaus ist. Ohne Rückmeldung ist das eine Steuerung.' },
    { key: 's5', name: 'Drehzahl mit Tachogenerator', q: 'Die Drehzahl eines Gleichstrommotors wird mit einem Tachogenerator gemessen und über einen Thyristorsteller so nachgeführt, dass sie bei Belastung konstant bleibt.', opts: OPT31, right: 'R', why: 'Der Tachogenerator meldet die Ist-Drehzahl zurück, der Regler vergleicht sie mit dem Sollwert und stellt den Thyristorsteller nach: ein Regelkreis.' },
    { key: 's6', name: 'Manometer', q: 'Ein Manometer am Druckbehälter zeigt den Druck an. Eine Einrichtung, die etwas nachstellt, gibt es nicht.', opts: OPT31, right: 'W', why: 'Das Manometer zeigt den Istwert nur an und greift nirgends ein. Es gibt weder einen Regelkreis noch eine Steuerkette, die auf eine Anlage wirkt.' }
  ]);
  const check31 = mk((r, a) => { Q31.rows(r, a); });

  /* ====================================================================== rg32 Größen benennen */
  const OPT32 = [['x', 'Regelgröße x'], ['w', 'Führungsgröße w'], ['y', 'Stellgröße y'], ['z', 'Störgröße z'], ['e', 'Regelabweichung e']];
  const EXPL32 = 'Merke: x Regelgröße (wird gemessen), w Führungsgröße (Sollwert vom Bediener), y Stellgröße (Ausgang des Reglers), z Störgröße (wirkt von außen), e = w − x Regelabweichung.';
  const Q32 = quiz([
    { key: 'g1', name: 'Größe 1', q: 'Die Größe, die der Kreis konstant halten soll und die gemessen wird, zum Beispiel die Raumtemperatur.', opts: OPT32, right: 'x', why: 'Gemeint ist die Regelgröße x. ' + EXPL32 },
    { key: 'g2', name: 'Größe 2', q: 'Bei einem Raumthermostat wird der Drehknopf von 20 °C auf 22 °C gestellt. Welche Größe ändert sich dadurch zuerst?', opts: OPT32, right: 'w', why: 'Der Bediener verändert den Sollwert: Das ist die Führungsgröße w. ' + EXPL32 },
    { key: 'g3', name: 'Größe 3', q: 'Während des Heizens wird ein Fenster geöffnet, kalte Luft strömt ein. Welche Größe ist das?', opts: OPT32, right: 'z', why: 'Die kalte Luft wirkt von außen auf die Strecke und ist nicht gewollt: Das ist die Störgröße z. ' + EXPL32 },
    { key: 'g4', name: 'Größe 4', q: 'Die Größe, mit der der Regler über das Stellglied auf die Strecke wirkt, zum Beispiel die Ventilstellung oder der Heizstrom.', opts: OPT32, right: 'y', why: 'Gemeint ist die Stellgröße y. ' + EXPL32 },
    { key: 'g5', name: 'Größe 5', q: 'Die Differenz zwischen Führungsgröße und Regelgröße, die der Regler ausgleichen soll.', opts: OPT32, right: 'e', why: 'Gemeint ist die Regelabweichung e = w − x. ' + EXPL32 },
    { key: 'g6', name: 'Größe 6', q: 'Bei einer Drehzahlregelung wird die Welle zusätzlich durch eine Bremse belastet. Welche Größe ist das?', opts: OPT32, right: 'z', why: 'Die zusätzliche Last wirkt als Störgröße z auf die Strecke (Motor mit Last), der Regler stellt die Spannung nach. ' + EXPL32 }
  ]);
  const check32 = mk((r, a) => { Q32.rows(r, a); });

  /* ====================================================================== rg33 Bauteil im Kreis */
  /* PRUEFEN P16: Zuordnung Bauteil zu Rolle im Regelkreis (Thyristorsteller = Stellglied, Motor mit Last = Strecke, Tachogenerator = Messeinrichtung). In der Mitschrift LF 7.2 Kapitel 2 werden Stellglied, Strecke und Messeinrichtung teils zur "Regelstrecke" im weiteren Sinn zusammengefasst. Soll im Lab zwischen Stellglied und Strecke getrennt werden? */
  const OPT33 = [['R', 'Regler'], ['S', 'Stellglied'], ['P', 'Regelstrecke'], ['M', 'Messeinrichtung']];
  const EXPL33 = ' Der Regler bildet das Stellsignal, das Stellglied setzt es um, die Strecke ist die zu regelnde Anlage, die Messeinrichtung meldet den Istwert zurück.';
  const Q33 = quiz([
    { key: 'b1', name: 'Raum der Heizung', q: 'In einer Raumheizung ist der Raum selbst (Luft und Wände) die geregelte Anlage. Welche Rolle hat er im Regelkreis?', opts: OPT33, right: 'P', why: 'Der Raum ist die Regelstrecke.' + EXPL33 },
    { key: 'b2', name: 'Temperaturfühler', q: 'Im Raum misst ein Temperaturfühler die Ist-Temperatur. Welche Rolle hat er?', opts: OPT33, right: 'M', why: 'Der Fühler ist die Messeinrichtung.' + EXPL33 },
    { key: 'b3', name: 'Heizkörperventil', q: 'Das Heizkörperventil mit elektrischem Stellantrieb ändert den Wasserdurchfluss. Welche Rolle hat es?', opts: OPT33, right: 'S', why: 'Das Ventil mit Antrieb ist das Stellglied.' + EXPL33 },
    { key: 'b4', name: 'Regelelektronik', q: 'Eine Elektronik vergleicht Soll- und Ist-Temperatur und bildet daraus das Stellsignal. Welche Rolle hat sie?', opts: OPT33, right: 'R', why: 'Die Elektronik ist der Regler.' + EXPL33 },
    { key: 'b5', name: 'Thyristorsteller', q: 'Bei einer Drehzahlregelung formt ein Thyristorsteller die Ankerspannung des Motors. Welche Rolle hat er?', opts: OPT33, right: 'S', why: 'Der Thyristorsteller ist das Stellglied.' + EXPL33 },
    { key: 'b6', name: 'Tachogenerator', q: 'Bei einer Drehzahlregelung liefert ein Tachogenerator eine Spannung, die zur Drehzahl proportional ist. Welche Rolle hat er?', opts: OPT33, right: 'M', why: 'Der Tachogenerator ist die Messeinrichtung.' + EXPL33 },
    { key: 'b7', name: 'Motor mit Last', q: 'Bei einer Drehzahlregelung dreht der Gleichstrommotor mit der angekoppelten Last. Welche Rolle hat der Motor mit Last?', opts: OPT33, right: 'P', why: 'Motor und Last bilden die Regelstrecke.' + EXPL33 }
  ]);
  const check33 = mk((r, a) => { Q33.rows(r, a); });

  /* ====================================================================== rg34 Regelabweichung berechnen */
  /* PRUEFEN P1: Vorzeichen der Regelabweichung e = w − x (Führungsgröße minus Regelgröße, wie in DIN 19226 und der Mitschrift; positiv, wenn der Istwert unter dem Sollwert liegt). Manche Bücher rechnen x − w. Welche Konvention gilt im Unterricht? */
  const M34 = { items: [{ w: 50, x: 42, u: '°C', n: 'die Temperatur eines Ofens' }, { w: 60, x: 68, u: '%', n: 'der Füllstand eines Tanks' }, { w: 1500, x: 1380, u: '1/min', n: 'die Drehzahl eines Motors' }] };
  M34.e = M34.items.map(i => i.w - i.x);
  const check34 = mk((r, a) => {
    M34.items.forEach((it, i) => {
      const e = M34.e[i], v = fieldNum(a, 'a' + (i + 1));
      numRow(r, 'Aufgabe ' + (i + 1) + ': Die Regelabweichung stimmt', v, e, 0.01, [[-e, 'Du hast das Vorzeichen vertauscht: Die Regelabweichung ist e = w − x (Führungsgröße minus Regelgröße), nicht x − w.']], it.u);
    });
    const c = choiceOf(a, 'vz');
    r(sameChoice(c, 'neg'), 'Das Vorzeichen bei zu hohem Istwert ist richtig beurteilt', c === undefined ? 'Wähle eine Antwort.' : 'Liegt der Istwert über dem Sollwert, ist x größer als w, also e = w − x kleiner als null: negativ. Der Regler muss dann weniger stellen.');
  });

  /* ====================================================================== rg35 Sprungantwort lesen */
  const M35 = { cfg: { reg: 'offen', str: 'PT1', Ks: 2, T1: 4, w: 10, tEnd: 24 } };
  M35.xend = M35.cfg.Ks * M35.cfg.w; M35.k63 = K.pt1(M35.cfg.T1, M35.cfg.Ks, M35.cfg.T1, M35.cfg.w);
  const check35 = mk((r, a) => {
    const c = M35.cfg;
    numRow(r, 'Der Endwert der Regelgröße stimmt', fieldNum(a, 'xend'), M35.xend, 1, null, '%');
    numRow(r, 'Die Zeitkonstante T stimmt', fieldNum(a, 'T'), c.T1, 0.5, [[3 * c.T1, 'Du hast den Zeitpunkt bei 95 % des Endwerts abgelesen (etwa 3 · T). T gehört zu 63 % des Endwerts.'], [M35.xend, 'Du hast den Endwert eingetragen, nicht die Zeit. T liest du auf der Zeitachse ab.']], 's');
    numRow(r, 'Die Streckenverstärkung Ks stimmt', fieldNum(a, 'Ks'), c.Ks, 0.15, [[M35.xend, 'Du hast den Endwert eingetragen. Ks = Endwert / Höhe des Sprungs am Eingang.'], [1 / c.Ks, 'Du hast den Kehrwert gebildet. Ks = Änderung von x / Änderung von y.']], '');
  });

  /* ====================================================================== rg36 Wert nach einer Zeit */
  const M36 = { Ks: 2.5, T: 4, du: 20 };
  M36.xend = M36.Ks * M36.du; M36.t1 = M36.T; M36.t3 = 3 * M36.T; M36.x1 = K.pt1(M36.t1, M36.Ks, M36.T, M36.du); M36.x3 = K.pt1(M36.t3, M36.Ks, M36.T, M36.du);
  const check36 = mk((r, a) => {
    numRow(r, 'Der Endwert der Regelgröße stimmt', fieldNum(a, 'a1'), M36.xend, 0.05 * 1, [[M36.Ks, 'Du hast nur Ks eingetragen. Der Endwert ist Ks mal die Höhe des Sprungs.'], [M36.du, 'Du hast die Höhe des Sprungs eingetragen. Der Endwert ist Ks · Δu.']], '%');
    numRow(r, 'Der Wert nach der ersten Zeit stimmt', fieldNum(a, 'a2'), M36.x1, 0.015 * M36.x1, [[M36.xend * Math.exp(-1), 'Du hast e^(−t/T) statt 1 − e^(−t/T) gerechnet: Die Kurve steigt, sie fällt nicht.']], '%');
    numRow(r, 'Der Wert nach der zweiten Zeit stimmt', fieldNum(a, 'a3'), M36.x3, 0.015 * M36.x3, [[M36.xend * Math.exp(-3), 'Du hast e^(−t/T) statt 1 − e^(−t/T) gerechnet: Die Kurve steigt, sie fällt nicht.']], '%');
  });

  /* ====================================================================== rg37 Wartezeit am Anfang */
  const M37 = { cfg: { reg: 'offen', str: 'PT1', Ks: 1.5, T1: 3, Tt: 2.5, w: 10, tEnd: 20 } };
  const check37 = mk((r, a) => {
    numRow(r, 'Die Totzeit stimmt', fieldNum(a, 'Tt'), M37.cfg.Tt, 0.4, [[M37.cfg.Tt + 3 * M37.cfg.T1, 'Du hast die Zeit bis zum Endwert abgelesen. Die Totzeit ist nur die Wartezeit am Anfang, bis x überhaupt zu steigen beginnt.']], 's');
    const c = choiceOf(a, 'warum');
    r(sameChoice(c, 'verspaetet'), 'Die Folge der Totzeit für den Regler ist richtig beurteilt', c === undefined ? 'Wähle eine Antwort.' : 'Während der Totzeit sieht der Regler keine Wirkung seiner Stellgröße und baut weiter Stellgröße auf. Wenn die Wirkung ankommt, ist es zu viel: Der Kreis neigt zum Schwingen.');
  });

  /* ====================================================================== rg38 Transport auf dem Band */
  /* PRUEFEN P2: Totzeit Tt = Länge / Geschwindigkeit (Transportzeit zwischen Stellort und Messort, hier Förderband). Passendes Beispiel für den Unterricht? */
  const M38 = { b1: { L: 12, v: 0.5 }, b2: { L: 9, v: 1.5 }, b3: { Tt: 8, v: 0.75 } };
  M38.t1 = K.tt(M38.b1.L, M38.b1.v); M38.t2 = K.tt(M38.b2.L, M38.b2.v); M38.l3 = M38.b3.Tt * M38.b3.v;
  const check38 = mk((r, a) => {
    numRow(r, 'Aufgabe 1: Die Totzeit stimmt', fieldNum(a, 'a1'), M38.t1, 0.02 * M38.t1, [[M38.b1.v / M38.b1.L, 'Du hast Geschwindigkeit durch Länge gerechnet. Die Zeit ist Weg durch Geschwindigkeit.'], [M38.b1.L * M38.b1.v, 'Du hast Länge mal Geschwindigkeit gerechnet. Die Zeit ist Weg durch Geschwindigkeit.']], 's');
    numRow(r, 'Aufgabe 2: Die Totzeit stimmt', fieldNum(a, 'a2'), M38.t2, 0.02 * M38.t2, [[M38.b2.L * M38.b2.v, 'Du hast Länge mal Geschwindigkeit gerechnet. Die Zeit ist Weg durch Geschwindigkeit.']], 's');
    numRow(r, 'Aufgabe 3: Die Länge des Bandes stimmt', fieldNum(a, 'a3'), M38.l3, 0.02 * M38.l3, [[M38.b3.Tt / M38.b3.v, 'Du hast die Zeit durch die Geschwindigkeit geteilt. Der Weg ist Geschwindigkeit mal Zeit.']], 'm');
    const c = choiceOf(a, 'halb');
    r(sameChoice(c, 'halb'), 'Der Einfluss der Bandgeschwindigkeit ist richtig beurteilt', c === undefined ? 'Wähle eine Antwort.' : 'Tt = Länge / Geschwindigkeit: Bei doppelter Geschwindigkeit und gleicher Länge halbiert sich die Totzeit.');
  });

  /* ====================================================================== rg39 Speicher zählen */
  /* PRUEFEN P17: Ordnungszahl n = Zahl der Energiespeicher (PT0 ohne Speicher, PT1, PT2, PT3). Ein Spannungsteiler ohne Kondensator wird als Strecke ohne Verzögerung (n = 0) eingestuft. Sind die Beispiele (Heizdraht mit Plättchen, Block plus Wasserbehälter, drei Behälter, RC-Glied) für den Unterricht passend? */
  const OPT39 = [[0, 'n = 0'], [1, 'n = 1'], [2, 'n = 2'], [3, 'n = 3']];
  const Q39 = quiz([
    { key: 'o1', name: 'Heizdraht mit Plättchen', q: 'Ein Heizdraht erwärmt direkt ein kleines Metallplättchen. Nur das Plättchen speichert merklich Wärme.', opts: OPT39, right: 1, why: 'Es gibt einen Energiespeicher (das Plättchen), also n = 1 (PT1).' },
    { key: 'o2', name: 'Heizelement, Block und Behälter', q: 'Ein Heizelement erwärmt zuerst einen Metallblock, der Block erwärmt einen Wasserbehälter dahinter. Beide speichern Wärme und sind hintereinander geschaltet.', opts: OPT39, right: 2, why: 'Zwei hintereinander liegende Energiespeicher ergeben n = 2 (PT2). Die Regelgröße reagiert träger als bei n = 1.' },
    { key: 'o3', name: 'Drei Behälter hintereinander', q: 'Ein Wasserkreislauf besteht aus drei Behältern, die hintereinander durchflossen werden und alle eine nennenswerte Wassermenge speichern.', opts: OPT39, right: 3, why: 'Jeder Behälter ist ein Speicher, zusammen also n = 3. Je größer n ist, desto langsamer ändert sich die Regelgröße nach einem Sprung.' },
    { key: 'o4', name: 'Spannungsteiler', q: 'Eine Strecke besteht nur aus einem Spannungsteiler aus zwei Widerständen, ohne Kondensator und ohne Spule.', opts: OPT39, right: 0, why: 'Ohne Energiespeicher gibt es keine Verzögerung: Die Ausgangsspannung folgt dem Sprung sofort (n = 0, nur Proportionalverhalten).' },
    { key: 'o5', name: 'RC-Glied am Verstärker', q: 'Am Ausgang einer Verstärkerstufe liegt ein RC-Glied mit einem Kondensator, das die Spannung glättet.', opts: OPT39, right: 1, why: 'Der Kondensator ist der einzige Energiespeicher, also n = 1 (PT1, Zeitkonstante T = R · C).' }
  ]);
  const check39 = mk((r, a) => { Q39.rows(r, a); });

  /* ====================================================================== rg40 Strecke beurteilen */
  const M40 = { p: [{ n: 'A', Tu: 1.5, Tg: 30 }, { n: 'B', Tu: 4, Tg: 20 }, { n: 'C', Tu: 8, Tg: 20 }] };
  M40.p.forEach(q => { const g = K.regelbar(q.Tu, q.Tg); q.ratio = g.ratio; q.urteil = g.urteil; });
  const U40 = { gut: 'gut regelbar', noch: 'noch regelbar', schwer: 'schwer regelbar' };
  const check40 = mk((r, a) => {
    M40.p.forEach((q, i) => {
      numRow(r, 'Strecke ' + q.n + ': Das Verhältnis Tg / Tu stimmt', fieldNum(a, 'v' + (i + 1)), q.ratio, 0.03 * q.ratio, [[q.Tu / q.Tg, 'Du hast Tu durch Tg geteilt. Gefragt ist Tg durch Tu.']], '');
      const c = choiceOf(a, 'u' + (i + 1));
      r(sameChoice(c, q.urteil), 'Strecke ' + q.n + ': Die Regelbarkeit ist richtig beurteilt', c === undefined ? 'Wähle eine Antwort.' : 'Verhältnis Tg / Tu = ' + fm(q.Tg, 1) + ' / ' + fm(q.Tu, 1) + ' = ' + fm(q.ratio, 1) + '. Über ' + fm(10, 0) + ' gilt eine Strecke als gut, von ' + fm(3, 0) + ' bis ' + fm(10, 0) + ' als noch und unter ' + fm(3, 0) + ' als schwer regelbar. Eine große Verzugszeit macht die Regelung schwierig.');
    });
  });

  /* ====================================================================== rg41 / rg42 Reglerkennlinie lesen */
  const M41 = { e0: 2, yMax: 12, tEnd: 12, kp: 2, tn: 4, tv: 1, order: ['PI', 'P', 'PID', 'I'] };
  M41.panels = M41.order.map((typ, i) => ({ key: 'k' + (i + 1), name: 'Kurve ' + 'ABCD'[i], typ }));
  const OPT41 = [['P', 'P-Regler'], ['I', 'I-Regler'], ['PI', 'PI-Regler'], ['PID', 'PID-Regler']];
  const WHY41 = { P: 'Der P-Regler springt sofort auf Kp · e und bleibt dort, solange e konstant ist.', I: 'Der I-Regler startet bei null und steigt bei konstantem e gleichmäßig an (Rampe), es gibt keinen Sprung am Anfang.', PI: 'Der PI-Regler springt zuerst auf Kp · e (P-Anteil) und steigt dann gleichmäßig weiter (I-Anteil).', PID: 'Der PID-Regler hat zusätzlich zum Sprung und zur Rampe eine kurze Spitze am Anfang (D-Anteil), die nach kurzer Zeit abklingt.' };
  const Q41 = quiz(M41.panels.map(p => ({ key: p.key, name: p.name, q: 'Welche Reglerart gehört zu ' + p.name + '?', opts: OPT41, right: p.typ, why: WHY41[p.typ] })));
  const check41 = mk((r, a) => { Q41.rows(r, a); });
  const M42 = { Kp: 2.5, Tn: 5, e0: 2, tEnd: 15 };
  M42.y0 = M42.Kp * M42.e0; M42.yTn = K.ctrlStep('PI', M42.Kp, M42.Tn, 0, M42.Tn, M42.e0); M42.yEnd = K.ctrlStep('PI', M42.Kp, M42.Tn, 0, M42.tEnd, M42.e0);
  const check42 = mk((r, a) => {
    numRow(r, 'Der Sprung am Anfang stimmt', fieldNum(a, 'y0'), M42.y0, 0.4, [[M42.e0, 'Du hast die Höhe der Regelabweichung eingetragen. Gefragt ist der Wert der Stellgröße y direkt nach dem Sprung.']], '%');
    numRow(r, 'Die Verstärkung Kp stimmt', fieldNum(a, 'Kp'), M42.Kp, 0.2, [[M42.y0, 'Du hast den Sprung der Stellgröße eingetragen. Kp = Sprung von y / Höhe von e.']], '');
    numRow(r, 'Die Nachstellzeit Tn stimmt', fieldNum(a, 'Tn'), M42.Tn, 0.6, [[M42.yTn, 'Du hast einen Wert der Stellgröße eingetragen. Tn ist eine Zeit und steht auf der Zeitachse.']], 's');
  });

  /* ====================================================================== rg43 Spitze und Endwert */
  const M43 = { cfg: { reg: 'PI', Kp: 2, Tn: 2.5, Ks: 1, str: 'PT2', T1: 3, T2: 1.5, w: 50, tEnd: 30 } };
  M43.an = K.analyse(K.simulate(M43.cfg));
  const check43 = mk((r, a) => {
    const an = M43.an;
    numRow(r, 'Der höchste Wert der Regelgröße stimmt', fieldNum(a, 'xmax'), an.xmax, 1.5, null, '%');
    numRow(r, 'Der Endwert der Regelgröße stimmt', fieldNum(a, 'xend'), an.xend, 1, null, '%');
    numRow(r, 'Die Überschwingweite ü stimmt', fieldNum(a, 'ue'), an.ueb, 4, [[an.xmax - an.xend, 'Du hast die Spitze minus Endwert in Prozentpunkten eingetragen. ü wird auf den Endwert bezogen: ü = (x_max − x_end) / x_end · 100 %.'], [an.xmax, 'Du hast den höchsten Wert eingetragen, nicht die Überschwingweite. ü = (x_max − x_end) / x_end · 100 %.']], '%');
  });

  /* ====================================================================== rg44 Zwei Kurven im Vergleich */
  const M44 = { base: { reg: 'PI', Kp: 1.5, Tn: 4, Ks: 1, str: 'PT1', T1: 3, w: 50, tEnd: 40 }, tt: 2 };
  M44.cfgA = Object.assign({}, M44.base, { Tt: M44.tt }); M44.cfgB = Object.assign({}, M44.base, { Tt: 0 });
  M44.aA = K.analyse(K.simulate(M44.cfgA)); M44.aB = K.analyse(K.simulate(M44.cfgB));
  const check44 = mk((r, a) => {
    const c = choiceOf(a, 'tot');
    r(sameChoice(c, 'A'), 'Die Kurve mit Totzeit ist richtig erkannt', c === undefined ? 'Wähle eine Antwort.' : 'Bei der Strecke mit Totzeit bleibt x nach dem Start zunächst auf null: Die Wirkung kommt erst verspätet an. Der Regler baut in dieser Zeit weiter Stellgröße auf, deshalb schwingt der Kreis stärker über.');
    numRow(r, 'Die Überschwingweite von Kurve A stimmt', fieldNum(a, 'ueA'), M44.aA.ueb, 4, null, '%');
    numRow(r, 'Die Überschwingweite von Kurve B stimmt', fieldNum(a, 'ueB'), M44.aB.ueb, 4, null, '%');
  });

  /* ====================================================================== rg45 Verhalten beurteilen */
  const M45 = { Ks: 1, T1: 2, T2: 1, w: 50 };
  M45.k = K.critI2(M45.Ks, M45.T1, M45.T2);
  const cfg45 = f0 => ({ reg: 'I', Tn: M45.k.Ti / f0, str: 'PT2', Ks: M45.Ks, T1: M45.T1, T2: M45.T2, w: M45.w, tEnd: Math.round(M45.k.period * (f0 > 1 ? 4.5 : 7)) });
  M45.panels = [{ key: 'v1', name: 'Kurve A', f0: 1.4, urteil: 'instabil' }, { key: 'v2', name: 'Kurve B', f0: 0.4, urteil: 'stabil' }, { key: 'v3', name: 'Kurve C', f0: 1, urteil: 'grenzstabil' }];
  M45.panels.forEach(p => { p.cfg = cfg45(p.f0); p.an = K.analyse(K.simulate(p.cfg)); });
  const OPT45 = [['stabil', 'Stabil: Die Schwingung klingt ab, x geht auf den Sollwert'], ['grenzstabil', 'Grenzstabil: Dauerschwingung mit gleichbleibender Amplitude'], ['instabil', 'Instabil: Die Schwingung schaukelt sich immer weiter auf']];
  const WHY45 = { stabil: 'Die Ausschläge um den Sollwert werden von Schwingung zu Schwingung kleiner: Der Kreis ist stabil und beruhigt sich.', grenzstabil: 'Die Ausschläge bleiben gleich groß: Dauerschwingung. Der Kreis steht genau an der Stabilitätsgrenze.', instabil: 'Jeder Ausschlag ist größer als der vorherige: Der Kreis ist instabil, die Regelgröße läuft aus dem Ruder.' };
  const Q45 = quiz(M45.panels.map(p => ({ key: p.key, name: p.name, q: 'Wie ist das Verhalten des Kreises in ' + p.name + ' zu beurteilen?', opts: OPT45, right: p.urteil, why: WHY45[p.urteil] })));
  const check45 = mk((r, a) => { Q45.rows(r, a); });

  /* ====================================================================== rg46 Störung oder Führung */
  const M46 = { base: { reg: 'PI', Kp: 1.5, Tn: 3, Ks: 1.5, str: 'PT1', T1: 2, eq: true, tEnd: 60 }, tw: 20, tz: 25 };
  M46.cfgA = Object.assign({}, M46.base, { w0: 40, w: 60, tw: M46.tw }); M46.cfgB = Object.assign({}, M46.base, { w0: 50, w: 50, z: -24, tz: M46.tz });
  const OPT46 = [['AwBz', 'Kurve A: Sollwert wurde verstellt, Kurve B: Störgröße wirkt'], ['AzBw', 'Kurve A: Störgröße wirkt, Kurve B: Sollwert wurde verstellt'], ['ww', 'In beiden Kurven wurde der Sollwert verstellt'], ['zz', 'In beiden Kurven wirkt eine Störgröße']];
  const check46 = mk((r, a) => {
    const c = choiceOf(a, 'was');
    r(sameChoice(c, 'AwBz'), 'Die Ursache der Änderung ist in beiden Kurven richtig erkannt', c === undefined ? 'Wähle eine Antwort.' : 'Bei einem Sollwertsprung ändert sich die gestrichelte Linie (w), der Istwert folgt ihr. Bei einer Störgröße bleibt w unverändert, und die Regelgröße bricht von allein aus.');
    numRow(r, 'Der Zeitpunkt der Änderung in Kurve A stimmt', fieldNum(a, 'tA'), M46.tw, 1.5, [[M46.tz, 'Das ist der Zeitpunkt in der anderen Kurve.']], 's');
    numRow(r, 'Der Zeitpunkt der Änderung in Kurve B stimmt', fieldNum(a, 'tB'), M46.tz, 1.5, [[M46.tw, 'Das ist der Zeitpunkt in der anderen Kurve.']], 's');
  });

  /* ====================================================================== rg47 Zeit bis zur Ruhe */
  const M47 = { cfg: { reg: 'PI', Kp: 1.5, Tn: 4, Ks: 1, str: 'PT1', T1: 3, w: 50, tEnd: 30 } };
  M47.an = K.analyse(K.simulate(M47.cfg));
  const check47 = mk((r, a) => {
    numRow(r, 'Die Ausregelzeit stimmt', fieldNum(a, 'taus'), M47.an.taus, Math.max(1, 0.1 * M47.an.taus), [[M47.an.tmax, 'Du hast den Zeitpunkt der höchsten Spitze abgelesen. Die Ausregelzeit ist der Zeitpunkt, ab dem die Kurve dauerhaft im Band bleibt.']], 's');
    const c = choiceOf(a, 'ebl');
    r(sameChoice(c, 'nein'), 'Die bleibende Regelabweichung ist richtig beurteilt', c === undefined ? 'Wähle eine Antwort.' : 'Die Kurve läuft genau auf den Sollwert: Es bleibt keine Regelabweichung. Ein Regler mit I-Anteil gleicht sie vollständig aus.');
  });

  /* ====================================================================== rg48 bis rg53 (Berufsschulstoff Lernfeld 7.2: Strecke, Zweipunktregler, Regelkreisgrößen; eigene Übungszahlen) */
  /* rg48 Übertragungsbeiwert einer Ofenstrecke: Ks = Δx / Δy aus zwei Beharrungswerten, danach linear weitergerechnet */
  const M48 = { y1: 6, y2: 9, x1: 140, x2: 182, y3: 10 };
  M48.Ks = (M48.x2 - M48.x1) / (M48.y2 - M48.y1); M48.x3 = M48.x2 + M48.Ks * (M48.y3 - M48.y2);
  const check48 = mk((r, a) => {
    numRow(r, 'Der Übertragungsbeiwert Ks stimmt', fieldNum(a, 'Ks'), M48.Ks, 0.2, [[M48.x2 / M48.y2, 'Du hast die Beharrungswerte selbst geteilt (182 °C / 9 A). Ks ist das Verhältnis der Änderungen: Δx / Δy.'], [(M48.y2 - M48.y1) / (M48.x2 - M48.x1), 'Du hast den Kehrwert gebildet. Ks = Änderung der Regelgröße / Änderung der Stellgröße.']], 'K/A');
    numRow(r, 'Die Temperatur beim neuen Strom stimmt', fieldNum(a, 'x3'), M48.x3, 1, [[M48.Ks * M48.y3, 'Du hast nur Ks · I gerechnet. Die Strecke startet nicht bei 0 °C: Rechne vom bekannten Beharrungswert aus weiter.'], [M48.x2 + M48.Ks, 'Fast richtig gedacht, aber der Stromschritt ist nicht 1 A. Multipliziere Ks mit der Stromänderung.']], '°C');
  });
  /* rg49 Zweipunktregler: Kennwerte aus den Beharrungswerten und den Schaltpunkten */
  const M49 = { y0: 0, x0: 18, ym: 12, xm: 78, xo: 52, xu: 48 };
  M49.Ks = (M49.xm - M49.x0) / (M49.ym - M49.y0); M49.xsd = M49.xo - M49.xu; M49.xmit = (M49.xo + M49.xu) / 2; M49.Xh = M49.xm - M49.x0;
  const check49 = mk((r, a) => {
    numRow(r, 'Der Übertragungsbeiwert Ks stimmt', fieldNum(a, 'Ks'), M49.Ks, 0.1, [[M49.xm / M49.ym, 'Du hast 78 °C / 12 A gerechnet. Die Strecke beginnt bei der Umgebungstemperatur: Ks = (x_max − x_min) / (I_max − 0 A).']], 'K/A');
    numRow(r, 'Die Schaltdifferenz x_sd stimmt', fieldNum(a, 'xsd'), M49.xsd, 0.05, [[M49.xsd / 2, 'Das ist nur der halbe Abstand. Die Schaltdifferenz ist der ganze Abstand zwischen Aus- und Einschaltpunkt.']], 'K');
    numRow(r, 'Der Mittelwert der Regelgröße stimmt', fieldNum(a, 'xmit'), M49.xmit, 0.1, [[M49.xo, 'Das ist der obere Schaltpunkt. Ohne Verzug pendelt die Temperatur zwischen beiden Schaltpunkten, der Mittelwert liegt dazwischen.']], '°C');
    numRow(r, 'Der Stellbereich der Regelgröße stimmt', fieldNum(a, 'Xh'), M49.Xh, 0.1, [[M49.xm, 'Das ist die höchste Temperatur. Der Stellbereich ist der Unterschied zwischen ganz ein und ganz aus.']], 'K');
  });
  /* rg50 Zweipunktregler mit Verzugszeit: Anstiegsgeschwindigkeit v = Xh / Tg (Wendetangente), Überschwingen ≈ v · Tu, Schwankungsbreite Δx ≈ x_sd + Xh · Tu / Tg (Näherung) */
  const M50 = { x0: 20, xm: 60, Tu: 0.8, Tg: 16, xo: 41, xu: 39 };
  M50.Xh = M50.xm - M50.x0; M50.xsd = M50.xo - M50.xu; M50.v = M50.Xh / M50.Tg; M50.ueb = M50.v * M50.Tu; M50.dx = M50.xsd + M50.ueb;
  M50.g = K.regelbar(M50.Tu, M50.Tg);
  const check50 = mk((r, a) => {
    numRow(r, 'Die Anstiegsgeschwindigkeit stimmt', fieldNum(a, 'v'), M50.v, 0.05, [[M50.Xh / M50.Tu, 'Du hast durch die Verzugszeit geteilt. Die Wendetangente durchläuft den ganzen Stellbereich in der Ausgleichszeit Tg: v = Xh / Tg.'], [M50.xm / M50.Tg, 'Du hast mit der Endtemperatur statt mit dem Stellbereich gerechnet. Xh ist der Unterschied zwischen ganz ein und ganz aus.']], 'K/min');
    numRow(r, 'Das Überschwingen über den Schaltpunkt stimmt', fieldNum(a, 'ueb'), M50.ueb, 0.1, [[M50.v * M50.Tg, 'Du hast mit der Ausgleichszeit multipliziert. Nach dem Abschalten steigt die Temperatur nur noch während der Verzugszeit Tu weiter.']], 'K');
    numRow(r, 'Die Schwankungsbreite stimmt', fieldNum(a, 'dx'), M50.dx, 0.1, [[M50.xsd, 'Das ist nur die Schaltdifferenz. Wegen der Verzugszeit schwingt die Temperatur zusätzlich über die Schaltpunkte hinaus.'], [M50.ueb, 'Das ist nur das Überschwingen. Die Schaltdifferenz gehört zur Schwankungsbreite dazu.']], 'K');
    const c = choiceOf(a, 'urteil');
    r(sameChoice(c, M50.g.urteil), 'Die Regelbarkeit der Strecke ist richtig beurteilt', c === undefined || c === null ? 'Wähle eine Antwort.' : 'Tg / Tu = ' + fm(M50.Tg, 0) + ' / ' + fm(M50.Tu, 1) + ' = ' + fm(M50.g.ratio, 0) + '. Über ' + fm(10, 0) + ' gilt eine Strecke als gut regelbar, von ' + fm(3, 0) + ' bis ' + fm(10, 0) + ' als noch regelbar.');
  });
  /* rg51 Streckenart aus dem Verhalten */
  const OPT51 = [['P0', 'P ohne Verzögerung'], ['P1', 'P mit einem Speicher (PT1)'], ['P2', 'P mit mehreren Speichern'], ['TT', 'Strecke mit Totzeit'], ['I', 'I-Strecke ohne Ausgleich']];
  const EXPL51 = ' Merke: Mit Ausgleich läuft x auf einen neuen Endwert, ohne Ausgleich steigt x immer weiter. Speicher verzögern, eine Totzeit verschiebt nur.';
  const Q51 = quiz([
    { key: 'k1', name: 'Behälter mit dichtem Ablauf', q: 'Eine Pumpe fördert gleichmäßig Wasser in einen Behälter, dessen Ablauf geschlossen ist. Gemessen wird der Füllstand.', opts: OPT51, right: 'I', why: 'Der Füllstand steigt, solange die Pumpe läuft, und findet keinen neuen Endwert: Strecke ohne Ausgleich (I-Verhalten).' + EXPL51 },
    { key: 'k2', name: 'Hebel am Stellventil', q: 'Ein Hebel überträgt den Weg eines Antriebs auf den Ventilhub. Gemessen wird der Hub, er folgt dem Antrieb ohne merkliche Verzögerung.', opts: OPT51, right: 'P0', why: 'Der Hub ist sofort proportional zum Antriebsweg, es gibt keinen Speicher: P-Strecke ohne Verzögerung.' + EXPL51 },
    { key: 'k3', name: 'Schüttgut auf dem Band', q: 'Ein Schieber ändert die Menge Schüttgut, die auf ein langes Band fällt. Eine Waage am Bandende meldet die Änderung erst, wenn das Gut dort ankommt, dann aber sofort in voller Höhe.', opts: OPT51, right: 'TT', why: 'Die Wirkung kommt unverändert, aber erst nach der Transportzeit an: reine Totzeit.' + EXPL51 },
    { key: 'k4', name: 'Motor mit Schwungscheibe', q: 'Die Ankerspannung eines Gleichstrommotors springt auf einen höheren Wert. Die Drehzahl steigt sofort an, wird dann langsamer und erreicht einen neuen festen Wert.', opts: OPT51, right: 'P1', why: 'Die Schwungmasse ist der einzige Speicher, die Drehzahl läuft mit sofortigem Anstieg auf einen Endwert: PT1.' + EXPL51 },
    { key: 'k5', name: 'Heizkreis mit Raum', q: 'Ein Kessel erwärmt Wasser, das Wasser erwärmt Heizkörper, die Heizkörper erwärmen den Raum. Die Raumtemperatur beginnt flach zu steigen und erreicht später einen neuen festen Wert.', opts: OPT51, right: 'P2', why: 'Mehrere Wärmespeicher hintereinander: Die Kurve startet flach (Wendepunkt) und läuft auf einen Endwert. P-Strecke höherer Ordnung.' + EXPL51 },
    { key: 'k6', name: 'Spindel mit Motor', q: 'Ein Motor dreht bei fester Spannung eine Gewindespindel mit gleichbleibender Drehzahl. Gemessen wird der Weg des Schlittens.', opts: OPT51, right: 'I', why: 'Bei fester Drehzahl wächst der Weg gleichmäßig weiter, ohne Endwert: Der Weg ist das Integral der Drehzahl, also I-Verhalten.' + EXPL51 }
  ]);
  const check51 = mk((r, a) => { Q51.rows(r, a); });
  /* rg52 Größen am Drehzahlregelkreis mit Tachogenerator */
  const OPT52 = [['x', 'Regelgröße x'], ['r', 'Rückführgröße r'], ['w', 'Führungsgröße w'], ['e', 'Regelabweichung e'], ['y', 'Stellgröße y'], ['z', 'Störgröße z']];
  const EXPL52 = ' Merke: x ist die geregelte Größe selbst, r ihr gemessenes Abbild aus der Messeinrichtung, e = w − r wird im Vergleicher gebildet.';
  const Q52 = quiz([
    { key: 'd1', name: 'Drehzahl der Welle', q: 'Die tatsächliche Drehzahl der Motorwelle, die konstant bleiben soll.', opts: OPT52, right: 'x', why: 'Die Drehzahl selbst ist die Regelgröße x.' + EXPL52 },
    { key: 'd2', name: 'Spannung des Tachogenerators', q: 'Die Spannung, die der Tachogenerator an den Vergleicher liefert (proportional zur Drehzahl).', opts: OPT52, right: 'r', why: 'Die Tachospannung ist das gemessene Abbild der Drehzahl, das zurückgeführt wird: Rückführgröße r.' + EXPL52 },
    { key: 'd3', name: 'Spannung am Sollwertpoti', q: 'Die Spannung, die der Bediener mit dem Sollwertpotentiometer einstellt.', opts: OPT52, right: 'w', why: 'Der vom Bediener vorgegebene Wert ist die Führungsgröße w.' + EXPL52 },
    { key: 'd4', name: 'Ausgang des Stromrichters', q: 'Die Ankerspannung, die der Stromrichter auf Befehl des Reglers an den Motor legt.', opts: OPT52, right: 'y', why: 'Damit greift der Regler über das Stellglied in die Strecke ein: Stellgröße y.' + EXPL52 },
    { key: 'd5', name: 'Bremsmoment der Last', q: 'Ein Werkstück wird eingespannt und belastet die Welle zusätzlich.', opts: OPT52, right: 'z', why: 'Die zusätzliche Last wirkt ungewollt von außen: Störgröße z.' + EXPL52 },
    { key: 'd6', name: 'Differenz am Vergleicher', q: 'Der Unterschied zwischen Sollwertspannung und Tachospannung am Eingang des Reglers.', opts: OPT52, right: 'e', why: 'Die Differenz aus Führungsgröße und Rückführgröße ist die Regelabweichung e.' + EXPL52 }
  ]);
  const check52 = mk((r, a) => { Q52.rows(r, a); });
  /* rg53 Regelabweichung im Drehzahlkreis: Tachokonstante (V je 1000 1/min) */
  const M53 = { kT: 6, w: 9, r: 8.4 };
  M53.n = M53.r / M53.kT * 1000; M53.e = M53.w - M53.r; M53.dn = M53.e / M53.kT * 1000; M53.ns = M53.w / M53.kT * 1000;
  const check53 = mk((r, a) => {
    numRow(r, 'Die Istdrehzahl stimmt', fieldNum(a, 'n'), M53.n, 5, [[M53.r * M53.kT * 1000, 'Du hast mit der Tachokonstante multipliziert. Die Spannung wird durch die Konstante geteilt, um auf die Drehzahl zu kommen.'], [M53.ns, 'Das ist die Solldrehzahl. Die Istdrehzahl gehört zur Tachospannung.']], '1/min');
    numRow(r, 'Die Regelabweichung in Volt stimmt', fieldNum(a, 'e'), M53.e, 0.02, [[-M53.e, 'Du hast das Vorzeichen vertauscht: e = w − r (Sollwert minus Rückführgröße).']], 'V');
    numRow(r, 'Die fehlende Drehzahl stimmt', fieldNum(a, 'dn'), M53.dn, 3, [[M53.e * M53.kT * 1000, 'Du hast mit der Tachokonstante multipliziert. Teile die Spannungsdifferenz durch die Konstante.']], '1/min');
  });

  /* ====================================================================== Aufgabenliste */
  /* PRUEFEN P18: Alle Zahlen der Aufgaben (Zeitkonstanten 2 bis 20 s, Verstärkungen 1 bis 3, Sollwert 50 oder 60 %) sind frei gewählte Übungswerte, nicht an eine echte Anlage angelehnt. Sollen echte Betriebsanlagen (Brennofen, Härteofen, Förderband) als Vorbild dienen? */
  /* PRUEFEN P21: Die Ablesetoleranzen der Kurvenaufgaben (z. B. 12 % bei der Zeitkonstante, 4 Prozentpunkte beim Überschwingen, 1,5 s beim Zeitpunkt) sind Schätzwerte. Sind sie für Azubis angemessen? */
  const NOTE_FIG = 'Das Diagramm steht unter dem Aufgabentext.';
  const list = [
    { id: 'rg31', lab: 'reg', cat: 'Grundlagen', title: 'Steuerung oder Regelung', level: 1, rig: '',
      text: 'Entscheide für jede der sechs Situationen, ob eine Steuerung, eine Regelung oder keines von beidem vorliegt.',
      choices: Q31.choices, hintVals() { return hv(this, () => ({})); },
      get hint() { return hn(this, () => [
        'Frage bei jeder Situation: Wird der Istwert gemessen und mit dem Sollwert verglichen, und wirkt das Ergebnis auf die Anlage zurück (geschlossener Kreis)? Dann ist es eine Regelung. Ohne Rückmeldung (offener Wirkungsablauf) ist es eine Steuerung.',
        'Regelung heißt: Messen, Vergleichen, Nachstellen. Eine Steuerung arbeitet nach einem festen Programm oder einer festen Stufe, unabhängig davon, was in der Anlage wirklich herauskommt. Ein Anzeigegerät allein stellt nichts nach.',
        'Raumthermostat: Regelung. Scheibenwischer in fester Stufe: Steuerung. Tempomat: Regelung. Zeitrelais am Treppenhauslicht: Steuerung. Drehzahl mit Tachogenerator: Regelung. Manometer: weder noch (nur Anzeige).']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q31.sol() }), check: check31 },
    { id: 'rg32', lab: 'reg', cat: 'Grundlagen', title: 'Größe benennen', level: 1, rig: '',
      text: 'Ordne jeder Beschreibung die passende Größe des Regelkreises zu: Regelgröße x, Führungsgröße w, Stellgröße y, Störgröße z oder Regelabweichung e.',
      choices: Q32.choices, hintVals() { return hv(this, () => ({})); },
      get hint() { return hn(this, () => [
        'Frage bei jeder Größe: Wer bestimmt sie? Der Bediener (Führungsgröße), der Regler (Stellgröße) oder die Umwelt (Störgröße)? Die Regelgröße wird gemessen und soll konstant bleiben, die Regelabweichung ist eine Differenz.',
        'Die Führungsgröße ist der Sollwert, den der Bediener vorgibt. Die Stellgröße ist der Ausgang des Reglers, mit der das Stellglied die Strecke beeinflusst. Die Störgröße wirkt von außen und ist nicht gewollt. Die Regelabweichung ist e = w − x.',
        'Erste Beschreibung: Regelgröße x. Zweite: Führungsgröße w. Dritte: Störgröße z. Vierte: Stellgröße y. Fünfte: Regelabweichung e. Sechste: Störgröße z.']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q32.sol() }), check: check32 },
    { id: 'rg33', lab: 'reg', cat: 'Grundlagen', title: 'Bauteil im Kreis', level: 2, rig: '',
      text: 'Eine Raumheizung und eine Drehzahlregelung werden in ihre Bauteile zerlegt. Welche Rolle hat jedes Bauteil im Regelkreis: Regler, Stellglied, Regelstrecke oder Messeinrichtung?',
      choices: Q33.choices, hintVals() { return hv(this, () => ({})); },
      get hint() { return hn(this, () => [
        'Frage bei jedem Bauteil: Was macht es mit dem Signal? Der Regler vergleicht und bildet das Stellsignal, das Stellglied setzt es um, die Strecke ist die Anlage, deren Größe geregelt wird, die Messeinrichtung meldet den Istwert zurück.',
        'Der Regler ist die Elektronik, die vergleicht. Das Stellglied ändert Energie oder Stoffstrom (Ventil, Thyristorsteller). Die Regelstrecke ist der Raum, der Motor mit Last. Die Messeinrichtung ist der Fühler oder der Tachogenerator.',
        'Raum: Regelstrecke. Temperaturfühler: Messeinrichtung. Heizkörperventil: Stellglied. Regelelektronik: Regler. Thyristorsteller: Stellglied. Tachogenerator: Messeinrichtung. Motor mit Last: Regelstrecke.']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q33.sol() }), check: check33 },
    { id: 'rg34', lab: 'reg', cat: 'Grundlagen', title: 'Regelabweichung berechnen', level: 2, rig: '',
      get text() { const v = M34.items; return 'Berechne die Regelabweichung e = w − x (Vorzeichen beachten). Aufgabe 1: Für ' + v[0].n + ' ist w = ' + fm(v[0].w, 0) + ' ' + v[0].u + ' vorgegeben, gemessen wird x = ' + fm(v[0].x, 0) + ' ' + v[0].u + '. Aufgabe 2: Für ' + v[1].n + ' ist w = ' + fm(v[1].w, 0) + ' ' + v[1].u + ', gemessen wird x = ' + fm(v[1].x, 0) + ' ' + v[1].u + '. Aufgabe 3: Für ' + v[2].n + ' ist w = ' + fm(v[2].w, 0) + ' ' + v[2].u + ', gemessen wird x = ' + fm(v[2].x, 0) + ' ' + v[2].u + '. Beantworte danach die Frage zum Vorzeichen.'; },
      get fields() { return M34.items.map((it, i) => ({ key: 'a' + (i + 1), question: 'Aufgabe ' + (i + 1) + ': Regelabweichung e', label: 'Aufgabe ' + (i + 1), unit: it.u })); },
      choices: [{ key: 'vz', q: 'Der Istwert liegt über dem Sollwert. Welches Vorzeichen hat die Regelabweichung e = w − x?', options: [{ value: 'neg', label: 'Negativ (e < 0)' }, { value: 'pos', label: 'Positiv (e > 0)' }, { value: 'null', label: 'Null (e = 0)' }] }],
      hintVals() { return hv(this, () => { const o = {}; M34.items.forEach((it, i) => { o['w' + (i + 1)] = it.w; o['x' + (i + 1)] = it.x; o['e' + (i + 1)] = M34.e[i]; }); return o; }); },
      get hint() { return hn(this, v => [
        'Die Regelabweichung ist Führungsgröße minus Regelgröße: e = w − x. Liegt der Istwert über dem Sollwert, wird das Ergebnis negativ.',
        'Aufgabe 1: ' + fm(v.w1, 0) + ' − ' + fm(v.x1, 0) + '. Aufgabe 2: ' + fm(v.w2, 0) + ' − ' + fm(v.x2, 0) + ' (der Istwert liegt über dem Sollwert). Aufgabe 3: ' + fm(v.w3, 0) + ' − ' + fm(v.x3, 0) + '.',
        'Aufgabe 1: e = ' + fm(v.w1, 0) + ' − ' + fm(v.x1, 0) + ' = ' + fm(v.e1, 0) + '. Aufgabe 2: e = ' + fm(v.w2, 0) + ' − ' + fm(v.x2, 0) + ' = ' + fm(v.e2, 0) + ' (negativ). Aufgabe 3: e = ' + fm(v.w3, 0) + ' − ' + fm(v.x3, 0) + ' = ' + fm(v.e3, 0) + '.']); },
      start: () => S({ fields: nulls(['a1', 'a2', 'a3']), choices: {} }), sol: () => S({ fields: { a1: M34.e[0], a2: M34.e[1], a3: M34.e[2] }, choices: { vz: 'neg' } }), check: check34 },
    { id: 'rg35', lab: 'reg', cat: 'Strecke messen', title: 'Sprungantwort lesen', level: 2, rig: '',
      text: 'Eine Regelstrecke (Übungsanlage) erhält zum Zeitpunkt t = 0 einen Sprung der Stellgröße y von 0 auf 10 % (gestrichelt). Das Diagramm zeigt die Regelgröße x. Lies den Endwert von x und die Zeitkonstante T der Strecke ab und berechne die Streckenverstärkung Ks = Δx / Δy. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Sprung der Stellgröße y am Eingang der Strecke. Zeiten in Prozess-Sekunden, Größen in % (Übungswerte).', panels: [openPanel('Sprungantwort der Strecke', M35.cfg)] })); },
      fields: [{ key: 'xend', question: 'Endwert der Regelgröße x', label: 'Endwert x', unit: '%' }, { key: 'T', question: 'Zeitkonstante T der Strecke', label: 'Zeitkonstante T', unit: 's' }, { key: 'Ks', question: 'Streckenverstärkung Ks', label: 'Ks', unit: '' }],
      consts: [63],
      hintVals() { return hv(this, () => ({ du: M35.cfg.w, xlo: M35.xend - 2, xhi: M35.xend + 2, xend: M35.xend, k63: M35.k63, T: M35.cfg.T1, Ks: M35.cfg.Ks })); },
      get hint() { return hn(this, v => [
        'Lies zuerst den Endwert ab, auf den die Regelgröße zuläuft, und teile ihn durch die Höhe des Sprungs: Das ist Ks. Die Zeitkonstante T liest du dort ab, wo die Kurve 63 % ihres Endwerts erreicht hat.',
        'Der Sprung am Eingang ist ' + fm(v.du, 0) + ' %. Die Kurve läuft auf einen Wert zwischen ' + fm(v.xlo, 0) + ' % und ' + fm(v.xhi, 0) + ' % zu. Rechne mit deinem abgelesenen Endwert 63 % aus, gehe auf dieser Höhe zur Kurve und von dort nach unten auf die Zeitachse.',
        'Endwert ' + fm(v.xend, 0) + ' %, also Ks = ' + fm(v.xend, 0) + ' % / ' + fm(v.du, 0) + ' % = ' + fm(v.Ks, 1) + '. Bei 63 % des Endwerts, das sind ' + fm(v.k63, 1) + ' %, liest du T = ' + fm(v.T, 0) + ' s ab.']); },
      start: () => S({ fields: nulls(['xend', 'T', 'Ks']) }), sol: () => S({ fields: { xend: M35.xend, T: M35.cfg.T1, Ks: M35.cfg.Ks } }), check: check35 },
    { id: 'rg36', lab: 'reg', cat: 'Strecke messen', title: 'Wert nach einer Zeit', level: 2, rig: '',
      get text() { return 'Eine Strecke mit Ausgleich und einem Speicher (PT1) hat die Streckenverstärkung Ks = ' + fm(M36.Ks, 1) + ' und die Zeitkonstante T = ' + fm(M36.T, 0) + ' s. Sie erhält einen Sprung der Stellgröße von ' + fm(M36.du, 0) + ' %. Berechne (1) den Endwert der Regelgröße, (2) die Regelgröße nach t = ' + fm(M36.t1, 0) + ' s und (3) die Regelgröße nach t = ' + fm(M36.t3, 0) + ' s.'; },
      get fields() { return [{ key: 'a1', question: '(1) Endwert der Regelgröße', label: 'Endwert', unit: '%' }, { key: 'a2', question: '(2) Regelgröße nach t = ' + fm(M36.t1, 0) + ' s', label: 'x nach der ersten Zeit', unit: '%' }, { key: 'a3', question: '(3) Regelgröße nach t = ' + fm(M36.t3, 0) + ' s', label: 'x nach der zweiten Zeit', unit: '%' }]; },
      consts: [],
      hintVals() { return hv(this, () => ({ Ks: M36.Ks, du: M36.du, xend: M36.xend, T: M36.T, t1: M36.t1, t3: M36.t3, e1: Math.exp(-1), e3: Math.exp(-3), x1: M36.x1, x3: M36.x3 })); },
      get hint() { return hn(this, v => [
        'Die Sprungantwort einer Strecke mit einem Speicher heißt x(t) = Ks · Δu · (1 − e^(−t/T)). Der Endwert ist Ks · Δu. Nach t = T sind etwa zwei Drittel des Endwerts erreicht, nach t = 3 · T fast alles.',
        'Der Endwert ist ' + fm(v.Ks, 1) + ' · ' + fm(v.du, 0) + ' = ' + fm(v.xend, 0) + ' %. Für t = ' + fm(v.t1, 0) + ' s gilt t/T = 1, und e^(−1) = ' + fm(v.e1, 3) + '. Für t = ' + fm(v.t3, 0) + ' s gilt t/T = 3, und e^(−3) = ' + fm(v.e3, 3) + '.',
        'Nach t = ' + fm(v.t1, 0) + ' s: ' + fm(v.xend, 0) + ' % · (1 − ' + fm(v.e1, 3) + ') = ' + fm(v.x1, 1) + ' %. Nach t = ' + fm(v.t3, 0) + ' s: ' + fm(v.xend, 0) + ' % · (1 − ' + fm(v.e3, 3) + ') = ' + fm(v.x3, 1) + ' %.']); },
      start: () => S({ fields: nulls(['a1', 'a2', 'a3']) }), sol: () => S({ fields: { a1: M36.xend, a2: M36.x1, a3: M36.x3 } }), check: check36 },
    { id: 'rg37', lab: 'reg', cat: 'Strecke messen', title: 'Wartezeit am Anfang', level: 1, rig: '',
      text: 'Eine Strecke erhält zum Zeitpunkt t = 0 einen Sprung der Stellgröße y von 0 auf 10 % (gestrichelt). Das Diagramm zeigt die Regelgröße x am Messort. Wie lang ist die Totzeit der Strecke? Beantworte danach die Frage zur Wirkung der Totzeit auf den Regler. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Sprung der Stellgröße y am Eingang der Strecke. Zeiten in Prozess-Sekunden (Übungswerte).', panels: [openPanel('Sprungantwort am Messort', M37.cfg)] })); },
      fields: [{ key: 'Tt', question: 'Totzeit der Strecke', label: 'Totzeit Tt', unit: 's' }],
      choices: [{ key: 'warum', q: 'Warum ist eine Totzeit für den Regler ein Problem?', options: [{ value: 'verspaetet', label: 'Er sieht die Wirkung seiner Stellgröße erst verspätet und stellt deshalb zu viel nach: Der Kreis neigt zum Schwingen' }, { value: 'endwert', label: 'Die Regelgröße erreicht nie einen Endwert' }, { value: 'keine', label: 'Die Strecke hat dann keine Verzögerung mehr' }] }],
      hintVals() { return hv(this, () => ({ Tt: M37.cfg.Tt, lo: M37.cfg.Tt - 1, hi: M37.cfg.Tt + 1, T: M37.cfg.T1, xend: M37.cfg.Ks * M37.cfg.w })); },
      get hint() { return hn(this, v => [
        'Die Regelgröße bleibt nach dem Sprung zunächst bei null und beginnt erst nach der Totzeit zu steigen. Lies auf der Zeitachse ab, wann die Kurve die Nulllinie verlässt. Während der Totzeit wird die Regelgröße nicht beeinflusst.',
        'Die Kurve beginnt zwischen ' + fm(v.lo, 0) + ' s und ' + fm(v.hi, 0) + ' s zu steigen. Danach läuft sie wie bei einer Strecke mit einem Speicher (T = ' + fm(v.T, 0) + ' s) auf den Endwert ' + fm(v.xend, 0) + ' % zu.',
        'Die Wirkung setzt bei t = ' + fm(v.Tt, 1) + ' s ein: Totzeit Tt = ' + fm(v.Tt, 1) + ' s.']); },
      start: () => S({ fields: nulls(['Tt']), choices: {} }), sol: () => S({ fields: { Tt: M37.cfg.Tt }, choices: { warum: 'verspaetet' } }), check: check37 },
    { id: 'rg38', lab: 'reg', cat: 'Strecke messen', title: 'Transport auf dem Band', level: 2, rig: '',
      get text() { const a = M38.b1, b = M38.b2, c = M38.b3; return 'Am Anfang eines Förderbandes dosiert ein Stellglied Schüttgut, am Bandende misst eine Waage das Gewicht. Die Totzeit der Regelstrecke ist die Transportzeit. Aufgabe 1: Das Band ist ' + fm(a.L, 0) + ' m lang und läuft mit ' + fm(a.v, 1) + ' m/s. Wie groß ist die Totzeit? Aufgabe 2: Ein anderes Band ist ' + fm(b.L, 0) + ' m lang und läuft mit ' + fm(b.v, 1) + ' m/s. Wie groß ist die Totzeit? Aufgabe 3: Ein drittes Band läuft mit ' + fm(c.v, 2) + ' m/s und hat die Totzeit ' + fm(c.Tt, 0) + ' s. Wie lang ist es? Beantworte danach die Frage.'; },
      fields: [{ key: 'a1', question: 'Aufgabe 1: Totzeit', label: 'Aufgabe 1', unit: 's' }, { key: 'a2', question: 'Aufgabe 2: Totzeit', label: 'Aufgabe 2', unit: 's' }, { key: 'a3', question: 'Aufgabe 3: Länge des Bandes', label: 'Aufgabe 3', unit: 'm' }],
      choices: [{ key: 'halb', q: 'Das Band läuft bei gleicher Länge doppelt so schnell. Was geschieht mit der Totzeit?', options: [{ value: 'halb', label: 'Sie halbiert sich' }, { value: 'doppelt', label: 'Sie verdoppelt sich' }, { value: 'gleich', label: 'Sie bleibt gleich' }] }],
      hintVals() { return hv(this, () => ({ L1: M38.b1.L, v1: M38.b1.v, t1: M38.t1, L2: M38.b2.L, v2: M38.b2.v, t2: M38.t2, v3: M38.b3.v, Tt3: M38.b3.Tt, L3: M38.l3 })); },
      get hint() { return hn(this, v => [
        'Die Totzeit ist die Zeit, die das Gut vom Stellglied am Bandanfang bis zur Waage am Bandende braucht. Zeit = Weg durch Geschwindigkeit. Bei Aufgabe 3 ist der Weg gesucht: Weg = Geschwindigkeit mal Zeit.',
        'Aufgabe 1: ' + fm(v.L1, 0) + ' m geteilt durch ' + fm(v.v1, 1) + ' m/s. Aufgabe 2: ' + fm(v.L2, 0) + ' m geteilt durch ' + fm(v.v2, 1) + ' m/s. Aufgabe 3: ' + fm(v.v3, 2) + ' m/s mal ' + fm(v.Tt3, 0) + ' s.',
        'Aufgabe 1: Tt = ' + fm(v.L1, 0) + ' m / ' + fm(v.v1, 1) + ' m/s = ' + fm(v.t1, 0) + ' s. Aufgabe 2: Tt = ' + fm(v.L2, 0) + ' m / ' + fm(v.v2, 1) + ' m/s = ' + fm(v.t2, 0) + ' s. Aufgabe 3: Länge = ' + fm(v.v3, 2) + ' m/s · ' + fm(v.Tt3, 0) + ' s = ' + fm(v.L3, 0) + ' m.']); },
      start: () => S({ fields: nulls(['a1', 'a2', 'a3']), choices: {} }), sol: () => S({ fields: { a1: M38.t1, a2: M38.t2, a3: M38.l3 }, choices: { halb: 'halb' } }), check: check38 },
    { id: 'rg39', lab: 'reg', cat: 'Strecke messen', title: 'Speicher zählen', level: 2, rig: '',
      text: 'Die Ordnungszahl n einer Regelstrecke ist die Zahl ihrer hintereinander liegenden Energiespeicher. Bestimme für jede der fünf Anordnungen die Ordnungszahl n.',
      choices: Q39.choices, hintVals() { return hv(this, () => ({})); },
      get hint() { return hn(this, () => [
        'Zähle die Speicher, die Energie oder Stoff aufnehmen (Wärme in einer Masse, Wasser in einem Behälter, Ladung in einem Kondensator). Jeder Speicher ist eine Verzögerung. Ohne Speicher gibt es keine Verzögerung.',
        'Mehrere Speicher hintereinander ergeben eine immer trägere Strecke: Die Sprungantwort startet flacher. Widerstände allein speichern nichts.',
        'Heizdraht mit Plättchen: n = 1. Heizelement, Block und Behälter: n = 2. Drei Behälter: n = 3. Spannungsteiler: n = 0. RC-Glied: n = 1.']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q39.sol() }), check: check39 },
    { id: 'rg40', lab: 'reg', cat: 'Strecke messen', title: 'Strecke beurteilen', level: 3, rig: '',
      get text() { const p = M40.p; return 'Von drei Temperaturstrecken wurden die Verzugszeit Tu und die Ausgleichszeit Tg aus der Sprungantwort bestimmt. Strecke A: Tu = ' + fm(p[0].Tu, 1) + ' s, Tg = ' + fm(p[0].Tg, 0) + ' s. Strecke B: Tu = ' + fm(p[1].Tu, 0) + ' s, Tg = ' + fm(p[1].Tg, 0) + ' s. Strecke C: Tu = ' + fm(p[2].Tu, 0) + ' s, Tg = ' + fm(p[2].Tg, 0) + ' s. Bilde für jede Strecke das Verhältnis Tg / Tu und beurteile die Regelbarkeit.'; },
      get fields() { return M40.p.map((q, i) => ({ key: 'v' + (i + 1), question: 'Strecke ' + q.n + ': Verhältnis Tg / Tu', label: 'Strecke ' + q.n, unit: '' })); },
      get choices() { return M40.p.map((q, i) => ({ key: 'u' + (i + 1), q: 'Wie ist die Regelbarkeit der Strecke ' + q.n + '?', options: [{ value: 'gut', label: 'Gut regelbar' }, { value: 'noch', label: 'Noch regelbar' }, { value: 'schwer', label: 'Schwer regelbar' }] })); },
      hintVals() { return hv(this, () => { const o = { g1: 10, g2: 3 }; M40.p.forEach((q, i) => { o['Tu' + (i + 1)] = q.Tu; o['Tg' + (i + 1)] = q.Tg; o['r' + (i + 1)] = q.ratio; }); return o; }); },
      get hint() { return hn(this, v => [
        'Je größer die Verzugszeit Tu im Vergleich zur Ausgleichszeit Tg ist, desto schwerer ist die Strecke zu regeln. Beurteilt wird das Verhältnis Tg / Tu.',
        'Als Richtwert gilt: Tg / Tu über ' + fm(v.g1, 0) + ' gut regelbar, von ' + fm(v.g2, 0) + ' bis ' + fm(v.g1, 0) + ' noch regelbar, unter ' + fm(v.g2, 0) + ' schwer regelbar.',
        'Strecke A: ' + fm(v.Tg1, 0) + ' / ' + fm(v.Tu1, 1) + ' = ' + fm(v.r1, 1) + ' (gut). Strecke B: ' + fm(v.Tg2, 0) + ' / ' + fm(v.Tu2, 0) + ' = ' + fm(v.r2, 1) + ' (noch regelbar). Strecke C: ' + fm(v.Tg3, 0) + ' / ' + fm(v.Tu3, 0) + ' = ' + fm(v.r3, 1) + ' (schwer regelbar).']); },
      start: () => S({ fields: nulls(['v1', 'v2', 'v3']), choices: {} }), sol: () => S({ fields: { v1: M40.p[0].ratio, v2: M40.p[1].ratio, v3: M40.p[2].ratio }, choices: { u1: M40.p[0].urteil, u2: M40.p[1].urteil, u3: M40.p[2].urteil } }), check: check40 },
    { id: 'rg41', lab: 'reg', cat: 'Regler verstehen', title: 'Reglerkennlinie: welche Reglerart', level: 2, rig: '',
      text: 'Vier Regler bekommen zum Zeitpunkt t = 0 einen Sprung der Regelabweichung e auf 2 % (gestrichelt). Die Diagramme zeigen die Stellgröße y jedes Reglers über der Zeit. Bestimme die Reglerart zu jeder Kurve. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Regelabweichung e (Sprung auf 2 % bei t = 0). Die Achse für y endet bei 12 %, höhere Werte sind abgeschnitten. Zeiten in Prozess-Sekunden (Übungswerte).', panels: M41.panels.map(p => ctrlPanel(p.name, p.typ, { Kp: M41.kp, Tn: M41.tn, Tv: M41.tv, e0: M41.e0, tEnd: M41.tEnd, yMax: M41.yMax })) })); },
      choices: Q41.choices, hintVals() { return hv(this, () => ({ e0: M41.e0, y0: M41.kp * M41.e0 })); },
      get hint() { return hn(this, v => [
        'Achte auf zwei Dinge: Springt die Stellgröße sofort auf einen Wert (P-Anteil)? Steigt sie danach weiter an (I-Anteil)? Gibt es am Anfang eine kurze Spitze (D-Anteil)?',
        'Der P-Regler springt auf Kp · e und bleibt dort. Der I-Regler beginnt bei null und steigt als Rampe. Der PI-Regler hat den Sprung und die Rampe. Der PID-Regler hat zusätzlich die kurze Spitze. Die Regelabweichung springt auf ' + fm(v.e0, 0) + ' %.',
        'Kurve A: PI-Regler (Sprung auf ' + fm(v.y0, 0) + ' %, dann Rampe). Kurve B: P-Regler (Sprung, dann waagerecht). Kurve C: PID-Regler (Spitze, Sprung und Rampe). Kurve D: I-Regler (nur Rampe ab null).']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q41.sol() }), check: check41 },
    { id: 'rg42', lab: 'reg', cat: 'Regler verstehen', title: 'Reglerkennlinie lesen', level: 2, rig: '',
      text: 'Das Diagramm zeigt die Stellgröße y eines PI-Reglers nach einem Sprung der Regelabweichung auf e = 2 % bei t = 0. Lies den Sprung von y am Anfang ab, bestimme daraus die Verstärkung Kp und lies die Nachstellzeit Tn ab. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Regelabweichung e (Sprung auf 2 % bei t = 0). Zeiten in Prozess-Sekunden (Übungswerte).', panels: [ctrlPanel('Stellgröße eines PI-Reglers', 'PI', { Kp: M42.Kp, Tn: M42.Tn, Tv: 0, e0: M42.e0, tEnd: M42.tEnd, yMax: 20 })] })); },
      fields: [{ key: 'y0', question: 'Sprung der Stellgröße y am Anfang', label: 'Sprung von y', unit: '%' }, { key: 'Kp', question: 'Verstärkung Kp', label: 'Kp', unit: '' }, { key: 'Tn', question: 'Nachstellzeit Tn', label: 'Tn', unit: 's' }],
      hintVals() { return hv(this, () => ({ e0: M42.e0, y0: M42.y0, Kp: M42.Kp, y2: M42.yTn, Tn: M42.Tn, ylo: M42.y0 - 1, yhi: M42.y0 + 1 })); },
      get hint() { return hn(this, v => [
        'Der Sprung am Anfang ist der P-Anteil: y = Kp · e. Danach steigt y durch den I-Anteil gleichmäßig an. Die Nachstellzeit Tn ist die Zeit, nach der der I-Anteil genauso groß geworden ist wie der P-Anteil, die Stellgröße sich also verdoppelt hat.',
        'Die Regelabweichung ist ' + fm(v.e0, 0) + ' %. Der Sprung von y liegt zwischen ' + fm(v.ylo, 0) + ' % und ' + fm(v.yhi, 0) + ' %. Suche die Zeit, bei der y doppelt so groß ist wie dieser Sprung.',
        'Sprung ' + fm(v.y0, 1) + ' %, also Kp = ' + fm(v.y0, 1) + ' / ' + fm(v.e0, 0) + ' = ' + fm(v.Kp, 1) + '. Verdoppelt auf ' + fm(v.y2, 0) + ' % ist y bei t = ' + fm(v.Tn, 0) + ' s: Tn = ' + fm(v.Tn, 0) + ' s.']); },
      start: () => S({ fields: nulls(['y0', 'Kp', 'Tn']) }), sol: () => S({ fields: { y0: M42.y0, Kp: M42.Kp, Tn: M42.Tn } }), check: check42 },
    { id: 'rg43', lab: 'reg', cat: 'Stabilität', title: 'Spitze und Endwert', level: 2, rig: '',
      text: 'Ein Regelkreis wird auf den Sollwert w = 50 % gefahren. Das Diagramm zeigt die Regelgröße x (gestrichelt: w). Lies den höchsten Wert von x und den Endwert ab und bestimme die Überschwingweite ü in Prozent des Endwerts. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Sollwert w. Zeiten in Prozess-Sekunden, Größen in % (Übungswerte).', panels: [closedPanel('Regelgröße nach dem Sollwertsprung', M43.cfg)] })); },
      fields: [{ key: 'xmax', question: 'Höchster Wert der Regelgröße x', label: 'x_max', unit: '%' }, { key: 'xend', question: 'Endwert der Regelgröße x', label: 'x_end', unit: '%' }, { key: 'ue', question: 'Überschwingweite ü', label: 'ü', unit: '%' }],
      hintVals() { return hv(this, () => { const a = M43.an; return { w: M43.cfg.w, mlo: Math.floor(a.xmax - 1), mhi: Math.ceil(a.xmax + 1), elo: a.xend - 1, ehi: a.xend + 1, xmax: a.xmax, xend: a.xend, ue: a.ueb }; }); },
      get hint() { return hn(this, v => [
        'Die Überschwingweite ü ist der Anteil, um den die Regelgröße über ihren Endwert hinausschießt: ü = (x_max − x_end) / x_end · 100 %. Lies erst die höchste Spitze ab, dann den Wert, bei dem die Kurve endet.',
        'Die höchste Spitze liegt zwischen ' + fm(v.mlo, 0) + ' % und ' + fm(v.mhi, 0) + ' %, der Endwert zwischen ' + fm(v.elo, 0) + ' % und ' + fm(v.ehi, 0) + ' %. Bezogen wird auf den Endwert.',
        'x_max = ' + fm(v.xmax, 1) + ' %, x_end = ' + fm(v.xend, 0) + ' %. ü = (' + fm(v.xmax, 1) + ' − ' + fm(v.xend, 0) + ') / ' + fm(v.xend, 0) + ' · 100 % = ' + fm(v.ue, 1) + ' %.']); },
      start: () => S({ fields: nulls(['xmax', 'xend', 'ue']) }), sol: () => S({ fields: { xmax: M43.an.xmax, xend: M43.an.xend, ue: M43.an.ueb } }), check: check43 },
    { id: 'rg44', lab: 'reg', cat: 'Stabilität', title: 'Zwei Kurven im Vergleich', level: 2, rig: '',
      text: 'Zwei Regelkreise haben denselben Regler und dieselbe Strecke, aber in einer der beiden Strecken steckt zusätzlich eine Totzeit. Beide wurden auf w = 50 % gefahren. Finde die Kurve mit Totzeit und lies die Überschwingweite ü beider Kurven in Prozent des Endwerts ab. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Sollwert w. Zeiten in Prozess-Sekunden, Größen in % (Übungswerte).', panels: [closedPanel('Kurve A', M44.cfgA), closedPanel('Kurve B', M44.cfgB)] })); },
      fields: [{ key: 'ueA', question: 'Überschwingweite ü von Kurve A', label: 'ü von A', unit: '%' }, { key: 'ueB', question: 'Überschwingweite ü von Kurve B', label: 'ü von B', unit: '%' }],
      choices: [{ key: 'tot', q: 'Zu welcher Kurve gehört die Strecke mit Totzeit?', options: [{ value: 'A', label: 'Kurve A' }, { value: 'B', label: 'Kurve B' }, { value: 'keine', label: 'Beide Kurven gehören zu Strecken ohne Totzeit' }] }],
      hintVals() { return hv(this, () => ({ tt: M44.tt, ueA: M44.aA.ueb, ueB: M44.aB.ueb, w: 50 })); },
      get hint() { return hn(this, v => [
        'Bei einer Strecke mit Totzeit bleibt x nach dem Start zunächst auf null stehen: Die Wirkung kommt erst verspätet an. Der Regler baut in dieser Zeit weiter Stellgröße auf, deshalb schwingt der Kreis stärker über. Die Überschwingweite ist ü = (x_max − x_end) / x_end · 100 %.',
        'Vergleiche die Anfänge der Kurven: In einer bleibt x zuerst auf null. Lies bei beiden die höchste Spitze ab. Der Endwert ist der Sollwert ' + fm(v.w, 0) + ' %.',
        'Kurve A hat die Totzeit ' + fm(v.tt, 1) + ' s: ü = ' + fm(v.ueA, 0) + ' %. Kurve B hat keine Totzeit: ü = ' + fm(v.ueB, 0) + ' %.']); },
      start: () => S({ fields: nulls(['ueA', 'ueB']), choices: {} }), sol: () => S({ fields: { ueA: M44.aA.ueb, ueB: M44.aB.ueb }, choices: { tot: 'A' } }), check: check44 },
    { id: 'rg45', lab: 'reg', cat: 'Stabilität', title: 'Verhalten beurteilen', level: 1, rig: '',
      text: 'Drei Regelkreise werden jeweils auf den Sollwert w = 50 % gefahren. Die Diagramme zeigen die Regelgröße x (gestrichelt: w). Beurteile das Verhalten jedes Kreises. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Sollwert w. Höhere und tiefere Werte sind abgeschnitten. Zeiten in Prozess-Sekunden (Übungswerte).', panels: M45.panels.map(p => closedPanel(p.name, p.cfg, { clip: true })) })); },
      choices: Q45.choices, hintVals() { return hv(this, () => ({ w: M45.w })); },
      get hint() { return hn(this, () => [
        'Vergleiche die Höhe aufeinanderfolgender Spitzen in derselben Richtung: Werden sie kleiner, ist der Kreis stabil. Bleiben sie gleich, ist er an der Grenze (Dauerschwingung). Werden sie größer, ist er instabil.',
        'Stabil: Die Kurve beruhigt sich und geht auf den Sollwert. Grenzstabil: Die Schwingung bleibt dauernd gleich groß. Instabil: Jede Spitze ist größer als die vorige, die Kurve läuft aus dem Diagramm.',
        'Kurve A: instabil. Kurve B: stabil. Kurve C: grenzstabil.']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q45.sol() }), check: check45 },
    { id: 'rg46', lab: 'reg', cat: 'Führung und Störung', title: 'Störung oder Führung', level: 2, rig: '',
      text: 'Beide Regelkreise sind eingeschwungen, dann ändert sich etwas. In einer Kurve wird der Sollwert verstellt, in der anderen wirkt eine Störgröße auf die Strecke. Das Diagramm zeigt die Regelgröße x (gestrichelt: w). Finde heraus, was in welcher Kurve geschieht, und lies den Zeitpunkt der Änderung ab. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Sollwert w. Zeiten in Prozess-Sekunden, Größen in % (Übungswerte); die Achse für x beginnt bei 30 %.', panels: [closedPanel('Kurve A', M46.cfgA, { y: [30, 70] }), closedPanel('Kurve B', M46.cfgB, { y: [30, 70] })] })); },
      fields: [{ key: 'tA', question: 'Zeitpunkt der Änderung in Kurve A', label: 'Zeitpunkt A', unit: 's' }, { key: 'tB', question: 'Zeitpunkt der Änderung in Kurve B', label: 'Zeitpunkt B', unit: 's' }],
      choices: [{ key: 'was', q: 'Was ändert sich in den Kurven?', options: OPT46.map(o => ({ value: o[0], label: o[1] })) }],
      hintVals() { return hv(this, () => ({ tA: M46.tw, tB: M46.tz, wlo: 40, whi: 60 })); },
      get hint() { return hn(this, v => [
        'Schau auf die gestrichelte Linie: Bei einer Änderung der Führungsgröße (Sollwert) springt w, und x folgt. Bei einer Störgröße bleibt w unverändert, und x bricht von allein aus, bevor der Regler es zurückführt.',
        'In einer der Kurven springt der Sollwert zwischen ' + fm(v.wlo, 0) + ' % und ' + fm(v.whi, 0) + ' %. Der Zeitpunkt ist der Moment, in dem die Kurve (oder die gestrichelte Linie) zum ersten Mal von ihrem ruhigen Wert abweicht.',
        'Kurve A: Der Sollwert springt bei t = ' + fm(v.tA, 0) + ' s. Kurve B: Eine Störgröße wirkt ab t = ' + fm(v.tB, 0) + ' s.']); },
      start: () => S({ fields: nulls(['tA', 'tB']), choices: {} }), sol: () => S({ fields: { tA: M46.tw, tB: M46.tz }, choices: { was: 'AwBz' } }), check: check46 },
    { id: 'rg47', lab: 'reg', cat: 'Führung und Störung', title: 'Zeit bis zur Ruhe', level: 2, rig: '',
      text: 'Ein Regelkreis wird auf den Sollwert w = 50 % gefahren. Im Diagramm ist das Toleranzband von ±2 % um den Sollwert eingezeichnet (grau). Lies die Ausregelzeit ab, also die Zeit, ab der x dauerhaft im Band bleibt, und beurteile die bleibende Regelabweichung. ' + NOTE_FIG,
      figure() { return fg(this, () => ({ caption: 'Gestrichelt: Sollwert w, grau: Toleranzband ±2 % um w. Zeiten in Prozess-Sekunden (Übungswerte).', panels: [closedPanel('Regelgröße nach dem Sollwertsprung', M47.cfg, { band: true })] })); },
      fields: [{ key: 'taus', question: 'Ausregelzeit', label: 'Ausregelzeit', unit: 's' }],
      choices: [{ key: 'ebl', q: 'Bleibt am Ende eine Regelabweichung?', options: [{ value: 'nein', label: 'Nein, x erreicht den Sollwert' }, { value: 'ja', label: 'Ja, x bleibt dauerhaft unter dem Sollwert' }] }],
      hintVals() { return hv(this, () => ({ lo: M47.cfg.w * 0.98, hi: M47.cfg.w * 1.02, taus: M47.an.taus, w: M47.cfg.w })); },
      get hint() { return hn(this, v => [
        'Die Ausregelzeit ist der Zeitpunkt, ab dem die Kurve das Toleranzband nicht mehr verlässt. Gehe die Kurve von rechts nach links, bis sie zum letzten Mal das Band verlässt.',
        'Das Band liegt von ' + fm(v.lo, 0) + ' % bis ' + fm(v.hi, 0) + ' %. Suche den Punkt, an dem die Kurve die untere Bandkante ' + fm(v.lo, 0) + ' % zum letzten Mal von unten nach oben durchläuft.',
        'Die Kurve tritt bei t = ' + fm(v.taus, 1) + ' s ins Band ein und bleibt darin: Ausregelzeit ' + fm(v.taus, 1) + ' s. Sie endet beim Sollwert ' + fm(v.w, 0) + ' %: keine bleibende Regelabweichung.']); },
      start: () => S({ fields: nulls(['taus']), choices: {} }), sol: () => S({ fields: { taus: M47.an.taus }, choices: { ebl: 'nein' } }), check: check47 },
    { id: 'rg48', lab: 'reg', cat: 'Strecke messen', title: 'Übertragungsbeiwert eines Ofens', level: 1, rig: '',
      get text() { const m = M48; return 'Ein elektrisch beheizter Ofen wird mit dem Heizstrom gestellt. Bei ' + fm(m.y1, 0) + ' A stellt sich nach langer Zeit eine Temperatur von ' + fm(m.x1, 0) + ' °C ein, bei ' + fm(m.y2, 0) + ' A sind es ' + fm(m.x2, 0) + ' °C (Beharrungswerte, Übungswerte). Berechne (1) den Übertragungsbeiwert Ks der Strecke und (2) die Temperatur, die sich bei ' + fm(m.y3, 0) + ' A einstellt, wenn sich die Strecke in diesem Bereich gleich verhält.'; },
      fields: [{ key: 'Ks', question: '(1) Übertragungsbeiwert Ks', label: 'Ks', unit: 'K/A' }, { key: 'x3', question: '(2) Temperatur beim neuen Strom', label: 'Temperatur', unit: '°C' }],
      hintVals() { return hv(this, () => ({ dx: M48.x2 - M48.x1, dy: M48.y2 - M48.y1, Ks: M48.Ks, x2: M48.x2, dy3: M48.y3 - M48.y2, x3: M48.x3 })); },
      get hint() { return hn(this, v => [
        'Der Übertragungsbeiwert sagt, um wie viel sich die Regelgröße im Beharrungszustand ändert, wenn die Stellgröße um eine Einheit geändert wird. Es zählen die Änderungen, nicht die Werte selbst.',
        'Die Temperatur ändert sich um ' + fm(v.dx, 0) + ' K, der Strom um ' + fm(v.dy, 0) + ' A. Für Teil (2) rechnest du vom höheren Beharrungswert aus mit der neuen Stromänderung weiter.',
        'Ks = ' + fm(v.dx, 0) + ' K / ' + fm(v.dy, 0) + ' A = ' + fm(v.Ks, 0) + ' K/A. Temperatur = ' + fm(v.x2, 0) + ' °C + ' + fm(v.Ks, 0) + ' K/A · ' + fm(v.dy3, 0) + ' A = ' + fm(v.x3, 0) + ' °C.']); },
      start: () => S({ fields: nulls(['Ks', 'x3']) }), sol: () => S({ fields: { Ks: M48.Ks, x3: M48.x3 } }), check: check48 },
    { id: 'rg49', lab: 'reg', cat: 'Zweipunkt', title: 'Kennwerte eines Zweipunktreglers', level: 2, rig: '',
      get text() { const m = M49; return 'Ein Wärmeschrank wird von einem Zweipunktregler geheizt: Die Heizung ist entweder ganz aus (' + fm(m.y0, 0) + ' A) oder ganz ein (' + fm(m.ym, 0) + ' A). Ganz aus stellt sich die Raumtemperatur von ' + fm(m.x0, 0) + ' °C ein, dauernd ein würden ' + fm(m.xm, 0) + ' °C erreicht. Der Regler schaltet die Heizung bei ' + fm(m.xo, 0) + ' °C aus und bei ' + fm(m.xu, 0) + ' °C wieder ein. Berechne den Übertragungsbeiwert Ks, die Schaltdifferenz x_sd, den Mittelwert der Temperatur (ohne Verzugszeit gerechnet) und den Stellbereich Xh der Regelgröße.'; },
      fields: [{ key: 'Ks', question: 'Übertragungsbeiwert Ks', label: 'Ks', unit: 'K/A' }, { key: 'xsd', question: 'Schaltdifferenz x_sd', label: 'x_sd', unit: 'K' }, { key: 'xmit', question: 'Mittelwert der Temperatur', label: 'Mittelwert', unit: '°C' }, { key: 'Xh', question: 'Stellbereich Xh der Regelgröße', label: 'Xh', unit: 'K' }],
      hintVals() { return hv(this, () => ({ Xh: M49.Xh, ym: M49.ym, Ks: M49.Ks, xo: M49.xo, xu: M49.xu, xsd: M49.xsd, xmit: M49.xmit, xm: M49.xm, x0: M49.x0 })); },
      get hint() { return hn(this, v => [
        'Beim Zweipunktregler gibt es nur zwei Stellungen. Der Stellbereich der Regelgröße ist der Unterschied der Temperaturen bei ganz ein und ganz aus, der Übertragungsbeiwert bezieht ihn auf den Stromunterschied. Die Schaltdifferenz ist der Abstand der beiden Schaltpunkte.',
        'Stellbereich: ' + fm(v.xm, 0) + ' °C − ' + fm(v.x0, 0) + ' °C. Diesen Wert teilst du durch ' + fm(v.ym, 0) + ' A. Schaltdifferenz: ' + fm(v.xo, 0) + ' °C − ' + fm(v.xu, 0) + ' °C. Der Mittelwert liegt genau zwischen den Schaltpunkten.',
        'Xh = ' + fm(v.Xh, 0) + ' K, Ks = ' + fm(v.Xh, 0) + ' K / ' + fm(v.ym, 0) + ' A = ' + fm(v.Ks, 0) + ' K/A. x_sd = ' + fm(v.xsd, 0) + ' K. Mittelwert = (' + fm(v.xo, 0) + ' + ' + fm(v.xu, 0) + ') / 2 = ' + fm(v.xmit, 0) + ' °C.']); },
      start: () => S({ fields: nulls(['Ks', 'xsd', 'xmit', 'Xh']) }), sol: () => S({ fields: { Ks: M49.Ks, xsd: M49.xsd, xmit: M49.xmit, Xh: M49.Xh } }), check: check49 },
    { id: 'rg50', lab: 'reg', cat: 'Zweipunkt', title: 'Wie weit pendelt die Temperatur?', level: 3, rig: '',
      get text() { const m = M50; return 'Ein Trockenschrank wird mit einem Zweipunktregler beheizt. Ganz aus hat er ' + fm(m.x0, 0) + ' °C, dauernd geheizt würde er ' + fm(m.xm, 0) + ' °C erreichen. Aus der Sprungantwort sind die Verzugszeit Tu = ' + fm(m.Tu, 1) + ' min und die Ausgleichszeit Tg = ' + fm(m.Tg, 0) + ' min bekannt. Der Regler schaltet bei ' + fm(m.xo, 0) + ' °C aus und bei ' + fm(m.xu, 0) + ' °C ein. Berechne (vereinfachte Näherung: nur das Überschwingen am Ausschaltpunkt) die Anstiegsgeschwindigkeit der Temperatur, das Überschwingen über den Ausschaltpunkt und die Schwankungsbreite der Temperatur. Beurteile danach die Regelbarkeit der Strecke.'; },
      fields: [{ key: 'v', question: 'Anstiegsgeschwindigkeit v', label: 'v', unit: 'K/min' }, { key: 'ueb', question: 'Überschwingen über den Ausschaltpunkt', label: 'Überschwingen', unit: 'K' }, { key: 'dx', question: 'Schwankungsbreite Δx', label: 'Δx', unit: 'K' }],
      choices: [{ key: 'urteil', q: 'Wie ist die Strecke nach dem Verhältnis Tg / Tu zu beurteilen?', options: [{ value: 'gut', label: 'Gut regelbar' }, { value: 'noch', label: 'Noch regelbar' }, { value: 'schwer', label: 'Schwer regelbar' }] }],
      hintVals() { return hv(this, () => ({ Xh: M50.Xh, Tg: M50.Tg, Tu: M50.Tu, v: M50.v, ueb: M50.ueb, xsd: M50.xsd, dx: M50.dx, ratio: M50.g.ratio, xm: M50.xm, x0: M50.x0 })); },
      get hint() { return hn(this, v => [
        'Nach dem Abschalten steigt die Temperatur während der Verzugszeit noch weiter, nach dem Einschalten fällt sie noch weiter. Die Wendetangente der Sprungantwort durchläuft den ganzen Stellbereich in der Ausgleichszeit: Daraus folgt die Anstiegsgeschwindigkeit.',
        'Stellbereich Xh = ' + fm(v.xm, 0) + ' °C − ' + fm(v.x0, 0) + ' °C = ' + fm(v.Xh, 0) + ' K. v = Xh / Tg, Überschwingen ≈ v · Tu, Schwankungsbreite ≈ x_sd + Überschwingen. Für die Regelbarkeit bildest du Tg / Tu.',
        'v = ' + fm(v.Xh, 0) + ' K / ' + fm(v.Tg, 0) + ' min = ' + fm(v.v, 1) + ' K/min. Überschwingen = ' + fm(v.v, 1) + ' K/min · ' + fm(v.Tu, 1) + ' min = ' + fm(v.ueb, 0) + ' K. Δx = ' + fm(v.xsd, 0) + ' K + ' + fm(v.ueb, 0) + ' K = ' + fm(v.dx, 0) + ' K. Tg / Tu = ' + fm(v.ratio, 0) + ': gut regelbar.']); },
      start: () => S({ fields: nulls(['v', 'ueb', 'dx']), choices: {} }), sol: () => S({ fields: { v: M50.v, ueb: M50.ueb, dx: M50.dx }, choices: { urteil: M50.g.urteil } }), check: check50 },
    { id: 'rg51', lab: 'reg', cat: 'Strecke messen', title: 'Streckenart aus dem Verhalten', level: 2, rig: '',
      text: 'Ordne jeder Anlage die passende Streckenart zu. Beschrieben ist jeweils, wie sich die gemessene Größe nach einer sprunghaften Änderung am Eingang verhält.',
      choices: Q51.choices, hintVals() { return hv(this, () => ({})); },
      get hint() { return hn(this, () => [
        'Frage zuerst: Findet die Größe nach dem Sprung einen neuen festen Wert (mit Ausgleich) oder wächst sie immer weiter (ohne Ausgleich)? Frage dann: Reagiert sie sofort, verzögert über Speicher oder erst nach einer Wartezeit?',
        'Sofort und ohne Verzögerung: P-Strecke. Sofortiger Anstieg, der langsam abflacht: ein Speicher. Flacher Beginn mit Wendepunkt: mehrere Speicher. Unverändert, aber später: Totzeit. Gleichmäßiges Weiterwachsen: I-Strecke.',
        'Behälter mit dichtem Ablauf: I-Strecke. Hebel: P ohne Verzögerung. Schüttgut auf dem Band: Totzeit. Motor mit Schwungscheibe: PT1. Heizkreis mit Raum: mehrere Speicher. Spindel: I-Strecke.']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q51.sol() }), check: check51 },
    { id: 'rg52', lab: 'reg', cat: 'Grundlagen', title: 'Größen am Drehzahlregelkreis', level: 1, rig: '',
      text: 'Die Drehzahl eines Gleichstrommotors wird geregelt: Ein Sollwertpotentiometer gibt den Sollwert vor, ein Tachogenerator auf der Welle misst die Drehzahl, ein Regler vergleicht beide und steuert einen Stromrichter, der die Ankerspannung liefert. Ordne jeder Beschreibung die passende Größe zu.',
      choices: Q52.choices, hintVals() { return hv(this, () => ({})); },
      get hint() { return hn(this, () => [
        'Unterscheide die Drehzahl selbst von dem Signal, das die Messeinrichtung daraus macht. Der Vergleicher bekommt nicht die Drehzahl, sondern eine Spannung.',
        'Die Größe, die konstant bleiben soll, ist die Regelgröße. Ihr gemessenes Abbild, das zum Vergleicher zurückläuft, ist die Rückführgröße. Was der Bediener einstellt, ist die Führungsgröße, was der Regler ausgibt, die Stellgröße.',
        'Drehzahl: x. Tachospannung: r. Sollwertpoti: w. Ankerspannung: y. Bremsmoment der Last: z. Differenz am Vergleicher: e.']); },
      start: () => S({ choices: {} }), sol: () => S({ choices: Q52.sol() }), check: check52 },
    { id: 'rg53', lab: 'reg', cat: 'Grundlagen', title: 'Drehzahlabweichung aus der Tachospannung', level: 2, rig: '',
      get text() { const m = M53; return 'Ein Tachogenerator liefert ' + fm(m.kT, 0) + ' V je 1000 1/min. Am Sollwertpotentiometer sind ' + fm(m.w, 0) + ' V eingestellt, der Tachogenerator liefert gerade ' + fm(m.r, 1) + ' V. Berechne (1) die Istdrehzahl, (2) die Regelabweichung e in Volt (Vorzeichen beachten) und (3), wie viele Umdrehungen pro Minute bis zum Sollwert fehlen.'; },
      fields: [{ key: 'n', question: '(1) Istdrehzahl', label: 'Istdrehzahl', unit: '1/min' }, { key: 'e', question: '(2) Regelabweichung e', label: 'e', unit: 'V' }, { key: 'dn', question: '(3) fehlende Drehzahl', label: 'fehlende Drehzahl', unit: '1/min' }],
      hintVals() { return hv(this, () => ({ kT: M53.kT, r: M53.r, w: M53.w, n: M53.n, e: M53.e, dn: M53.dn, ns: M53.ns })); },
      get hint() { return hn(this, v => [
        'Die Tachospannung ist proportional zur Drehzahl. Wenn du weißt, wie viel Volt zu 1000 1/min gehören, kannst du jede Spannung in eine Drehzahl umrechnen. Die Regelabweichung ist Sollwert minus Rückführgröße.',
        'Drehzahl = Tachospannung / ' + fm(v.kT, 0) + ' V · 1000 1/min. e = ' + fm(v.w, 0) + ' V − ' + fm(v.r, 1) + ' V. Die fehlende Drehzahl rechnest du genauso aus der Spannungsdifferenz.',
        'n = ' + fm(v.r, 1) + ' / ' + fm(v.kT, 0) + ' · 1000 = ' + fm(v.n, 0) + ' 1/min. e = ' + fm(v.e, 1) + ' V. Fehlend: ' + fm(v.e, 1) + ' / ' + fm(v.kT, 0) + ' · 1000 = ' + fm(v.dn, 0) + ' 1/min (Solldrehzahl ' + fm(v.ns, 0) + ' 1/min).']); },
      start: () => S({ fields: nulls(['n', 'e', 'dn']) }), sol: () => S({ fields: { n: M53.n, e: M53.e, dn: M53.dn } }), check: check53 }
  ];
  /* start() und sol() werfen nie */
  list.forEach(k => ['start', 'sol'].forEach(f => { const g = k[f]; k[f] = function () { try { return g.apply(k, arguments); } catch (e) { return { rig: '', controls: {}, error: String(e && e.message || e) }; } }; }));
  T.sims3 = { M34, M35, M36, M37, M38, M40, M41, M42, M43, M44, M45, M46, M47, M48, M49, M50, M53, Q31, Q32, Q33, Q39, Q41, Q45, Q51, Q52, K };
  T.register(list);
  if (typeof module !== 'undefined') module.exports = { tasks: list, kurve: K, sims: T.sims3 };
})(typeof window !== 'undefined' ? window : globalThis);
