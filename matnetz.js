'use strict';
/* Tonfunk Rechen-Lab: Widerstandsnetzwerke (Kern, reine Logik ohne Oberfläche, auch per Node testbar).
   Netzwerk = Baum aus Reihen- (S) und Parallelgruppen (P) mit Einzelwiderständen (R) als Blättern: rein reihen-parallel, keine Brücken,
   2 bis 10 Widerstände, eine ideale Gleichspannungsquelle U. Gruppen wechseln sich ab (in einer Reihengruppe liegen nur Widerstände oder
   Parallelgruppen, und umgekehrt).
   Inhalt: Generator mit Startwert je Stufe (gen), Berechnung mit Selbstprüfung (selbst), Lösungsweg als Liste von Zusammenfassungen
   (loesung), Antwortprüfung mit Einheiten und Fehlererkennung (liesAntwort, pruefe).
   Formeln wie im Tabellenbuch Elektrotechnik: Reihe R = R1 + R2 + ..., parallel 1/R = 1/R1 + 1/R2 + ... (zwei Widerstände
   R = R1 · R2 / (R1 + R2)), U = R · I, P = U · I, Pges = U · Iges = Summe der Einzelleistungen.
   Export: window.MAT_NETZ bzw. module.exports (Node). Benötigt matcore.js (rng, roundSig, fmt). */
(function (root) {
  const C = root.MAT_CORE || (typeof require !== 'undefined' ? require('./matcore.js') : null);
  const fin = v => typeof v === 'number' && isFinite(v);
  const MU = 'µ', OHM = 'Ω';

  /* ---------------- Widerstandswerte (E12, 100 Ω bis 10 kΩ) ---------------- */
  const E12M = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  const E12 = [].concat(E12M.map(m => m * 10), E12M.map(m => m * 100), [10000]);
  const POOL = {
    p1: [100, 220, 330, 470, 1000],
    p2: [100, 150, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700],
    p3: E12,
    p8: E12.filter(v => v <= 4700)
  };
  const SPANNUNGEN = [5, 9, 12, 24];
  const BELASTBARKEIT = 0.25;   /* W, übliche Bauform */

  /* ---------------- Stufen ---------------- */
  /* anz: Anzahl Widerstände von bis; art: S (alle in Reihe), P (alle parallel), rein (S oder P), gem (gemischt, Tiefe mind. tiefe)
     parMax/serMax: größtes Verhältnis zwischen größtem und kleinstem Wert in einer Parallel- bzw. Reihengruppe (keine absurden Mischungen) */
  const STUFEN = [
    { n: 1, titel: 'Zwei Widerstände in Reihe', gesucht: 'Rges, I, U1, U2', anz: [2, 2], art: 'S', pool: 'p1', parMax: 5, serMax: 20, teilN: 2,
      info: [{ t: 'Bei der Reihenschaltung liegen die Widerstände hintereinander. Durch beide fließt derselbe Strom. Die Spannung teilt sich auf.' },
        { f: 'Rges = R1 + R2' }, { f: 'I = U / Rges' }, { f: 'U1 = R1 · I' }, { f: 'U2 = R2 · I' },
        { t: 'Probe: U1 + U2 ist wieder die Quellenspannung U.' }] },
    { n: 2, titel: 'Zwei Widerstände parallel', gesucht: 'Rges, Iges, I1, I2', anz: [2, 2], art: 'P', pool: 'p1', parMax: 5, serMax: 20, teilN: 2,
      info: [{ t: 'Bei der Parallelschaltung liegen die Widerstände nebeneinander. An beiden liegt dieselbe Spannung. Der Strom teilt sich auf.' },
        { f: '1/Rges = 1/R1 + 1/R2' }, { f: 'Rges = R1 · R2 / (R1 + R2)' }, { f: 'Iges = U / Rges' }, { f: 'I1 = U / R1' }, { f: 'I2 = U / R2' },
        { t: 'Rges ist immer kleiner als der kleinste Einzelwiderstand. Probe: I1 + I2 ist wieder Iges.' }] },
    { n: 3, titel: 'Drei Widerstände in Reihe oder parallel', gesucht: 'Rges, Iges und zwei Teilwerte', anz: [3, 3], art: 'rein', pool: 'p2', parMax: 5, serMax: 20, teilN: 2,
      info: [{ t: 'Bei drei Widerständen sind alle in Reihe oder alle parallel. Schau im Schaltbild, welche Schaltung es ist.' },
        { f: 'Reihe: Rges = R1 + R2 + R3' }, { f: 'parallel: 1/Rges = 1/R1 + 1/R2 + 1/R3' },
        { t: 'Danach wie vorher: Iges = U / Rges. Dann die Teilgrößen: in Reihe U = R · I (derselbe Strom), parallel I = U / R (dieselbe Spannung).' }] },
    { n: 4, titel: 'Gemischte Schaltung mit drei Widerständen', gesucht: 'Rges, Iges und zwei Teilwerte', anz: [3, 3], art: 'gem', tiefe: 2, pool: 'p2', parMax: 5, serMax: 20, teilN: 2,
      info: [{ t: 'Gemischte Schaltung: Fasse von innen nach außen zusammen. Suche zuerst die Gruppe, die nur aus einer Reihenschaltung oder nur aus einer Parallelschaltung besteht, und ersetze sie durch einen Ersatzwiderstand.' },
        { t: 'Form R1 + (R2 ‖ R3): erst die Parallelschaltung, dann die Reihe.' }, { f: 'R23 = R2 · R3 / (R2 + R3)' }, { f: 'Rges = R1 + R23' },
        { t: 'Form (R1 + R2) ‖ R3: erst die Reihe, dann die Parallelschaltung.' }, { f: 'R12 = R1 + R2' }, { f: 'Rges = R12 · R3 / (R12 + R3)' },
        { t: 'Danach rückwärts: Iges = U / Rges. In einer Reihenschaltung ist der Strom gleich (U = R · I), in einer Parallelschaltung die Spannung (I = U / R).' }] },
    { n: 5, titel: 'Gemischte Schaltung mit vier bis fünf Widerständen', gesucht: 'Rges, Iges und zwei Teilwerte', anz: [4, 5], art: 'gem', tiefe: 2, pool: 'p3', parMax: 8, serMax: 20, teilN: 2,
      info: [{ t: 'Gleiche Methode, mehr Widerstände: Fasse immer die innerste Gruppe zuerst zusammen und zeichne die Schaltung danach neu. Wiederhole das, bis nur noch Rges übrig ist.' },
        { t: 'Teilspannungen und Teilströme findest du rückwärts: Iges, dann die Spannung an der Gruppe, dann der Strom durch den einzelnen Widerstand.' },
        { f: 'Reihe: gleicher Strom, U = R · I' }, { f: 'parallel: gleiche Spannung, I = U / R' }] },
    { n: 6, titel: 'Gemischte Schaltung mit sechs bis sieben Widerständen', gesucht: 'Rges, Iges und drei Teilwerte', anz: [6, 7], art: 'gem', tiefe: 3, pool: 'p3', parMax: 8, serMax: 20, teilN: 3,
      info: [{ t: 'Bei vielen Widerständen hilft Ordnung: Zeichne nach jedem Schritt die Ersatzschaltung neu und gib dem Ersatzwiderstand einen Namen, zum Beispiel R23.' },
        { t: 'Probe zum Schluss: In jeder Reihengruppe ergeben die Teilspannungen zusammen die Spannung der Gruppe. In jeder Parallelgruppe ergeben die Teilströme zusammen den Strom der Gruppe.' }] },
    { n: 7, titel: 'Gemischte Schaltung mit acht bis zehn Widerständen', gesucht: 'Rges, Iges und drei Teilwerte', anz: [8, 10], art: 'gem', tiefe: 3, pool: 'p3', parMax: 8, serMax: 20, teilN: 3,
      info: [{ t: 'Auch große Netzwerke bestehen nur aus Reihen- und Parallelgruppen. Gehe in Ruhe von innen nach außen, Schritt für Schritt. Das Bild lässt sich seitlich verschieben.' },
        { t: 'Rechne erst Rges und Iges aus. Teilwerte brauchst du nur für die gefragten Widerstände: arbeite dafür rückwärts durch die Gruppen.' }] },
    { n: 8, titel: 'Leistung im Netzwerk', gesucht: 'Rges, Pges, zwei Einzelleistungen, wärmster Widerstand, Belastbarkeit', anz: [2, 5], art: 'leistung', pool: 'p8', parMax: 6, serMax: 20, teilN: 2,
      info: [{ t: 'Jeder Widerstand setzt elektrische Leistung in Wärme um.' },
        { f: 'P = U · I' }, { f: 'P = I² · R' }, { f: 'P = U² / R' },
        { t: 'Die Gesamtleistung Pges = U · Iges ist genauso groß wie die Summe aller Einzelleistungen. Der Widerstand mit der größten Leistung wird am wärmsten.' },
        { t: 'Ein Widerstand darf höchstens so viel Leistung umsetzen, wie seine Belastbarkeit erlaubt (üblich ist zum Beispiel 0,25 W). Vergleiche dafür seine Leistung mit diesem Wert.' }] }
  ];

  /* ---------------- Zahlen und Einheiten ---------------- */
  const BASIS = { R: OHM, I: 'A', U: 'V', P: 'W', G: 'S' };
  const LEITER = {
    R: [[1e6, 'M' + OHM], [1e3, 'k' + OHM], [1, OHM]], I: [[1, 'A'], [1e-3, 'mA'], [1e-6, MU + 'A']], U: [[1, 'V'], [1e-3, 'mV']],
    P: [[1, 'W'], [1e-3, 'mW'], [1e-6, MU + 'W']], G: [[1, 'S'], [1e-3, 'mS'], [1e-6, MU + 'S']]
  };
  /* Wert mit Einheit und Vorsatz, 3 gültige Stellen, deutsches Komma: fw(1230, 'R') = "1,23 kΩ" */
  function fw(v, q) {
    const L = LEITER[q]; if (!fin(v) || !L) return '–';
    if (v === 0) return '0 ' + BASIS[q];
    const a = Math.abs(C.roundSig(Math.abs(v), 3)); let u = L[L.length - 1];
    for (const o of L) if (a >= o[0]) { u = o; break; }
    return C.fmt(C.roundSig(v / u[0], 3), 6) + ' ' + u[1];
  }
  const EINH = { R: [OHM, 'k' + OHM], I: ['mA', 'A', MU + 'A'], U: ['V', 'mV'], P: ['mW', 'W'] };   /* Auswahl im Eingabefeld, erste = Vorgabe */
  const FAKTOR = { [OHM]: 1, ['k' + OHM]: 1e3, ['M' + OHM]: 1e6, A: 1, mA: 1e-3, [MU + 'A']: 1e-6, V: 1, mV: 1e-3, kV: 1e3, W: 1, mW: 1e-3, [MU + 'W']: 1e-6, kW: 1e3 };
  const ART = { [OHM]: 'R', ['k' + OHM]: 'R', ['M' + OHM]: 'R', A: 'I', mA: 'I', [MU + 'A']: 'I', V: 'U', mV: 'U', kV: 'U', W: 'P', mW: 'P', [MU + 'W']: 'P', kW: 'P' };
  const GESUCHT = { R: 'ein Widerstand (Einheit Ω oder kΩ)', I: 'ein Strom (Einheit mA oder A)', U: 'eine Spannung (Einheit V oder mV)', P: 'eine Leistung (Einheit mW oder W)' };

  function normEinheit(tok, q) {
    let t = String(tok || '').replace(/[\s.]/g, '').replace(/Ω/g, OHM).replace(/ohm/gi, OHM).replace(/ω/g, OHM).replace(/[μ]/g, MU);
    t = t.replace(/^u(?=[AWVΩ])/, MU);
    if (!t) return null;
    if (Object.prototype.hasOwnProperty.call(FAKTOR, t)) return t;
    const tl = t.toLowerCase();
    for (const k of Object.keys(FAKTOR)) if (k !== 'M' + OHM && k.toLowerCase() === tl) return k;
    if (q && (t === 'k' || t === 'm' || t === MU)) { const e = t + BASIS[q]; if (FAKTOR[e] && ART[e] === q) return e; }
    return null;
  }
  /* Eingabe lesen: Zahl mit Komma oder Punkt, Einheit entweder dahinter getippt (überschreibt) oder aus der Auswahl uSel */
  function liesAntwort(text, q, uSel) {
    const s = String(text == null ? '' : text).trim(); if (!s) return { leer: true };
    const m = /^([+\-−]?)\s*(\d[\d.,]*|[.,]\d+)\s*(.*)$/.exec(s);
    if (!m) return { fehler: 'Das ist keine Zahl. Schreibe die Zahl mit Komma oder Punkt, zum Beispiel 4,7.' };
    let z = m[2];
    if (z.indexOf(',') >= 0 && z.indexOf('.') >= 0) z = z.replace(/\./g, '').replace(',', '.');
    else if ((z.match(/\./g) || []).length > 1) z = z.replace(/\./g, '');
    else z = z.replace(',', '.');
    let v = parseFloat(z); if (!fin(v)) return { fehler: 'Das ist keine Zahl. Schreibe die Zahl mit Komma oder Punkt, zum Beispiel 4,7.' };
    if (m[1] === '-' || m[1] === '−') v = -v;
    let e;
    const tok = m[3].trim();
    if (tok) {
      e = normEinheit(tok, q);
      if (!e) return { fehler: 'Die Einheit „' + tok + '“ kenne ich hier nicht. Wähle sie rechts neben dem Feld aus.' };
      if (ART[e] !== q) return { fehler: 'Die Einheit ' + e + ' passt nicht: Gesucht ist ' + GESUCHT[q] + '.' };
    } else e = uSel;
    if (!e || !FAKTOR[e] || ART[e] !== q) e = EINH[q][0];
    return { wert: v * FAKTOR[e], einheit: e, zahl: v };
  }
  /* erlaubte Abweichung: 1 % des Sollwerts, mindestens die halbe Einheit der dritten gültigen Stelle (Rundung auf 3 Stellen) */
  function tol(w) { const a = Math.abs(w); if (!(a > 0)) return 1e-12; return Math.max(0.01 * a, 0.5 * Math.pow(10, Math.floor(Math.log10(a)) - 2)); }
  const nah = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= (rel || 0.015) * Math.abs(b) + 1e-15;

  /* ---------------- Baum ---------------- */
  const leaves = n => n.t === 'R' ? [n] : [].concat.apply([], n.kids.map(leaves));
  const knoten = n => n.t === 'R' ? [n] : [n].concat.apply([n], n.kids.map(knoten));
  const tiefe = n => n.t === 'R' ? 0 : 1 + Math.max.apply(null, n.kids.map(tiefe));
  const swapT = t => t === 'S' ? 'P' : 'S';
  function teilen(n, k, R) { const p = new Array(k).fill(1); for (let i = 0; i < n - k; i++) p[Math.floor(R() * k)]++; return p; }
  function gruppe(n, typ, R) {
    const k = 2 + Math.floor(R() * (Math.min(n, 3) - 1));
    return { t: typ, kids: teilen(n, k, R).map(m => m === 1 ? { t: 'R' } : gruppe(m, swapT(typ), R)) };
  }
  function nummeriere(root) {
    let id = 0;
    (function w(n, pt) {
      n.pt = pt;
      if (n.t === 'R') { n.id = ++id; n.name = 'R' + id; n.ids = [id]; }
      else { n.kids.forEach(k => w(k, n.t)); n.ids = [].concat.apply([], n.kids.map(k => k.ids)); n.name = 'R' + n.ids.join(n.ids.some(x => x > 9) ? ',' : ''); }
    })(root, null);
    return id;
  }
  function rechneR(n) {
    if (n.t === 'R') return n.r;
    const rs = n.kids.map(rechneR);
    n.r = n.t === 'S' ? rs.reduce((a, b) => a + b, 0) : 1 / rs.reduce((a, b) => a + 1 / b, 0);
    return n.r;
  }
  function verteile(n, u, i) {
    n.u = u; n.i = i; n.p = u * i;
    if (n.t === 'S') n.kids.forEach(k => verteile(k, k.r * i, i));
    else if (n.t === 'P') n.kids.forEach(k => verteile(k, u, u / k.r));
  }
  function rechne(baum, U) { rechneR(baum); verteile(baum, U, U / baum.r); return { Rges: baum.r, Iges: baum.u / baum.r, Pges: baum.u * baum.i }; }
  const klon = n => n.t === 'R' ? { t: 'R', name: n.name, r: n.r, id: n.id } : { t: n.t, name: n.name, r: n.r, kids: n.kids.map(klon) };
  const verhaeltnisOk = (n, cfg, f) => {
    if (n.t === 'R') return true;
    const rs = n.kids.map(k => k.r), q = Math.max.apply(null, rs) / Math.min.apply(null, rs);
    if (n.t === 'P' && q > cfg.parMax * f) return false;
    if (n.t === 'S' && q > cfg.serMax * f) return false;
    return n.kids.every(k => verhaeltnisOk(k, cfg, f));
  };

  /* Selbstprüfung: Leistungsbilanz, Knotenregel (Parallelgruppen), Maschenregel (Reihengruppen), P = U · I = I² · R = U² / R */
  function selbst(task) {
    const f = [], b = task.baum, rel = 1e-9, gl = (a, c) => Math.abs(a - c) <= rel * Math.max(Math.abs(a), Math.abs(c), 1e-12);
    const sumP = leaves(b).reduce((a, l) => a + l.p, 0);
    if (!gl(sumP, task.U * task.Iges)) f.push('Leistungsbilanz: Summe der Teilleistungen ≠ U · Iges');
    if (!gl(task.Pges, task.U * task.Iges)) f.push('Pges ≠ U · Iges');
    if (!gl(task.Rges * task.Iges, task.U)) f.push('Rges · Iges ≠ U');
    (function w(n) {
      if (n.t === 'R') {
        if (!gl(n.u, n.r * n.i)) f.push(n.name + ': U ≠ R · I');
        if (!gl(n.p, n.i * n.i * n.r) || !gl(n.p, n.u * n.u / n.r)) f.push(n.name + ': P ≠ I² · R oder U² / R');
        return;
      }
      if (n.t === 'S') {
        if (!gl(n.kids.reduce((a, k) => a + k.u, 0), n.u)) f.push(n.name + ': Maschenregel verletzt (Summe der Teilspannungen)');
        if (!n.kids.every(k => gl(k.i, n.i))) f.push(n.name + ': Reihenschaltung, aber Ströme verschieden');
      } else {
        if (!gl(n.kids.reduce((a, k) => a + k.i, 0), n.i)) f.push(n.name + ': Knotenregel verletzt (Summe der Teilströme)');
        if (!n.kids.every(k => gl(k.u, n.u))) f.push(n.name + ': Parallelschaltung, aber Spannungen verschieden');
      }
      n.kids.forEach(w);
    })(b);
    return { ok: !f.length, fehler: f };
  }

  /* ---------------- Aufgaben erzeugen ---------------- */
  function bauBaum(sc, n, R) {
    let t;
    if (sc.art === 'S' || sc.art === 'P') t = { t: sc.art, kids: Array.from({ length: n }, () => ({ t: 'R' })) };
    else if (sc.art === 'rein') t = { t: R() < 0.5 ? 'S' : 'P', kids: Array.from({ length: n }, () => ({ t: 'R' })) };
    else { t = gruppe(n, R() < 0.5 ? 'S' : 'P', R); if (tiefe(t) < (sc.tiefe || 2)) return null; }
    return t;
  }
  const kuerzel = (l, q) => q + l.id;
  function fragenBauen(task, st, R, sc) {
    const b = task.baum, L = leaves(b), F = [];
    const num = (id, q, label, wert, extra) => F.push(Object.assign({ id, typ: 'num', q, label, wert }, extra || {}));
    if (st === 8) {
      num('rges', 'R', 'Gesamtwiderstand Rges', task.Rges);
      num('pges', 'P', 'Gesamtleistung Pges', task.Pges);
      C.shuffle(R, L).slice(0, Math.min(2, L.length)).sort((a, c) => a.id - c.id).forEach(l => num('P' + l.id, 'P', 'Leistung P' + l.id + ' an R' + l.id, l.p, { leaf: l.id }));
      const heiss = L.slice().sort((a, c) => c.p - a.p)[0];
      F.push({ id: 'heiss', typ: 'wahl', label: 'Welcher Widerstand wird am wärmsten?', optionen: L.map(l => l.name), richtig: heiss.name, wert: heiss.p });
      F.push({ id: 'reicht', typ: 'wahl', label: 'Reicht für diesen wärmsten Widerstand eine Belastbarkeit von 0,25 W?', optionen: ['ja', 'nein'], richtig: heiss.p <= BELASTBARKEIT ? 'ja' : 'nein', wert: heiss.p });
      return F;
    }
    num('rges', 'R', 'Gesamtwiderstand Rges', task.Rges);
    num('iges', 'I', st === 1 ? 'Strom I (durch beide Widerstände)' : 'Gesamtstrom Iges', task.Iges);
    let ziele;
    if (st === 1) ziele = [['U', L[0]], ['U', L[1]]];
    else if (st === 2) ziele = [['I', L[0]], ['I', L[1]]];
    else if (st === 3) { const q = b.t === 'S' ? 'U' : 'I'; ziele = C.shuffle(R, L).slice(0, 2).map(l => [q, l]); }
    else {
      const k = sc.teilN, arten = C.shuffle(R, k === 2 ? ['U', 'I'] : (R() < 0.5 ? ['U', 'U', 'I'] : ['U', 'I', 'I']));
      ziele = C.shuffle(R, L).slice(0, k).map((l, i) => [arten[i], l]);
    }
    ziele.sort((a, c) => a[1].id - c[1].id).forEach(z => {
      const l = z[1], q = z[0];
      num(q + l.id, q, q === 'U' ? 'Spannung U' + l.id + ' an R' + l.id : 'Strom I' + l.id + ' durch R' + l.id, q === 'U' ? l.u : l.i, { leaf: l.id });
    });
    return F;
  }
  function gen(stufe, seed) {
    stufe = Math.max(1, Math.min(8, Math.floor(+stufe) || 1)); seed = Math.floor(+seed) || 0;
    const cfg = STUFEN[stufe - 1], R = C.rng(C.hashStr('nz|' + stufe + '|' + seed));
    for (let v = 0; v < 1500; v++) {
      const relax = v > 600 ? 2 : 1, sub = stufe === 8 ? 1 + Math.floor(R() * 5) : stufe, sc = STUFEN[sub - 1];
      const n = sc.anz[0] + Math.floor(R() * (sc.anz[1] - sc.anz[0] + 1));
      const baum = bauBaum(sc, n, R); if (!baum) continue;
      nummeriere(baum);
      const L = leaves(baum), pool = POOL[cfg.pool];
      for (let w = 0; w < 12; w++) {
        const vals = pool.length >= L.length ? C.shuffle(R, pool).slice(0, L.length) : L.map(() => C.pick(R, pool));
        L.forEach((l, i) => { l.r = vals[i]; });
        rechneR(baum);
        if (!verhaeltnisOk(baum, cfg, relax)) continue;
        const U = C.pick(R, SPANNUNGEN), erg = rechne(baum, U);
        if (erg.Iges > 0.3 || erg.Iges < 0.0003) continue;
        if (L.some(l => l.i < 5e-5 || l.u < 0.1)) continue;
        if (stufe === 8) {
          const ps = L.map(l => l.p).sort((a, c) => c - a), pm = ps[0], want = R() < 0.5;
          if (pm < 0.04 || pm > 2 || Math.abs(pm - BELASTBARKEIT) < 0.04) continue;
          if (ps.length > 1 && ps[0] < 1.1 * ps[1]) continue;
          if (v < 900 && (pm <= BELASTBARKEIT) !== want) continue;
        }
        const task = { stufe, seed, U, n: L.length, baum, Rges: erg.Rges, Iges: erg.Iges, Pges: erg.Pges, titel: cfg.titel };
        task.fragen = fragenBauen(task, stufe, R, cfg);
        task.text = 'Eine Gleichspannungsquelle mit U = ' + fw(U, 'U') + ' speist das Widerstandsnetzwerk.' + (stufe === 8 ? ' Berechne die Leistungen.' : ' Berechne die gesuchten Werte.');
        task.gegeben = ['U = ' + fw(U, 'U')].concat(L.map(l => l.name + ' = ' + fw(l.r, 'R')));
        return task;
      }
    }
    return null;
  }

  /* ---------------- Lösungsweg ---------------- */
  const und = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
  const uName = n => n.pt === null && n.t !== 'R' ? 'U' : 'U' + n.name.slice(1);
  const iName = n => n.pt === null && n.t !== 'R' ? 'Iges' : 'I' + n.name.slice(1);
  function innerste(n) {
    for (const k of n.kids) if (k.t !== 'R') { const g = innerste(k); if (g) return g; }
    return n.kids.every(k => k.t === 'R') ? n : null;
  }
  function ersetze(n, g, leaf) { n.kids = n.kids.map(k => k === g ? leaf : (k.t === 'R' ? k : (ersetze(k, g, leaf), k))); }
  function zusammenText(g, wurzel) {
    const ks = g.kids, nm = ks.map(k => k.name), nn = wurzel ? 'Rges' : g.name, vals = ks.map(k => fw(k.r, 'R')), erg = fw(g.r, 'R');
    if (g.t === 'S') return und(nm) + ' liegen in Reihe: ' + nn + ' = ' + nm.join(' + ') + ' = ' + vals.join(' + ') + ' = ' + erg;
    if (ks.length === 2) return nm[0] + ' und ' + nm[1] + ' liegen parallel: ' + nn + ' = ' + nm[0] + ' · ' + nm[1] + ' / (' + nm[0] + ' + ' + nm[1] + ') = ' + vals[0] + ' · ' + vals[1] + ' / (' + vals[0] + ' + ' + vals[1] + ') = ' + erg;
    /* Kehrwerte in 1/Ω (ohne Leitwert und Siemens: das kennt das erste Lehrjahr noch nicht) */
    const kw = v => String(Number(v.toPrecision(3))).replace('.', ',') + ' 1/Ω', gsum = ks.reduce((a, k) => a + 1 / k.r, 0);
    return und(nm) + ' liegen parallel: 1/' + nn + ' = ' + nm.map(x => '1/' + x).join(' + ') + ' = ' + vals.map(x => '1/' + x).join(' + ') + ' = ' + ks.map(k => kw(1 / k.r)).join(' + ') + ' = ' + kw(gsum) + '. Jetzt den Kehrwert bilden: ' + nn + ' = 1 / (' + kw(gsum) + ') = ' + erg;
  }
  function loesung(task) {
    const P = [], b = task.baum, st = task.stufe;
    P.push({ kopf: 'Gesamtwiderstand: von innen nach außen zusammenfassen' });
    let cur = klon(b);
    while (cur.t !== 'R') {
      const g = innerste(cur), wurzel = g === cur;
      P.push({ text: zusammenText(g, wurzel), bild: klon(cur), hl: g.name });
      const leaf = { t: 'R', name: wurzel ? 'Rges' : g.name, r: g.r };
      if (wurzel) cur = leaf; else ersetze(cur, g, leaf);
    }
    P.push({ text: 'Übrig bleibt nur noch ein Widerstand: Rges = ' + fw(task.Rges, 'R'), bild: cur, hl: 'Rges' });
    P.push({ kopf: 'Gesamtstrom' });
    P.push({ text: 'Iges = U / Rges = ' + fw(task.U, 'U') + ' / ' + fw(task.Rges, 'R') + ' = ' + fw(task.Iges, 'I') });
    if (b.t !== 'R') {
      P.push({ kopf: 'Teilspannungen und Teilströme: rückwärts durch die Gruppen' });
      (function w(n) {
        if (n.t === 'R') return;
        const nm = n.kids.map(k => k.name), ni = iName(n), nu = uName(n);
        if (n.t === 'S') {
          const z = [und(nm) + ' liegen in Reihe, durch alle fließt derselbe Strom: ' + (n.pt === null ? 'I' : ni) + ' = ' + fw(n.i, 'I') + '.'];
          n.kids.forEach(k => z.push(uName(k) + ' = ' + k.name + ' · ' + ni + ' = ' + fw(k.r, 'R') + ' · ' + fw(n.i, 'I') + ' = ' + fw(k.u, 'U')));
          P.push({ text: z.join('\n') });
        } else {
          const z = [und(nm) + ' liegen parallel, an allen liegt dieselbe Spannung: ' + nu + ' = ' + fw(n.u, 'U') + '.'];
          n.kids.forEach(k => z.push(iName(k) + ' = ' + nu + ' / ' + k.name + ' = ' + fw(n.u, 'U') + ' / ' + fw(k.r, 'R') + ' = ' + fw(k.i, 'I')));
          P.push({ text: z.join('\n') });
        }
        n.kids.forEach(w);
      })(b);
    }
    if (st === 8) {
      const L = leaves(b), top = L.slice().sort((a, c) => c.p - a.p)[0];
      P.push({ kopf: 'Leistungen' });
      P.push({ text: L.map(l => 'P' + l.id + ' = U' + l.id + ' · I' + l.id + ' = ' + fw(l.u, 'U') + ' · ' + fw(l.i, 'I') + ' = ' + fw(l.p, 'P')).join('\n') });
      P.push({ text: 'Pges = U · Iges = ' + fw(task.U, 'U') + ' · ' + fw(task.Iges, 'I') + ' = ' + fw(task.Pges, 'P') });
      P.push({ text: 'Probe: ' + L.map(l => 'P' + l.id).join(' + ') + ' = ' + L.map(l => fw(l.p, 'P')).join(' + ') + ' = ' + fw(L.reduce((a, l) => a + l.p, 0), 'P') + ' (stimmt mit Pges überein, kleine Abweichungen durch Rundung)' });
      P.push({ text: 'Am wärmsten wird ' + top.name + ' mit ' + fw(top.p, 'P') + '.' });
      P.push({ text: top.p <= BELASTBARKEIT ? fw(top.p, 'P') + ' ist nicht mehr als 0,25 W: Ein 0,25-W-Widerstand reicht für ' + top.name + '.' : fw(top.p, 'P') + ' ist mehr als 0,25 W: Ein 0,25-W-Widerstand reicht für ' + top.name + ' nicht. Du brauchst eine größere Belastbarkeit, zum Beispiel 0,5 W oder mehr.' });
    }
    return { punkte: P, antworten: antworten(task) };
  }
  function antworten(task) { return task.fragen.map(q => ({ id: q.id, label: q.label, text: q.typ === 'wahl' ? q.richtig : fw(q.wert, q.q) })); }
  /* Tabelle aller Widerstände mit U, I, P (Anzeige im Lösungsweg) */
  function tabelle(task) { return leaves(task.baum).map(l => ({ name: l.name, r: fw(l.r, 'R'), u: fw(l.u, 'U'), i: fw(l.i, 'I'), p: fw(l.p, 'P') })); }

  /* ---------------- Antwortprüfung und Fehlererkennung ---------------- */
  /* Wert, den man bei vertauschten Gruppen (Reihe <-> parallel) erhält */
  function vertauscht(n) {
    if (n.t === 'R') return n.r;
    const rs = n.kids.map(vertauscht), t = swapT(n.t);
    return t === 'S' ? rs.reduce((a, b) => a + b, 0) : 1 / rs.reduce((a, b) => a + 1 / b, 0);
  }
  const ALLE_R = task => leaves(task.baum).map(l => l.r);
  function faktorHinweis(w, soll, q) {
    for (const f of [1e3, 1e-3, 1e6, 1e-6]) {
      if (nah(w, soll * f)) {
        const e = (f === 1e3 || f === 1e-3 ? '1000' : '1 000 000') + (f > 1 ? ' zu groß' : ' zu klein');
        return 'Die Ziffern passen, aber der Vorsatz nicht: Dein Wert ist um den Faktor ' + e + '. Prüfe die Einheit rechts neben dem Feld (' + (q === 'R' ? '1 kΩ = 1000 Ω' : q === 'I' ? '1 A = 1000 mA' : q === 'U' ? '1 V = 1000 mV' : '1 W = 1000 mW') + ').';
      }
    }
    return null;
  }
  function allgTipp(task, q) {
    const b = task.baum;
    if (q.id === 'rges') {
      if (b.t === 'S' && b.kids.every(k => k.t === 'R')) return 'Alle Widerstände liegen in Reihe: Rges = ' + b.kids.map(k => k.name).join(' + ') + '.';
      if (b.t === 'P' && b.kids.every(k => k.t === 'R')) return 'Alle Widerstände liegen parallel: ' + (b.kids.length === 2 ? 'Rges = R1 · R2 / (R1 + R2)' : '1/Rges = ' + b.kids.map(k => '1/' + k.name).join(' + ')) + '. Der Wert muss kleiner sein als der kleinste Einzelwiderstand.';
      return 'Fasse zuerst die innerste Gruppe zusammen (Reihe: addieren, parallel: R1 · R2 / (R1 + R2)) und arbeite dich Schritt für Schritt nach außen.';
    }
    if (q.id === 'iges') return 'Iges = U / Rges: Teile die Quellenspannung durch den Gesamtwiderstand.';
    if (q.id === 'pges') return 'Pges = U · Iges: Quellenspannung mal Gesamtstrom.';
    const l = leaves(b).find(x => x.id === q.leaf);
    if (q.q === 'U') return l && l.pt === 'S' ? 'R' + q.leaf + ' liegt in einer Reihenschaltung: Der Strom durch die Gruppe ist gleich, also U = R · I. Rechne rückwärts: erst Iges, dann die Spannung an der Gruppe.' : 'Rechne rückwärts: erst Iges, dann die Spannung an der Gruppe, in der R' + q.leaf + ' liegt. Bei Parallelschaltung liegt an allen Widerständen dieselbe Spannung.';
    if (q.q === 'I') return 'Strom durch R' + q.leaf + ' = Spannung an R' + q.leaf + ' geteilt durch R' + q.leaf + '. Bestimme zuerst die Spannung an diesem Widerstand.';
    if (q.q === 'P') return 'P = U · I: Nimm Spannung und Strom desselben Widerstands (R' + q.leaf + ') und multipliziere.';
    return '';
  }
  function diagnose(task, q, p) {
    const w = p.wert, soll = q.wert, nodes = knoten(task.baum), ka = nodes.filter(n => n.pt !== null || n.t === 'R');
    const fh = faktorHinweis(w, soll, q.q); if (fh) return fh;
    if (q.id === 'rges') {
      const rs = ALLE_R(task), sum = rs.reduce((a, b) => a + b, 0), par = 1 / rs.reduce((a, b) => a + 1 / b, 0);
      if (!nah(sum, soll) && nah(w, sum)) return 'Du hast alle Widerstände einfach addiert, als wären alle in Reihe. Parallele Widerstände fasst du anders zusammen: R = R1 · R2 / (R1 + R2).';
      if (!nah(par, soll) && nah(w, par)) return 'Du hast alle Widerstände wie eine Parallelschaltung behandelt. Widerstände in Reihe werden addiert.';
      const vt = vertauscht(task.baum); if (!nah(vt, soll) && nah(w, vt)) return 'Reihe und parallel sind vertauscht. Schau im Schaltbild: Widerstände hintereinander werden addiert, Widerstände nebeneinander (parallel) rechnest du mit R1 · R2 / (R1 + R2).';
      const zw = ka.find(n => !nah(n.r, soll) && nah(w, n.r)); if (zw) return 'Das ist erst ' + (zw.t === 'R' ? 'der Wert von ' + zw.name : 'der Ersatzwiderstand ' + zw.name) + ', ein Zwischenergebnis. Fasse weiter zusammen, bis nur noch Rges übrig ist.';
      for (const k of [1, 1e3, 1e-3]) if (nah(w * k, 1 / soll) || nah(w, k / soll)) return 'Das sieht nach dem Kehrwert 1/R aus. Bei der Parallelschaltung bildest du am Ende noch einmal den Kehrwert, dann hast du R.';
      return allgTipp(task, q);
    }
    if (q.id === 'iges') {
      const rs = ALLE_R(task), sum = rs.reduce((a, b) => a + b, 0), par = 1 / rs.reduce((a, b) => a + 1 / b, 0), vt = vertauscht(task.baum);
      if (nah(w, task.U / sum) || nah(w, task.U / par) || nah(w, task.U / vt)) return 'Dein Strom passt zu einem falsch berechneten Rges (Reihe und parallel verwechselt?). Prüfe zuerst Rges.';
      return allgTipp(task, q);
    }
    if (q.q === 'U' || q.q === 'I' || q.q === 'P') {
      const key = q.q === 'U' ? 'u' : q.q === 'I' ? 'i' : 'p', gr = q.id === 'pges' ? null : q.leaf;
      if (q.q === 'U' && nah(w, task.U) && !nah(task.U, soll)) return 'Das ist die Spannung der Quelle. Gesucht ist die Spannung nur an R' + gr + '. In einer Reihenschaltung teilt sich die Spannung auf: U = R · I.';
      if (q.q === 'I' && nah(w, task.Iges) && !nah(task.Iges, soll)) return 'Das ist der Gesamtstrom. Gesucht ist der Strom nur durch R' + gr + '. In einer Parallelschaltung teilt sich der Strom auf: I = U / R.';
      if (q.q === 'P' && q.id !== 'pges' && nah(w, task.Pges) && !nah(task.Pges, soll)) return 'Das ist die Gesamtleistung der ganzen Schaltung. Gesucht ist die Leistung nur an R' + gr + ': P = U · I mit Spannung und Strom dieses Widerstands.';
      if (q.q === 'P' && q.id !== 'pges') { const gk = leaves(task.baum).find(x => x.id === gr); if (gk && (nah(w, task.U * gk.i) || nah(w, gk.u * task.Iges))) return 'Für P = U · I müssen Spannung und Strom zum selben Widerstand gehören (R' + gr + '). Du hast Werte von verschiedenen Stellen der Schaltung gemischt.'; }
      const anderer = ka.find(n => !nah(n[key], soll) && nah(w, n[key]));
      if (anderer) return 'Das ist ' + (q.q === 'U' ? 'die Spannung' : q.q === 'I' ? 'der Strom' : 'die Leistung') + ' ' + (anderer.t === 'R' ? 'an ' + anderer.name : 'der Gruppe ' + anderer.name) + ', nicht an R' + gr + '. Achte auf die Nummer des Widerstands.';
      return allgTipp(task, q);
    }
    return allgTipp(task, q);
  }
  /* ans: { id: { v: 'Text', u: 'Einheit' } } für Zahlenfragen, { id: 'R3' } bzw. { id: 'ja' } für Auswahlfragen
     Ergebnis: { alle, offen, formal, items: [{ id, label, ok, leer, fehler, hinweis, eingabe }] } */
  function pruefe(task, ans) {
    ans = ans || {};
    const items = task.fragen.map(q => {
      if (q.typ === 'wahl') {
        const a = ans[q.id];
        if (!a) return { id: q.id, label: q.label, leer: true, ok: false };
        const ok = a === q.richtig;
        return { id: q.id, label: q.label, ok, eingabe: a, hinweis: ok ? '' : (q.id === 'heiss' ? 'Rechne P = U · I für jeden Widerstand und vergleiche. Der Widerstand mit der größten Leistung wird am wärmsten.' : 'Vergleiche die größte Einzelleistung mit 0,25 W. Ist sie größer, reicht der Widerstand nicht.') };
      }
      const a = ans[q.id] || {}, p = liesAntwort(a.v, q.q, a.u);
      if (p.leer) return { id: q.id, label: q.label, leer: true, ok: false };
      if (p.fehler) return { id: q.id, label: q.label, ok: false, fehler: p.fehler, eingabe: a.v };
      const ok = Math.abs(p.wert - q.wert) <= tol(q.wert), eingabe = C.fmt(p.zahl, 6) + ' ' + p.einheit;
      return { id: q.id, label: q.label, ok, eingabe, wert: p.wert, hinweis: ok ? '' : diagnose(task, q, p) };
    });
    /* Folgefehler: Strom passt zum (falschen) Rges des Prüflings */
    const ir = items.find(i => i.id === 'rges'), ii = items.find(i => i.id === 'iges');
    if (ir && ii && !ir.ok && ir.wert && !ii.ok && ii.wert && nah(ii.wert, task.U / ir.wert)) ii.hinweis = 'Folgefehler: Dein Strom passt zu deinem Rges (I = U / Rges). Korrigiere zuerst Rges.';
    const offen = items.filter(i => i.leer).length, formal = items.filter(i => i.fehler).length;
    return { alle: items.every(i => i.ok), offen, formal, items, richtig: items.filter(i => i.ok).length };
  }

  const api = { STUFEN, POOL, E12, SPANNUNGEN, BELASTBARKEIT, EINH, fw, normEinheit, liesAntwort, tol, gen, rechne, selbst, loesung, antworten, tabelle, pruefe, leaves, knoten, tiefe, klon, vertauscht };
  root.MAT_NETZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
