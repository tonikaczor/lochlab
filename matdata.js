'use strict';
/* Tonfunk Rechen-Lab: Daten (Aufgaben mit Zufallsgeneratoren, Beispiele, Hilfe-Texte).
   window.MAT_DATA  { tasks, beispiele, cats, build }
   window.MAT_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'mat', Status in localStorage 'lm4.mat.done' = {id:true})
   Jede Aufgabe hat gen(R): seed-fähig (R = C.rng), Rückgabe { text, unit, raw, dec, steps, tips[2], svg?, meta }.
   build(task, seed) macht daraus die fertige Aufgabe: Wert auf dec Stellen gerundet, Toleranz, Rundungshinweis, Lösungsweg. */
(function (root) {
  const C = root.MAT_CORE || (typeof require === 'function' ? require('./matcore.js') : null);
  const { fmt, rs, rd, pick, ri } = C;
  const dig = n => n === 0 ? 'ganze Zahlen' : n === 1 ? 'eine Nachkommastelle' : n + ' Nachkommastellen';
  const MU = 'µ', OHM = 'Ω';
  const PT1 = 'Prüfung Teil 1';
  const BR = 'Bruchrechnung', KL = 'Klammern';
  const cats = ['Einheiten', 'Dreisatz', 'Prozent', 'Bruchrechnung', 'Klammern', 'Umstellen', 'Geometrie', 'Messwerte', PT1, 'Elektrotechnik', 'Elektronik vertieft'];
  /* Bausteine Bruchrechnung und Klammern (v62.180) */
  const ggt = C.ggt, kz = (z, n) => { const g = ggt(z, n); return [z / g, n / g]; }, bt = (z, n) => n === 1 ? String(z) : z + '/' + n;
  const gem = (z, n) => { const g = Math.floor(z / n); return g + ' ' + (z - g * n) + '/' + n; };
  const bEnde = (zr, H) => { const g = ggt(zr, H), z = zr / g, n = H / g, o = []; if (g > 1) o.push(`Kürzen mit ${g}: ${zr}/${H} = ${bt(z, n)}`); if (n > 1 && z > n) o.push(`Als gemischte Zahl: ${gem(z, n)}`); return o; };
  const BP = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8]];
  const mz = v => v < 0 ? '−' + (-v) : String(v), kl = v => v < 0 ? '(−' + (-v) + ')' : String(v);
  const vz = (v, s) => (v < 0 ? '− ' : '+ ') + (s && Math.abs(v) === 1 ? '' : Math.abs(v)) + (s || '');
  const poly = (A, B, K) => { const t = []; [[A, 'x²'], [B, 'x'], [K, '']].forEach(([v, s]) => { if (!v) return; t.push(t.length ? vz(v, s) : (v < 0 ? '−' : '') + (s && Math.abs(v) === 1 ? '' : Math.abs(v)) + s); }); return t.length ? t.join(' ') : '0'; };
  const frage = k => k === 'x' ? 'Welche Zahl steht im Ergebnis vor dem x? Steht dort nur x, ist die Zahl 1.' : k === 'x2' ? 'Welche Zahl steht im Ergebnis vor dem x²? Steht dort nur x², ist die Zahl 1.' : 'Welche einzelne Zahl (ohne x) steht im Ergebnis?';
  const kO = v => v >= 1000 ? fmt(v / 1000) + ' kΩ' : v + ' Ω';

  /* ---------- Bausteine für Generatoren ---------- */
  function convTask(pairs, vals, dec) {
    return R => {
      const [f, t] = pick(R, pairs), v = pick(R, vals), c = C.convert(v, f, t);
      return { text: `Rechne ${fmt(v)} ${f} in ${t} um.`, unit: t, raw: c.value, dec, steps: c.steps,
        tips: [`Zwischen ${f} und ${t} gibt es eine feste Umrechnungszahl. Wird die Einheit kleiner oder größer?`, `Hier gilt: ${c.steps[0]}. In die kleinere Einheit wird multipliziert, in die größere geteilt.`], meta: { v, f, t } };
    };
  }
  /* Formel umstellen und mit Zahlen rechnen */
  function umst(fid, target, env, dec, text) {
    const u = C.umformung(fid, target), f = u.f, raw = C.solveFor(fid, target, env), unit = f.vars[target][1];
    return { text, unit, raw, dec, meta: Object.assign({ fid, target }, env),
      steps: ['Formel: ' + C.pretty(f.eq) + '   (gesucht: ' + target + ')'].concat(u.steps.map(s => s.op + ':   ' + C.pretty(s.eq)), [C.calcLine(target, u.expr, env, dec, unit)]),
      tips: [`Stelle die Formel ${C.pretty(f.eq)} zuerst nach ${target} um, erst danach setzt du Zahlen ein.`, `Umgestellt: ${C.pretty(u.result)}. Jetzt nur noch einsetzen und rechnen (Einheiten beachten).`] };
  }
  const tri = (a, b, c, al) => ({ a, b, c, al });

  /* ---------- Aufgaben (Reihenfolge = ID mat1 ... matN) ---------- */
  const defs = [
    /* ===== Einheiten ===== */
    ['Einheiten', 1, 'Längen umrechnen', convTask([['mm', 'm'], ['cm', 'mm'], ['km', 'm'], ['m', 'km'], [MU + 'm', 'mm'], ['m', 'cm'], ['mm', 'cm']], [2.5, 12, 45, 0.75, 320, 1800, 6.4, 85], 6)],
    ['Einheiten', 2, 'Vorsätze bei Strom, Spannung, Widerstand', convTask([['mA', 'A'], ['A', 'mA'], ['k' + OHM, OHM], ['M' + OHM, 'k' + OHM], [MU + 'A', 'mA'], ['V', 'mV'], ['kV', 'V'], ['mV', 'V']], [4.7, 22, 150, 0.33, 2.2, 470, 12, 3.3], 6)],
    ['Einheiten', 2, 'Fläche und Volumen umrechnen', convTask([['cm²', 'mm²'], ['m²', 'cm²'], ['cm²', 'm²'], ['dm³', 'l'], ['l', 'm³'], ['m³', 'l'], ['mm²', 'cm²'], ['cm³', 'dm³']], [2.5, 12, 40, 0.5, 350, 1500, 8], 6)],
    ['Einheiten', 2, 'Geschwindigkeit: m/s und km/h', R => {
      const kmh = R() < 0.5, v = kmh ? pick(R, [18, 36, 50, 54, 72, 90, 100, 108, 130]) : pick(R, [2.5, 5, 10, 12, 15, 20, 25, 30]), f = kmh ? 'km/h' : 'm/s', t = kmh ? 'm/s' : 'km/h', c = C.convert(v, f, t);
      return { text: `Rechne ${fmt(v)} ${f} in ${t} um.`, unit: t, raw: c.value, dec: 2, steps: c.steps.concat(['Merkregel: m/s · 3,6 = km/h  und  km/h : 3,6 = m/s.']), tips: ['1 m/s sind 3,6 km/h (1 m = 0,001 km und 1 h = 3600 s).', kmh ? 'Von km/h nach m/s wird durch 3,6 geteilt.' : 'Von m/s nach km/h wird mit 3,6 multipliziert.'], meta: { v, f, t } };
    }],
    ['Einheiten', 3, 'Druck und Leistung umrechnen', convTask([['bar', 'Pa'], ['MPa', 'bar'], ['N/mm²', 'MPa'], ['hPa', 'Pa'], ['kPa', 'bar'], ['kW', 'W'], ['W', 'kW'], ['MW', 'kW'], ['mW', 'W']], [1.5, 2, 6, 0.5, 10, 250, 1013, 4.2], 6)],
    ['Einheiten', 3, 'Zehnerpotenz: Exponent bestimmen', R => {
      const m = pick(R, [1.2, 2.5, 3.3, 4.7, 6.8, 8.1]), n = pick(R, [-6, -5, -4, -3, 3, 4, 5, 6, 7, 8]), x = rs(m * Math.pow(10, n)), k = Math.abs(n);
      return { text: `Schreibe ${fmt(x, 10)} in wissenschaftlicher Schreibweise x = m · 10ⁿ mit 1 ≤ m < 10. Welchen Exponenten n hat die Zehnerpotenz?`, unit: '', label: 'Exponent n', raw: n, dec: 0, meta: { m, n, x },
        steps: [`Komma hinter die erste Ziffer ungleich 0 setzen: m = ${fmt(m)}`, `Dafür wird das Komma um ${k} Stellen nach ${n > 0 ? 'links' : 'rechts'} geschoben.`, `Große Zahl (links geschoben): positiver Exponent. Kleine Zahl (rechts geschoben): negativer Exponent. Hier n = ${n}.`, `${fmt(x, 10)} = ${C.fmtSci(x)}`],
        tips: ['Wohin musst du das Komma schieben, damit vor dem Komma genau eine Ziffer ungleich 0 steht?', 'Zahlen größer als 10 haben einen positiven, Zahlen kleiner als 1 einen negativen Exponenten. Zähle die Stellen.'] };
    }],
    /* ===== Dreisatz ===== */
    ['Dreisatz', 1, 'Dreisatz direkt: Preis', R => {
      const item = pick(R, ['Schrauben', 'Muttern', 'Stifte', 'Dübel']), a = pick(R, [4, 5, 8, 10, 20]), pr = pick(R, [0.2, 0.35, 0.5, 0.75, 1.2, 1.5]), b = rd(a * pr, 2), x = pick(R, [12, 15, 25, 30, 50]), d = C.dreisatz('direkt', a, b, x, item, '€');
      return { text: `${a} ${item} kosten ${fmt(b)} €. Was kosten ${x} ${item}?`, unit: '€', raw: d.value, dec: 2, steps: d.steps, meta: { a, b, x }, tips: ['Je mehr Stück, desto mehr Geld: direkt proportional. Rechne zuerst auf 1 Stück.', `Preis für 1 Stück: ${fmt(b)} € ÷ ${a}. Dann mal ${x}.`] };
    }],
    ['Dreisatz', 2, 'Dreisatz indirekt: Maschinen', R => {
      const [a, b, x] = pick(R, [[2, 12, 3], [3, 12, 4], [4, 6, 3], [6, 8, 4], [2, 15, 5], [3, 20, 5], [4, 9, 6]]), d = C.dreisatz('indirekt', a, b, x, 'Maschinen', 'h');
      return { text: `${a} gleiche Maschinen brauchen ${b} Stunden für einen Auftrag. Wie viele Stunden brauchen ${x} Maschinen?`, unit: 'h', raw: d.value, dec: 2, steps: d.steps, meta: { a, b, x }, tips: ['Mehr Maschinen schaffen den Auftrag schneller: indirekt proportional. Rechne auf 1 Maschine (mal).', `1 Maschine braucht ${a} · ${b} Stunden. Dann teilst du durch ${x}.`] };
    }],
    ['Dreisatz', 2, 'Maßstab', R => {
      if (R() < 0.6) {
        const n = pick(R, [2, 5, 10, 20, 50, 100]), l = pick(R, [12, 25, 36, 40, 75, 84]), m = C.massstab(1, n, l);
        return { text: `Auf einer Zeichnung im Maßstab 1 : ${n} misst ein Bauteil ${l} mm. Wie lang ist es in Wirklichkeit?`, unit: 'mm', raw: m.value, dec: 1, steps: m.steps, meta: { num: 1, den: n, l }, tips: ['1 : n heißt: verkleinert. Die Wirklichkeit ist n-mal größer als die Zeichnung.', `Rechne ${l} mm · ${n}.`] };
      }
      const k = pick(R, [2, 5, 10]), l = pick(R, [10, 25, 40, 60]), m = C.massstab(k, 1, l);
      return { text: `Eine Uhrenfeder ist im Maßstab ${k} : 1 vergrößert gezeichnet und misst auf dem Papier ${l} mm. Wie lang ist sie in Wirklichkeit?`, unit: 'mm', raw: m.value, dec: 1, steps: m.steps, meta: { num: k, den: 1, l }, tips: ['n : 1 heißt: vergrößert. Das Bauteil ist in Wirklichkeit n-mal kleiner als gezeichnet.', `Rechne ${l} mm : ${k}.`] };
    }],
    ['Dreisatz', 2, 'Mischungsverhältnis', R => {
      const k = pick(R, [4, 9, 19, 24]), total = pick(R, [10, 20, 30, 50]), t = C.teilung([1, k], total);
      return { text: `Kühlschmierstoff wird 1 : ${k} mit Wasser gemischt (1 Teil Konzentrat auf ${k} Teile Wasser). Es werden ${total} l Gemisch gebraucht. Wie viel Liter Konzentrat sind das?`, unit: 'l', raw: t.shares[0], dec: 2, steps: t.steps, meta: { k, total }, tips: [`Zähle die Teile zusammen: 1 + ${k}. So viele gleiche Teile hat das Gemisch.`, `Ein Teil sind ${total} l ÷ ${1 + k}. Konzentrat ist genau 1 Teil.`] };
    }],
    ['Dreisatz', 3, 'Zahnräder: Drehzahl', R => {
      const z1 = pick(R, [20, 24, 30, 36]), z2 = pick(R, [12, 15, 40, 48, 60, 72]), n1 = pick(R, [600, 900, 1200, 1500]), d = C.dreisatz('indirekt', z1, n1, z2, 'Zähne', 'min⁻¹');
      return { text: `Ein Zahnrad mit ${z1} Zähnen dreht mit ${n1} Umdrehungen pro Minute. Mit welcher Drehzahl dreht ein damit gekoppeltes Rad mit ${z2} Zähnen? (Mehr Zähne bedeuten: langsamer.)`, unit: 'min⁻¹', raw: d.value, dec: 1, steps: d.steps, meta: { z1, z2, n1 }, tips: ['Mehr Zähne, weniger Umdrehungen: indirekt proportional. Das Produkt Zähne · Drehzahl bleibt gleich.', `${z1} · ${n1} = Zähne · Drehzahl. Teile durch ${z2}.`] };
    }],
    /* ===== Prozent ===== */
    ['Prozent', 1, 'Prozentwert berechnen', R => {
      const G = pick(R, [80, 120, 250, 400, 640, 1200, 1500]), p = pick(R, [5, 8, 12, 15, 18, 25, 30]), u = pick(R, ['€', 'kg', 'm']), r = C.proz('pw', G, p);
      return { text: `Wie viel sind ${p} % von ${G} ${u}?`, unit: u, raw: r.value, dec: 2, steps: r.steps, meta: { G, p }, tips: [`Der Grundwert G = ${G} ${u} entspricht 100 %. Rechne auf 1 % herunter (÷ 100).`, `1 % sind ${fmt(G / 100)} ${u}. Mal ${p} ergibt das Ergebnis.`] };
    }],
    ['Prozent', 1, 'Prozentsatz berechnen', R => {
      const G = pick(R, [50, 80, 200, 250, 400, 500]), p = pick(R, [5, 10, 15, 20, 25, 35, 45]), W = rs(G * p / 100), r = C.proz('ps', G, W);
      return { text: `Von ${G} gefertigten Teilen sind ${fmt(W)} Ausschuss. Wie viel Prozent sind das?`, unit: '%', raw: r.value, dec: 1, steps: r.steps, meta: { G, W }, tips: ['Gesamtmenge = Grundwert (100 %). Gesucht ist, welcher Anteil der Ausschuss ist.', `Teile Prozentwert durch Grundwert: ${fmt(W)} ÷ ${G}, dann mal 100.`] };
    }],
    ['Prozent', 2, 'Grundwert berechnen', R => {
      const G = pick(R, [200, 320, 480, 600, 750, 900]), p = pick(R, [5, 8, 12, 15, 20, 25]), W = rs(G * p / 100), r = C.proz('gw', W, p);
      return { text: `${p} % einer Lieferung sind ${fmt(W)} kg. Wie schwer ist die ganze Lieferung?`, unit: 'kg', raw: r.value, dec: 1, steps: r.steps, meta: { W, p }, tips: [`${fmt(W)} kg entsprechen ${p} %, gesucht sind 100 %. Rechne auf 1 % herunter.`, `1 % = ${fmt(W)} kg ÷ ${p}. Dann mal 100.`] };
    }],
    ['Prozent', 2, 'Rabatt und Skonto', R => {
      if (R() < 0.5) {
        const G = pick(R, [80, 120, 250, 480, 950, 1250]), p = pick(R, [5, 10, 15, 20, 25]), r = C.proz('minder', G, p);
        return { text: `Ein Werkzeug kostet ${G} €. Es gibt ${p} % Rabatt. Wie viel muss bezahlt werden?`, unit: '€', raw: r.value, dec: 2, steps: r.steps, meta: { G, p, art: 'rabatt' }, tips: [`Der Rabatt wird vom Preis abgezogen: ${p} % von ${G} € ausrechnen.`, `Oder in einem Schritt: Du zahlst ${100 - p} % vom Preis.`] };
      }
      const G = pick(R, [500, 840, 1200, 2500, 3600]), p = pick(R, [2, 3]), r = C.proz('skonto', G, p);
      return { text: `Eine Rechnung über ${G} € wird innerhalb der Skontofrist bezahlt. Skonto: ${p} %. Wie hoch ist der Überweisungsbetrag?`, unit: '€', raw: r.value, dec: 2, steps: r.steps, meta: { G, p, art: 'skonto' }, tips: [`Skonto ist ein Abzug vom Rechnungsbetrag: ${p} % von ${G} € ausrechnen.`, `Oder: Du zahlst ${100 - p} % des Rechnungsbetrags.`] };
    }],
    ['Prozent', 2, 'Mehrwertsteuer: Brutto', R => {
      const N = pick(R, [45, 120, 250, 380, 1250, 64.5]), p = pick(R, [19, 7]), r = C.proz('mwst', N, p);
      return { text: `Ein Bauteil kostet netto ${fmt(N)} €. Die Mehrwertsteuer beträgt ${p} %. Wie hoch ist der Bruttopreis?`, unit: '€', raw: r.value, dec: 2, steps: r.steps, meta: { N, p }, tips: [`Netto = 100 %. Brutto = 100 % + ${p} % = ${100 + p} % vom Nettopreis.`, `Rechne ${fmt(N)} € · ${fmt(1 + p / 100)}.`] };
    }],
    ['Prozent', 3, 'Netto aus Brutto', R => {
      const [B, p] = pick(R, [[119, 19], [238, 19], [595, 19], [1190, 19], [107, 7], [214, 7], [535, 7], [1070, 7]]), r = C.proz('netto', B, p);
      return { text: `Der Bruttopreis einer Lieferung beträgt ${B} € (mit ${p} % Mehrwertsteuer). Wie hoch ist der Nettopreis?`, unit: '€', raw: r.value, dec: 2, steps: r.steps, meta: { B, p }, tips: [`Brutto ist ${100 + p} % (nicht 100 %!). Der Nettopreis ist der Grundwert.`, `Teile durch ${fmt(1 + p / 100)}. Nicht einfach ${p} % abziehen.`] };
    }],
    ['Prozent', 3, 'Einfache Zinsen', R => {
      const K = pick(R, [1000, 2500, 4000, 8000]), p = pick(R, [1.5, 2, 3, 4]), t = pick(R, [60, 90, 120, 180, 270, 360]), r = C.proz('zins', K, p, t);
      return { text: `Ein Kapital von ${K} € wird ${t} Tage zu ${fmt(p)} % verzinst (kaufmännisch: 1 Jahr = 360 Tage). Wie hoch sind die Zinsen?`, unit: '€', raw: r.value, dec: 2, steps: r.steps, meta: { K, p, t }, tips: ['Zinsen für ein ganzes Jahr: Kapital · Zinssatz / 100.', `Davon nur den Anteil ${t}/360 des Jahres nehmen.`] };
    }],
    /* ===== Umstellen ===== */
    ['Umstellen', 1, 'Ohmsches Gesetz: Widerstand', R => { const U = pick(R, [5, 9, 12, 24, 230]), I = pick(R, [0.02, 0.05, 0.1, 0.5, 2, 4]); return umst('ohm', 'R', { U, I }, 2, `An einem Widerstand liegen ${fmt(U)} V, es fließen ${fmt(I)} A. Wie groß ist der Widerstand?`); }],
    ['Umstellen', 2, 'Geschwindigkeit: Fahrzeit', R => { const s = pick(R, [60, 90, 150, 240]), v = pick(R, [50, 60, 80, 100, 120]); return umst('weg', 't', { s, v }, 2, `Ein Lkw legt ${s} km mit durchschnittlich ${v} km/h zurück. Wie viele Stunden ist er unterwegs?`); }],
    ['Umstellen', 2, 'Kraft: Masse bestimmen', R => { const F = pick(R, [120, 300, 450, 900, 1500]), a = pick(R, [2, 3, 5, 6, 7.5]); return umst('kraft', 'm', { F, a }, 2, `Eine Kraft von ${F} N beschleunigt eine Last mit ${fmt(a)} m/s². Wie groß ist die Masse der Last?`); }],
    ['Umstellen', 3, 'Kreisfläche: Durchmesser', R => {
      const d0 = pick(R, [10, 12, 16, 20, 25, 30]), A = rd(Math.PI * d0 * d0 / 4, 2);
      const o = umst('kreis', 'd', { A }, 1, `Eine Kreisscheibe hat eine Fläche von ${fmt(A)} mm². Wie groß ist ihr Durchmesser?`); o.skizze = { k: 'kreis', d: 'd = ?', f: 'A = ' + fmt(A) + ' mm²' }; return o;
    }],
    ['Umstellen', 2, 'Dichte: Masse bestimmen', R => {
      const [mat, rho] = pick(R, [['Aluminium', 2.7], ['Stahl', 7.85], ['Kupfer', 8.9], ['Blei', 11.34]]), V = pick(R, [20, 50, 120, 250]);
      return umst('dichte', 'm', { rho, V }, 1, `Ein Block aus ${mat} (Dichte ${fmt(rho)} g/cm³) hat ein Volumen von ${V} cm³. Welche Masse hat er?`);
    }],
    /* ===== Geometrie ===== */
    ['Geometrie', 1, 'Kreisfläche', R => {
      const d = pick(R, [10, 12, 20, 25, 40, 50]), g = C.geo('kreis', { d }, 'mm', 1), A = g.results[1];
      return { text: `Wie groß ist die Fläche einer Kreisscheibe mit dem Durchmesser ${d} mm? (π vom Taschenrechner)`, unit: 'mm²', raw: A.value, dec: 1, steps: [A.line], skizze: { k: 'kreis', d: 'd = ' + d + ' mm', f: 'A = ?' }, meta: { d }, tips: ['Kreisfläche: A = π · d² / 4 (mit dem Durchmesser) oder A = π · r².', `Rechne d² = ${d} · ${d}, mal π, durch 4.`] };
    }],
    ['Geometrie', 2, 'Unterlegscheibe (Kreisring)', R => {
      const D = pick(R, [20, 24, 30, 40]), d = pick(R, [6, 8, 10, 12]), g = C.geo('ring', { D, d }, 'mm', 1), A = g.results[0];
      return { text: `Eine Unterlegscheibe hat außen ${D} mm und innen ${d} mm Durchmesser. Wie groß ist ihre Fläche?`, unit: 'mm²', raw: A.value, dec: 1, steps: ['Ring = große Kreisfläche − kleine Kreisfläche', A.line], skizze: { k: 'ring', D: 'D = ' + D + ' mm', d: 'd = ' + d + ' mm', f: 'A = ?' }, meta: { D, d }, tips: ['Berechne die Fläche des Außenkreises und ziehe die Fläche des Lochs ab.', 'A = π · (D² − d²) / 4. Rechne erst die Klammer.'] };
    }],
    ['Geometrie', 2, 'Zylindervolumen', R => {
      const d = pick(R, [2, 4, 5, 8]), h = pick(R, [10, 12, 15, 20]), g = C.geo('zylinder', { d, h }, 'cm', 1), V = g.results[0];
      return { text: `Ein Zylinder hat den Durchmesser ${d} cm und die Höhe ${h} cm. Wie groß ist sein Volumen?`, unit: 'cm³', raw: V.value, dec: 1, steps: ['Volumen = Grundfläche · Höhe', V.line], skizze: { k: 'zyl', d: 'd = ' + d + ' cm', h: 'h = ' + h + ' cm', f: 'V = ?' }, meta: { d, h }, tips: ['Volumen = Grundfläche (Kreis) mal Höhe.', 'V = π · d² / 4 · h. Alle Längen in cm einsetzen, dann kommt cm³ heraus.'] };
    }],
    ['Geometrie', 3, 'Masse einer Welle', R => {
      const d = pick(R, [8, 10, 12, 20]), h = pick(R, [40, 50, 80, 100]), [mat, rho] = pick(R, [['Stahl', 7.85], ['Aluminium', 2.7], ['Messing', 8.4], ['Kupfer', 8.9]]), V = Math.PI * d * d / 4 * h, m = rho * V / 1000;
      return { text: `Eine Welle aus ${mat} (Dichte ${fmt(rho)} g/cm³) hat ${d} cm Durchmesser und ${h} cm Länge. Welche Masse hat sie in kg?`, unit: 'kg', raw: m, dec: 2, skizze: { k: 'zyl', d: 'd = ' + d + ' cm', h: 'l = ' + h + ' cm', f: 'm = ?' }, meta: { d, h, rho },
        steps: [C.calcLine('V', 'pi*d^2/4*h', { d, h }, 1, 'cm³'), `Masse = Dichte · Volumen: m = ${fmt(rho)} g/cm³ · ${fmt(rd(V, 1))} cm³ = ${fmt(rd(rho * V, 0))} g`, `Umrechnen: g in kg: ${fmt(rd(rho * V, 0))} g : 1000 = ${fmt(rd(m, 2))} kg`],
        tips: ['Erst das Volumen (Zylinder), dann mit der Dichte die Masse in Gramm, zuletzt in kg umrechnen.', 'V = π · d² / 4 · h in cm³. m = ρ · V in g. Dann durch 1000.'] };
    }],
    ['Geometrie', 2, 'Pythagoras: Hypotenuse', R => {
      const [a, b] = pick(R, [[3, 4], [6, 8], [5, 12], [8, 15], [9, 12], [12, 16], [5, 7], [10, 15]]), p = C.pyth({ a, b });
      return { text: `Ein rechtwinkliges Dreieck hat die Katheten a = ${a} mm und b = ${b} mm. Wie lang ist die Hypotenuse c?`, unit: 'mm', raw: p.c, dec: 2, steps: ['Satz des Pythagoras: a² + b² = c²', p.steps[0]], svg: tri(a + ' mm', b + ' mm', '?', null), meta: { a, b }, tips: ['Die Hypotenuse liegt dem rechten Winkel gegenüber. Es gilt a² + b² = c².', `Rechne ${a}² + ${b}² und ziehe die Wurzel.`] };
    }],
    ['Geometrie', 2, 'Pythagoras: Kathete', R => {
      const [c, a] = pick(R, [[5, 3], [10, 6], [13, 5], [17, 8], [15, 9], [26, 10], [12, 9]]), p = C.pyth({ a, c });
      return { text: `Ein rechtwinkliges Dreieck hat die Hypotenuse c = ${c} mm und die Kathete a = ${a} mm. Wie lang ist die Kathete b?`, unit: 'mm', raw: p.b, dec: 2, steps: ['Satz des Pythagoras umgestellt: b² = c² − a²', p.steps[0]], svg: tri(a + ' mm', '?', c + ' mm', null), meta: { a, c }, tips: ['Umstellen: b² = c² − a². Die Hypotenuse ist die längste Seite.', `Rechne ${c}² − ${a}² und ziehe die Wurzel.`] };
    }],
    ['Geometrie', 3, 'Winkel berechnen', R => {
      const v = R(), [a, b, c] = pick(R, [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25]]);
      const k = v < 0.34 ? 'ab' : v < 0.67 ? 'ac' : 'bc', o = k === 'ab' ? { a, b } : k === 'ac' ? { a, c } : { b, c }, t = C.solveTri(o);
      const txt = { ab: `die Katheten a = ${a} mm (gegenüber α) und b = ${b} mm`, ac: `die Kathete a = ${a} mm (gegenüber α) und die Hypotenuse c = ${c} mm`, bc: `die Kathete b = ${b} mm (anliegend an α) und die Hypotenuse c = ${c} mm` }[k];
      return { text: `Ein rechtwinkliges Dreieck hat ${txt}. Wie groß ist der Winkel α?`, unit: '°', raw: t.alpha, dec: 1, steps: t.steps, svg: tri(o.a ? a + ' mm' : 'a', o.b ? b + ' mm' : 'b', o.c ? c + ' mm' : 'c', 'α = ?'), meta: { k, a, b, c }, tips: ['Welche zwei Seiten kennst du? Gegenkathete a, Ankathete b, Hypotenuse c. Wähle sin, cos oder tan.', k === 'ab' ? 'tan α = a / b, dann mit tan⁻¹ (Taschenrechner: Shift tan).' : k === 'ac' ? 'sin α = a / c, dann mit sin⁻¹.' : 'cos α = b / c, dann mit cos⁻¹.'] };
    }],
    ['Geometrie', 3, 'Seite aus Winkel', R => {
      const al = pick(R, [20, 25, 30, 35, 40, 50, 55]), v = R(); let o, want, svg, txt;
      if (v < 0.25) { const c = pick(R, [10, 12, 15, 20, 25, 50]); o = { c, alpha: al }; want = 'a'; svg = tri('a = ?', 'b', c + ' mm', 'α = ' + al + '°'); txt = `die Hypotenuse c = ${c} mm und α = ${al}°. Wie lang ist die Gegenkathete a?`; }
      else if (v < 0.5) { const c = pick(R, [10, 12, 15, 20, 25, 50]); o = { c, alpha: al }; want = 'b'; svg = tri('a', 'b = ?', c + ' mm', 'α = ' + al + '°'); txt = `die Hypotenuse c = ${c} mm und α = ${al}°. Wie lang ist die Ankathete b?`; }
      else if (v < 0.75) { const b = pick(R, [8, 10, 15, 20, 40]); o = { b, alpha: al }; want = 'a'; svg = tri('a = ?', b + ' mm', 'c', 'α = ' + al + '°'); txt = `die Ankathete b = ${b} mm und α = ${al}°. Wie lang ist die Gegenkathete a?`; }
      else { const a = pick(R, [8, 10, 15, 20, 40]); o = { a, alpha: al }; want = 'c'; svg = tri(a + ' mm', 'b', 'c = ?', 'α = ' + al + '°'); txt = `die Gegenkathete a = ${a} mm und α = ${al}°. Wie lang ist die Hypotenuse c?`; }
      const t = C.solveTri(o);
      return { text: `Ein rechtwinkliges Dreieck hat ${txt}`, unit: 'mm', raw: t[want], dec: 2, steps: t.steps, svg, meta: { o, want }, tips: ['Welche Seite kennst du, welche suchst du? Gegenkathete a, Ankathete b, Hypotenuse c. Passende Funktion: sin, cos oder tan.', 'sin α = a / c, cos α = b / c, tan α = a / b. Nach der gesuchten Seite umstellen (Taschenrechner auf Grad, DEG!).'] };
    }],
    /* ===== Messwerte ===== */
    ['Messwerte', 1, 'Mittelwert', R => {
      const base = pick(R, [8, 12, 25, 30]), v = []; for (let i = 0; i < 5; i++) v.push(rs(base + ri(R, -6, 6) / 100)); const s = C.stats(v, 3);
      return { text: `Fünf Messungen an einer Welle ergaben (in mm): ${v.map(x => fmt(x)).join('; ')}. Wie groß ist der Mittelwert?`, unit: 'mm', raw: s.mean, dec: 3, steps: [s.steps[0], s.steps[1]], meta: { v }, tips: ['Mittelwert = Summe aller Werte geteilt durch die Anzahl.', `Addiere die fünf Werte und teile durch 5.`] };
    }],
    ['Messwerte', 2, 'Median und Spannweite', R => {
      const set = new Set(); while (set.size < 7) set.add(ri(R, 20, 60)); const v = [...set].map(x => x / 10), s = C.stats(v, 1), med = R() < 0.5;
      return { text: `Sieben Messwerte (in mm): ${v.map(x => fmt(x)).join('; ')}. Bestimme ${med ? 'den Median' : 'die Spannweite'}.`, unit: 'mm', raw: med ? s.median : s.range, dec: 1, steps: [s.steps[2], med ? s.steps[3] : s.steps[4]], meta: { v, med }, tips: [med ? 'Ordne die Werte der Größe nach. Der Median ist der mittlere Wert.' : 'Spannweite = größter minus kleinster Wert.', med ? 'Bei 7 Werten ist es der 4. Wert der sortierten Liste.' : 'Suche Maximum und Minimum der Liste.'] };
    }],
    ['Messwerte', 3, 'Standardabweichung', R => {
      const base = ri(R, 20, 30), offs = C.shuffle(R, [-3, -2, -1, 0, 1, 2, 3]).slice(0, 5), v = offs.map(o => base + o), s = C.stats(v, 2);
      return { text: `Fünf Messwerte (in mm): ${v.join('; ')}. Bestimme die Standardabweichung s der Stichprobe (Teiler n − 1).`, unit: 'mm', raw: s.stdev, dec: 2, steps: s.steps.slice(1, 2).concat(s.steps.slice(-2)), meta: { v }, tips: ['Zuerst den Mittelwert, dann jede Abweichung vom Mittelwert quadrieren und addieren.', 'Die Summe durch (n − 1) teilen, daraus die Wurzel ziehen.'] };
    }],
    ['Messwerte', 3, 'Toleranz in Prozent, Faustregel', R => {
      if (R() < 0.5) {
        const N = pick(R, [20, 50, 80, 125]), t = pick(R, [0.1, 0.2, 0.5, 1]), r = C.proz('toleranz', N, t);
        return { text: `Ein Maß hat das Nennmaß ${N} mm und die Toleranz ± ${fmt(t)} mm. Wie groß ist die Toleranz in Prozent des Nennmaßes?`, unit: '%', raw: r.value, dec: 2, steps: r.steps, meta: { N, t, art: 'tol' }, tips: ['Prozentsatz = Abweichung geteilt durch Nennmaß mal 100 %.', `Rechne ${fmt(t)} ÷ ${N} · 100.`] };
      }
      const p1 = pick(R, [0.5, 1, 2]), p2 = pick(R, [1, 1.5, 2, 3]), e = C.fehlerFaust('mul', [p1, p2]);
      return { text: `Eine Fläche A = a · b wird aus zwei Messwerten berechnet. a ist auf ± ${fmt(p1)} % genau, b auf ± ${fmt(p2)} %. Wie groß ist nach der Faustregel der Fehler von A in Prozent?`, unit: '%', raw: e, dec: 1, meta: { p1, p2, art: 'faust' },
        steps: ['Faustregel: Bei Produkt und Quotient addieren sich die Prozent-Fehler.', `Fehler von A ≈ ${fmt(p1)} % + ${fmt(p2)} % = ${fmt(e)} %`], tips: ['Bei Malnehmen oder Teilen von Messwerten addiert man die relativen Fehler (in Prozent).', `Rechne ${fmt(p1)} + ${fmt(p2)}.`] };
    }],
    /* ===== Neu: Berufsschulstoff 1. Lehrjahr (Grundlagen Elektrotechnik, Messtechnik). Alle Zahlen und Texte sind eigen. ===== */
    /* PRUEFEN P1: Leiterwiderstand und Zuleitung (mat38, mat39, mat40): Kupfer mit ρ = 0,0178 Ω·mm²/m, Konstantan mit ρ = 0,5 Ω·mm²/m. Passen die Tabellenwerte zu der Formelsammlung, die im Unterricht benutzt wird (oft 0,0178 bis 0,0175 für Kupfer, 0,49 oder 0,5 für Konstantan)? Die Werte stehen im Aufgabentext, damit der Rechenweg nicht vom Tabellenbuch abhängt. */
    /* PRUEFEN P2: Temperaturabhängigkeit (mat41): Kupfer mit α = 0,0039 1/K, Bezugstemperatur 20 °C, linearer Ansatz R = R20 · (1 + α · Δϑ). Stimmt der Wert mit dem Unterricht überein (manche Tabellen nennen 0,00393 oder 0,004), und wird die Rechnung dort auch mit ΔR = α · R20 · Δϑ angeschrieben? */
    /* PRUEFEN P3: Multimeter-Fehlergrenzen (mat43): F = p % vom Messwert + n Digit (1 Digit = Wert der letzten Stelle), wahrer Wert zwischen M − F und M + F. Die Prozent- und Digit-Zahlen sind frei gewählt (keine Gerätedaten). Passt die Schreibweise zum Unterricht (Fehlergrenze, Messunsicherheit)? */
    ['Umstellen', 2, 'Lineare Gleichung lösen', R => {
      const x = pick(R, [-5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]), sg = n => (n < 0 ? '− ' : '+ ') + fmt(Math.abs(n)), px = v => v < 0 ? '(' + fmt(v) + ')' : fmt(v), cf = k => k === 1 ? 'x' : k + 'x';
      if (R() < 0.5) {
        const a = pick(R, [2, 3, 4, 5, 6, 7, 8, 9]), b = pick(R, [-18, -12, -9, -7, -5, 4, 6, 8, 11, 15]), c = a * x + b;
        return { text: `Löse die Gleichung ${a}x ${sg(b)} = ${fmt(c)} nach x.`, unit: '', label: 'Lösung x', raw: x, dec: 0, meta: { form: 'ein', a, b, c, x },
          steps: [`Gleichung: ${a}x ${sg(b)} = ${fmt(c)}`, `Die Zahl ohne x auf die andere Seite: ${b < 0 ? 'plus' : 'minus'} ${fmt(Math.abs(b))} auf beiden Seiten: ${a}x = ${fmt(c)} ${b < 0 ? '+' : '−'} ${fmt(Math.abs(b))} = ${fmt(c - b)}`, `Beide Seiten durch ${a}: x = ${fmt(c - b)} : ${a} = ${fmt(x)}`, `Probe: ${a} · ${px(x)} ${sg(b)} = ${fmt(c)}`],
          tips: ['Auf beiden Seiten dasselbe tun: Bringe zuerst die Zahl ohne x auf die andere Seite (die Umkehrung von Plus ist Minus).', 'Dann steht Zahl · x = Zahl. Teile beide Seiten durch die Zahl vor dem x und mach zum Schluss die Probe durch Einsetzen.'] };
      }
      const c = pick(R, [1, 2, 3, 4]), a = c + pick(R, [1, 2, 3, 4, 5]), b = pick(R, [-9, -6, -4, 3, 5, 7, 10]), d = (a - c) * x + b;
      return { text: `Löse die Gleichung ${cf(a)} ${sg(b)} = ${cf(c)} ${sg(d)} nach x.`, unit: '', label: 'Lösung x', raw: x, dec: 0, meta: { form: 'zwei', a, b, c, d, x },
        steps: [`Gleichung: ${cf(a)} ${sg(b)} = ${cf(c)} ${sg(d)}`, `${cf(c)} auf beiden Seiten abziehen: ${cf(a - c)} ${sg(b)} = ${fmt(d)}`, `${fmt(Math.abs(b))} auf beiden Seiten ${b < 0 ? 'addieren' : 'abziehen'}: ${cf(a - c)} = ${fmt(d)} ${b < 0 ? '+' : '−'} ${fmt(Math.abs(b))} = ${fmt(d - b)}`, `Beide Seiten durch ${a - c}: x = ${fmt(d - b)} : ${a - c} = ${fmt(x)}`, `Probe links: ${a} · ${px(x)} ${sg(b)} = ${fmt(a * x + b)}, rechts: ${c} · ${px(x)} ${sg(d)} = ${fmt(c * x + d)}`],
        tips: ['Sammle alle Glieder mit x auf einer Seite und alle Zahlen auf der anderen: Ziehe das kleinere x-Glied auf beiden Seiten ab.', 'Dann steht Zahl · x = Zahl. Teile beide Seiten durch die Zahl vor dem x. Setze das Ergebnis zur Probe in beide Seiten ein.'] };
    }],
    ['Umstellen', 1, 'Akku: Ladung, Strom und Zeit', R => {
      const k = pick(R, ['t', 't', 'I', 'Q']);
      if (k === 't') { const Q = pick(R, [1500, 2000, 2600, 3000, 4000, 5000]), I = pick(R, [100, 150, 200, 250, 400, 500]); return umst('ladung', 't', { Q, I }, 1, `Ein Akku hat die Kapazität ${Q} mAh. Das angeschlossene Gerät nimmt dauernd ${I} mA auf. Wie viele Stunden hält der volle Akku durch?`); }
      if (k === 'I') { const Q = pick(R, [1200, 2400, 3000, 4800]), t = pick(R, [8, 10, 12, 20, 24, 40]); return umst('ladung', 'I', { Q, t }, 1, `Ein Sensor soll mit einer Batterie von ${Q} mAh genau ${t} Stunden laufen. Welchen mittleren Strom in mA darf er höchstens aufnehmen?`); }
      const I = pick(R, [20, 45, 120, 250, 350]), t = pick(R, [2, 5, 8, 10, 12.5]), o = umst('ladung', 'Q', { I, t }, 1, `Ein Gerät nimmt ${I} mA auf und läuft ${fmt(t)} Stunden. Wie viel Ladung in mAh wird dem Akku entnommen?`);
      o.tips = ['Die Ladung ist Strom mal Zeit: Q = I · t. Hier steht Q schon links, du musst nur einsetzen.', 'Strom in mA und Zeit in h ergeben die Ladung gleich in mAh. Du musst nichts umrechnen.']; return o;
    }],
    ['Umstellen', 2, 'Leiterwiderstand: R, Länge oder Querschnitt', R => {
      const k = pick(R, ['R', 'l', 'A']), cu = R() < 0.65, rho = cu ? 0.0178 : 0.5, nm = cu ? 'Kupferdraht' : 'Konstantandraht', rt = `(ρ = ${fmt(rho)} Ω·mm²/m)`;
      const Rs = cu ? [0.2, 0.5, 0.8, 1.2, 2] : [10, 25, 50, 100], As = cu ? [0.5, 0.75, 1, 1.5, 2.5, 4] : [0.1, 0.2, 0.25, 0.5], ls = cu ? [10, 20, 25, 40, 50, 80, 100] : [2, 5, 10, 20, 25];
      let o;
      if (k === 'R') { const l = pick(R, ls), A = pick(R, As); o = umst('draht', 'R', { rho, l, A }, cu ? 3 : 2, `Ein ${nm} ${rt} ist ${l} m lang und hat ${fmt(A)} mm² Querschnitt. Wie groß ist sein Widerstand?`); }
      else if (k === 'l') { const Rw = pick(R, Rs), A = pick(R, As); o = umst('draht', 'l', { rho, R: Rw, A }, 1, `Ein ${nm} ${rt} mit ${fmt(A)} mm² Querschnitt soll genau ${fmt(Rw)} Ω haben. Wie lang in m muss er sein?`); }
      else { const Rw = pick(R, Rs), l = pick(R, ls); o = umst('draht', 'A', { rho, R: Rw, l }, cu ? 3 : 2, `Ein ${l} m langer ${nm} ${rt} hat ${fmt(Rw)} Ω. Welchen Querschnitt in mm² hat er?`); }
      o.meta.k = k; o.meta.rho = rho; return o;
    }],
    ['Umstellen', 3, 'Zuleitung: Spannungsfall und Verlust', R => {
      const [A, l] = pick(R, [[2.5, 15], [2.5, 20], [2.5, 25], [2.5, 30], [2.5, 40], [4, 20], [4, 40], [4, 60], [6, 30], [6, 60], [1.5, 15]]), I = pick(R, [8, 10, 13, 16, 20]), rho = 0.0178, Rl = rho * 2 * l / A, dU = Rl * I, k = pick(R, ['du', 'pv', 'uv']);
      const kopf = `Ein Verbraucher ist über eine Kupferleitung (ρ = 0,0178 Ω·mm²/m, ${fmt(A)} mm²) im Abstand ${l} m an eine 230-V-Steckdose angeschlossen und nimmt ${I} A auf.`;
      const st = [`Der Strom fließt hin und zurück: Leitungslänge 2 · ${l} m = ${2 * l} m`, `R = ρ · l / A = 0,0178 · ${2 * l} / ${fmt(A)} = ${fmt(rd(Rl, 4), 4)} Ω (rechne mit dem ungerundeten Wert weiter)`, `Spannungsfall ΔU = R · I = ${fmt(rd(Rl, 4), 4)} Ω · ${I} A = ${fmt(rd(dU, 3), 3)} V`];
      if (k === 'du') return { text: kopf + ' Wie groß ist der Spannungsfall auf der Leitung (Hin- und Rückleiter zusammen)?', unit: 'V', raw: dU, dec: 2, meta: { k, A, l, I, rho }, steps: st, tips: ['Der Strom fließt zum Verbraucher hin und wieder zurück: Die Leitung ist doppelt so lang wie der Abstand.', 'Erst den Widerstand R = ρ · (2 · l) / A ausrechnen, dann ΔU = R · I. Rechne mit dem ungerundeten Widerstand weiter.'] };
      if (k === 'pv') return { text: kopf + ' Wie viel Leistung geht als Wärme in der Leitung (Hin- und Rückleiter) verloren?', unit: 'W', raw: dU * I, dec: 0, meta: { k, A, l, I, rho }, steps: st.concat([`Verlustleistung P = ΔU · I = ${fmt(rd(dU, 3), 3)} V · ${I} A = ${fmt(rd(dU * I, 2), 2)} W`]), tips: ['Der Strom fließt hin und zurück: Die Leitung ist doppelt so lang wie der Abstand. Erst R = ρ · (2 · l) / A.', 'Verlustleistung P = R · I² (oder ΔU · I). Rechne mit dem ungerundeten Widerstand weiter.'] };
      return { text: kopf + ' Welche Spannung liegt dann am Verbraucher an? Die Steckdose liefert 230 V.', unit: 'V', raw: 230 - dU, dec: 1, meta: { k, A, l, I, rho }, steps: st.concat([`Spannung am Verbraucher = 230 V − ${fmt(rd(dU, 3), 3)} V = ${fmt(rd(230 - dU, 2), 2)} V`]), tips: ['Der Spannungsfall auf der Leitung geht der Steckdosenspannung verloren. Erst den Widerstand der ganzen Leitung (hin und zurück) ausrechnen.', 'R = ρ · (2 · l) / A, dann ΔU = R · I. Am Verbraucher bleiben 230 V − ΔU.'] };
    }],
    ['Geometrie', 3, 'Widerstand einer Spulenwicklung', R => {
      const d = pick(R, [0.2, 0.3, 0.4, 0.5, 0.63]), D = pick(R, [20, 25, 30, 40]), N = pick(R, [200, 300, 500, 800, 1000]), rho = 0.0178, l = Math.PI * D * N / 1000, A = Math.PI * d * d / 4, Rw = rho * l / A, wl = R() < 0.3;
      const kopf = `Eine Spule besteht aus ${N} Windungen Kupferlackdraht (Drahtdurchmesser ${fmt(d)} mm, ρ = 0,0178 Ω·mm²/m). Der mittlere Durchmesser einer Windung beträgt ${D} mm.`;
      const s1 = [`Länge einer Windung (Kreisumfang): π · ${D} mm = ${fmt(rd(Math.PI * D, 2), 2)} mm`, `Drahtlänge: l = ${N} · ${fmt(rd(Math.PI * D, 2), 2)} mm = ${fmt(rd(Math.PI * D * N, 0), 0)} mm = ${fmt(rd(l, 2), 2)} m`];
      if (wl) return { text: kopf + ' Wie lang ist der Draht?', unit: 'm', raw: l, dec: 1, meta: { d, D, N, rho, wl }, steps: s1, tips: ['Eine Spule ist ein Draht, der in vielen Windungen aufgewickelt ist. Eine Windung ist ein Kreis mit dem Umfang U = π · D. Der Draht ist N-mal so lang.', `Rechne π · ${D} mm · ${N} und wandle von mm in m um (durch 1000).`] };
      return { text: kopf + ' Wie groß ist der Widerstand der Wicklung?', unit: OHM, raw: Rw, dec: 1, meta: { d, D, N, rho, wl }, steps: [...s1, `Drahtquerschnitt: A = π · d² / 4 = π · ${fmt(d)}² / 4 = ${fmt(rd(A, 4), 4)} mm²`, `R = ρ · l / A = 0,0178 · ${fmt(rd(l, 2), 2)} / ${fmt(rd(A, 4), 4)} = ${fmt(rd(Rw, 2), 2)} Ω`], tips: ['Eine Spule ist ein Draht, der in vielen Windungen aufgewickelt ist. Zuerst die Drahtlänge: eine Windung ist ein Kreis (Umfang π · D), mal die Zahl der Windungen. Dann den Querschnitt des Drahtes als Kreis.', 'Dann R = ρ · l / A mit l in m und A in mm². Rechne mit den ungerundeten Zwischenwerten weiter.'] };
    }],
    ['Umstellen', 3, 'Widerstand bei anderer Temperatur', R => {
      const al = 0.0039, R20 = pick(R, [8, 12, 25, 40, 60]), th = pick(R, [50, 60, 80, 100, 120]), dR = al * R20 * (th - 20), Rw = rd(R20 + dR, 2);
      if (R() < 0.5) return { text: `Eine Kupferwicklung hat bei 20 °C einen Widerstand von ${R20} Ω (Temperaturbeiwert von Kupfer α = 0,0039 1/K). Wie groß ist ihr Widerstand bei ${th} °C?`, unit: 'Ω', raw: R20 + dR, dec: 2, meta: { al, R20, th, rev: false }, steps: [`Temperaturdifferenz: Δϑ = ${th} °C − 20 °C = ${th - 20} K`, `Widerstandsänderung: ΔR = α · R20 · Δϑ = 0,0039 1/K · ${R20} Ω · ${th - 20} K = ${fmt(rd(dR, 3), 3)} Ω`, `R = R20 + ΔR = ${R20} Ω + ${fmt(rd(dR, 3), 3)} Ω = ${fmt(rd(R20 + dR, 3), 3)} Ω`], tips: ['Eine Wicklung ist ein Draht, der zu einer Spule gewickelt ist, zum Beispiel im Motor. Kupfer wird bei Erwärmung hochohmiger. Zuerst die Temperaturdifferenz Δϑ zu 20 °C bilden.', 'ΔR = α · R20 · Δϑ. Dann ist der warme Widerstand R20 + ΔR. So gehst du vor: 1. Δϑ = Temperatur − 20 °C. 2. ΔR = α · R20 · Δϑ. 3. R warm = R20 + ΔR. 4. Trage R warm in Ω ein.'] };
      const th2 = pick(R, [45, 55, 70, 85, 95, 110]), W2 = rd(R20 * (1 + al * (th2 - 20)), 2);
      return { text: `Die Kupferwicklung eines Motors hat bei 20 °C einen Widerstand von ${R20} Ω. Nach längerem Betrieb misst man ${fmt(W2)} Ω (α = 0,0039 1/K). Welche Temperatur hat die Wicklung?`, unit: '°C', raw: 20 + (W2 / R20 - 1) / al, dec: 0, meta: { al, R20, W2, rev: true }, steps: [`Widerstandsänderung: ΔR = ${fmt(W2)} Ω − ${R20} Ω = ${fmt(rd(W2 - R20, 3), 3)} Ω`, `Aus ΔR = α · R20 · Δϑ folgt Δϑ = ΔR / (α · R20) = ${fmt(rd(W2 - R20, 3), 3)} Ω / (0,0039 1/K · ${R20} Ω) = ${fmt(rd((W2 - R20) / (al * R20), 1), 1)} K`, `Temperatur: ϑ = 20 °C + Δϑ = ${fmt(rd(20 + (W2 - R20) / (al * R20), 1), 1)} °C`], tips: ['Eine Wicklung ist ein Draht, der zu einer Spule gewickelt ist, zum Beispiel im Motor. Der Widerstand ist um ΔR = R warm − R20 gestiegen. Daraus lässt sich die Temperaturdifferenz berechnen.', 'Stelle ΔR = α · R20 · Δϑ nach Δϑ um. Zum Ergebnis kommen die 20 °C Ausgangstemperatur dazu. So gehst du vor: 1. ΔR = R warm − R20. 2. Δϑ = ΔR / (α · R20). 3. Temperatur = 20 °C + Δϑ. 4. Trage die Temperatur in °C ein.'] };
    }],
    ['Einheiten', 2, 'Energie in kWh und Stromkosten', R => {
      const P = pick(R, [40, 75, 150, 800, 1200, 2000]), t = pick(R, [2, 3, 4, 6, 8]), d = pick(R, [5, 7, 20, 30, 90]), pr = pick(R, [0.28, 0.3, 0.32, 0.35, 0.4]), E = P * t * d / 1000, kost = R() < 0.65;
      const kopf = `Ein Gerät mit ${P} W Leistungsaufnahme läuft ${t} Stunden pro Tag an ${d} Tagen.`, st = [`Betriebszeit: ${t} h · ${d} = ${t * d} h`, `Energie E = P · t = ${P} W · ${t * d} h = ${fmt(P * t * d)} Wh = ${fmt(rd(E, 3), 3)} kWh (1 kWh = 1000 Wh)`];
      if (!kost) return { text: kopf + ' Wie viel Energie in kWh wird verbraucht?', unit: 'kWh', raw: E, dec: 2, meta: { P, t, d, pr, kost }, steps: st, tips: ['Energie = Leistung mal Zeit. Rechne zuerst die gesamte Betriebszeit in Stunden aus.', 'Das Ergebnis in Wh durch 1000 teilen ergibt kWh.'] };
      return { text: kopf + ` Eine kWh kostet ${fmt(pr)} €. Was kostet der Betrieb?`, unit: '€', raw: E * pr, dec: 2, meta: { P, t, d, pr, kost }, steps: st.concat([`Kosten = E · Preis = ${fmt(rd(E, 3), 3)} kWh · ${fmt(pr)} €/kWh = ${fmt(rd(E * pr, 3), 3)} €`]), tips: ['Zuerst die Energie: Leistung mal gesamte Betriebszeit, das Ergebnis von Wh in kWh umrechnen.', 'Kosten = Energie in kWh mal Preis je kWh.'] };
    }],
    ['Messwerte', 2, 'Multimeter: Fehlergrenzen des Messwerts', R => {
      const [u, M, dg] = pick(R, [['V', 3.27, 0.01], ['V', 12.46, 0.01], ['V', 24.1, 0.1], ['mA', 18.6, 0.1], ['mA', 42.3, 0.1], ['Ω', 468, 1], ['Ω', 2204, 1]]), p = pick(R, [0.5, 0.8, 1, 1.2, 1.5]), n = pick(R, [2, 3, 5]), F = p / 100 * M + n * dg, k = pick(R, ['F', 'Wu', 'Wo']);
      const kopf = `Ein Digitalmultimeter zeigt ${fmt(M)} ${u}. Seine Genauigkeit im Bereich ist ± (${fmt(p)} % vom Messwert + ${n} Digit), ein Digit entspricht ${fmt(dg)} ${u}.`, st = [`Prozentanteil: ${fmt(p)} % von ${fmt(M)} ${u} = ${fmt(rd(p / 100 * M, 4), 4)} ${u}`, `Digit-Anteil: ${n} · ${fmt(dg)} ${u} = ${fmt(rd(n * dg, 4), 4)} ${u}`, `Größte Abweichung F = ${fmt(rd(F, 4), 4)} ${u}`];
      const meta = { u, M, dg, p, n, k };
      if (k === 'F') return { text: kopf + ' Wie groß ist die größtmögliche Abweichung F des Messwerts?', unit: u, raw: F, dec: 3, meta, steps: st, tips: ['Die Abweichung hat zwei Teile: einen Anteil in Prozent vom angezeigten Wert und einige Digits (Schritte der letzten Stelle).', 'F = Prozent / 100 · Messwert + Digit-Zahl · Wert eines Digits. Beide Teile addieren.'] };
      if (k === 'Wu') return { text: kopf + ' Wie klein kann der wahre Wert höchstens sein (untere Grenze)?', unit: u, raw: M - F, dec: 3, meta, steps: st.concat([`Untere Grenze: ${fmt(M)} ${u} − ${fmt(rd(F, 4), 4)} ${u} = ${fmt(rd(M - F, 4), 4)} ${u}`]), tips: ['Erst die größtmögliche Abweichung F ausrechnen: Prozentanteil vom Messwert plus Digit-Anteil.', 'Die untere Grenze des wahren Wertes ist Messwert minus F.'] };
      return { text: kopf + ' Wie groß kann der wahre Wert höchstens sein (obere Grenze)?', unit: u, raw: M + F, dec: 3, meta, steps: st.concat([`Obere Grenze: ${fmt(M)} ${u} + ${fmt(rd(F, 4), 4)} ${u} = ${fmt(rd(M + F, 4), 4)} ${u}`]), tips: ['Erst die größtmögliche Abweichung F ausrechnen: Prozentanteil vom Messwert plus Digit-Anteil.', 'Die obere Grenze des wahren Wertes ist Messwert plus F.'] };
    }],
    /* ===== Neu: Berufsschulstoff 1. Lehrjahr, zweite Runde (Erwärmung aus dem Strom, Aluminium gegen Kupfer, Kosten im Dauerbetrieb). Alle Zahlen und Texte sind eigen. ===== */
    /* PRUEFEN P4: mat44 rechnet die Erwärmung einer Kupferwicklung aus dem Rückgang des Stroms bei gleicher Spannung (R warm / R kalt = I kalt / I warm, α = 0,0039 1/K, kalt = 20 °C). mat45 und mat46 vergleichen Aluminium (ρ = 0,0278 Ω·mm²/m, Dichte 2,7 g/cm³) mit Kupfer (ρ = 0,0178 Ω·mm²/m, Dichte 8,9 g/cm³). Passen die Tabellenwerte (manche Tabellen nennen 0,0286 für Aluminium) und der Rechenweg zum Unterricht? */
    /* PRUEFEN P5: mat47 und mat48 rechnen mit Dauerbetrieb über ein ganzes Jahr (365 Tage · 24 h = 8760 h) und frei gewählten Strompreisen; die Amortisationszeit in mat48 ist der Mehrpreis geteilt durch die Ersparnis je Jahr (ohne Zinsen). Ist diese einfache Form so gewollt? */
    ['Umstellen', 3, 'Erwärmung einer Wicklung aus dem Strom', R => {
      const [U, R20] = pick(R, [[230, 460], [24, 40], [110, 220], [48, 60], [230, 575], [12, 15]]), th = pick(R, [45, 60, 70, 85, 100]), al = 0.0039, k = pick(R, ['dt', 'th', 'rw']);
      const I1 = rd(U / R20 * 1000, 1), I2 = rd(U / (R20 * (1 + al * (th - 20))) * 1000, 1), Rk = U / (I1 / 1000), Rw = U / (I2 / 1000), dt = (I1 / I2 - 1) / al;
      const kopf = `Eine Kupferwicklung liegt an der festen Gleichspannung ${U} V. Direkt nach dem Einschalten (Wicklung kalt, 20 °C) fließen ${fmt(I1)} mA, nach längerem Betrieb nur noch ${fmt(I2)} mA (α = 0,0039 1/K).`;
      const st = [`Kaltwiderstand: R_k = U / I_k = ${U} V / ${fmt(I1)} mA = ${fmt(rd(Rk, 2), 2)} Ω`, `Warmwiderstand: R_w = U / I_w = ${U} V / ${fmt(I2)} mA = ${fmt(rd(Rw, 2), 2)} Ω`];
      const meta = { U, R20, th, I1, I2, al, k };
      if (k === 'rw') return { text: kopf + ' Wie groß ist der Widerstand der warmen Wicklung?', unit: OHM, raw: Rw, dec: 1, meta, steps: [`Die Spannung bleibt gleich, also gilt R = U / I mit dem kleineren Strom.`].concat(st.slice(1)), tips: ['Eine Wicklung ist ein Draht, der zu einer Spule gewickelt ist, zum Beispiel im Motor. Bei gleicher Spannung bedeutet ein kleinerer Strom einen größeren Widerstand. Rechne mit dem Strom nach der Erwärmung.', 'R = U / I. Den Strom vorher von mA in A umrechnen (durch 1000). So gehst du vor: 1. Rechne den Strom nach der Erwärmung in A um. 2. R = U / I. 3. Trage R in Ω ein.'] };
      const st2 = st.concat([`Aus R_w = R_k · (1 + α · Δϑ) folgt Δϑ = (R_w / R_k − 1) / α = (${fmt(rd(Rw / Rk, 4), 4)} − 1) / 0,0039 1/K = ${fmt(rd(dt, 1), 1)} K`]);
      if (k === 'dt') return { text: kopf + ' Um wie viel Kelvin hat sich die Wicklung erwärmt?', unit: 'K', raw: dt, dec: 0, meta, steps: st2, tips: ['Eine Wicklung ist ein Draht, der zu einer Spule gewickelt ist, zum Beispiel im Motor. Der Strom sinkt, weil der Widerstand mit der Temperatur steigt. Berechne zuerst den kalten und den warmen Widerstand mit R = U / I.', 'Dann R_w = R_k · (1 + α · Δϑ) nach Δϑ umstellen. Kürzer: R_w / R_k ist gleich dem Verhältnis der beiden Ströme. So gehst du vor: 1. Rechne R_k = U / I_k und R_w = U / I_w (Ströme in A). 2. Rechne Δϑ = (R_w / R_k − 1) / α. 3. Trage Δϑ in K ein.'] };
      return { text: kopf + ' Welche Temperatur hat die warme Wicklung?', unit: '°C', raw: 20 + dt, dec: 0, meta, steps: st2.concat([`Temperatur: ϑ = 20 °C + ${fmt(rd(dt, 1), 1)} K = ${fmt(rd(20 + dt, 1), 1)} °C`]), tips: ['Eine Wicklung ist ein Draht, der zu einer Spule gewickelt ist, zum Beispiel im Motor. Der Strom sinkt, weil der Widerstand mit der Temperatur steigt. Berechne zuerst den kalten und den warmen Widerstand mit R = U / I.', 'Stelle R_w = R_k · (1 + α · Δϑ) nach Δϑ um und zähle die Anfangstemperatur der kalten Wicklung dazu. So gehst du vor: 1. Rechne R_k und R_w wie oben. 2. Rechne Δϑ = (R_w / R_k − 1) / α. 3. Temperatur = 20 °C + Δϑ. 4. Trage sie in °C ein.'] };
    }],
    ['Umstellen', 2, 'Leitung aus Aluminium statt Kupfer', R => {
      const rCu = 0.0178, rAl = 0.0278, A = pick(R, [1.5, 2.5, 4, 6, 10, 16, 25]), l = pick(R, [20, 35, 50, 80, 120]), k = pick(R, ['A', 'A', 'R']);
      const kopf = `Eine Kupferleitung (ρ = 0,0178 Ω·mm²/m) mit ${fmt(A)} mm² Querschnitt ist ${l} m lang. Sie soll durch eine Aluminiumleitung (ρ = 0,0278 Ω·mm²/m) gleicher Länge ersetzt werden.`, meta = { A, l, rCu, rAl, k };
      if (k === 'R') { const Rc = rCu * l / A, Ra = rAl * l / A; return { text: kopf + ` Welchen Widerstand hätte eine Aluminiumleitung mit demselben Querschnitt?`, unit: OHM, raw: Ra, dec: 3, meta, steps: [`Kupfer: R = ρ · l / A = 0,0178 · ${l} / ${fmt(A)} = ${fmt(rd(Rc, 4), 4)} Ω`, `Aluminium: R = 0,0278 · ${l} / ${fmt(A)} = ${fmt(rd(Ra, 4), 4)} Ω`, `Das ist das ${fmt(rd(rAl / rCu, 3), 3)}-Fache des Kupferwerts.`], tips: ['Gleiche Länge und gleicher Querschnitt: Nur der spezifische Widerstand ist anders.', 'R = ρ · l / A mit dem Wert für Aluminium einsetzen.'] }; }
      const Aa = A * rAl / rCu;
      return { text: kopf + ' Welchen Querschnitt in mm² braucht die Aluminiumleitung, damit ihr Widerstand gleich bleibt?', unit: 'mm²', raw: Aa, dec: 2, meta, steps: [`Gleicher Widerstand: ρ_Cu · l / A_Cu = ρ_Al · l / A_Al, die Länge kürzt sich heraus.`, `A_Al = A_Cu · ρ_Al / ρ_Cu = ${fmt(A)} mm² · 0,0278 / 0,0178`, `A_Al = ${fmt(rd(Aa, 3), 3)} mm²`], tips: ['Setze die Widerstände beider Leitungen gleich: R = ρ · l / A. Die Länge ist bei beiden gleich und kürzt sich weg.', 'Aluminium leitet schlechter, also muss der Querschnitt im Verhältnis der spezifischen Widerstände größer werden.'] };
    }],
    ['Geometrie', 3, 'Masse einer Leitung aus Aluminium und Kupfer', R => {
      const rCu = 0.0178, rAl = 0.0278, dCu = 8.9, dAl = 2.7, A = pick(R, [10, 16, 25, 35, 50, 70]), l = pick(R, [100, 200, 250, 400, 500]), k = pick(R, ['al', 'diff']);
      const Aa = A * rAl / rCu, mCu = dCu * A * l / 1000, mAl = dAl * Aa * l / 1000, meta = { A, l, k };
      const kopf = `Ein Kupferseil (ρ = 0,0178 Ω·mm²/m, Dichte 8,9 g/cm³) mit ${A} mm² Querschnitt ist ${l} m lang. Ein Aluminiumseil (ρ = 0,0278 Ω·mm²/m, Dichte 2,7 g/cm³) gleicher Länge soll denselben Widerstand haben.`;
      const st = [`Querschnitt Aluminium: A_Al = ${A} mm² · 0,0278 / 0,0178 = ${fmt(rd(Aa, 2), 2)} mm²`, `Volumen: 1 mm² · 1 m = 1 cm³, also V_Al = ${fmt(rd(Aa, 2), 2)} · ${l} = ${fmt(rd(Aa * l, 0), 0)} cm³`, `Masse Aluminium: m = 2,7 g/cm³ · ${fmt(rd(Aa * l, 0), 0)} cm³ = ${fmt(rd(mAl, 2), 2)} kg`];
      if (k === 'al') return { text: kopf + ' Wie schwer ist das Aluminiumseil in kg?', unit: 'kg', raw: mAl, dec: 1, meta, steps: st, tips: ['Zuerst den Querschnitt, den Aluminium für denselben Widerstand braucht, dann das Volumen, zuletzt die Masse mit der Dichte.', 'A_Al = A_Cu · ρ_Al / ρ_Cu. Querschnitt in mm² mal Länge in m ergibt das Volumen in cm³, mal Dichte ergibt Gramm.'] };
      return { text: kopf + ' Wie viel kg ist das Aluminiumseil leichter als das Kupferseil?', unit: 'kg', raw: mCu - mAl, dec: 1, meta, steps: st.concat([`Masse Kupfer: m = 8,9 g/cm³ · ${A} · ${l} cm³ = ${fmt(rd(mCu, 2), 2)} kg`, `Unterschied: ${fmt(rd(mCu, 2), 2)} kg − ${fmt(rd(mAl, 2), 2)} kg = ${fmt(rd(mCu - mAl, 2), 2)} kg`]), tips: ['Berechne beide Massen: Kupfer mit seinem Querschnitt, Aluminium mit dem größeren Querschnitt für denselben Widerstand.', 'Querschnitt in mm² mal Länge in m ergibt cm³. Mal Dichte in g/cm³ ergibt Gramm, durch 1000 Kilogramm. Dann die Differenz bilden.'] };
    }],
    ['Einheiten', 1, 'Bereitschaftsbetrieb: Kosten im Jahr', R => {
      const pool = [['Fernseher', 0.5], ['Router', 7], ['Drucker', 2.5], ['Ladegerät', 0.3], ['Kaffeemaschine', 1.5], ['Werkstattradio', 1.2], ['Zeiterfassungsterminal', 4]], n = pick(R, [2, 3]), dev = C.shuffle(R, pool).slice(0, n), pr = pick(R, [0.3, 0.32, 0.35, 0.38, 0.4]), k = pick(R, ['E', 'K', 'K']);
      const P = rd(dev.reduce((s, d) => s + d[1], 0), 2), E = P * 8760 / 1000, meta = { P, pr, k, dev: dev.map(d => d[1]) };
      const kopf = `In einer Werkstatt bleiben das ganze Jahr Tag und Nacht in Bereitschaft: ${dev.map(d => d[0] + ' (' + fmt(d[1]) + ' W)').join(', ')}.`;
      const st = [`Leistung zusammen: ${dev.map(d => fmt(d[1])).join(' W + ')} W = ${fmt(P)} W`, `Stunden im Jahr: 365 · 24 h = 8760 h`, `Energie: ${fmt(P)} W · 8760 h = ${fmt(rd(P * 8760, 1))} Wh = ${fmt(rd(E, 3), 3)} kWh`];
      if (k === 'E') return { text: kopf + ' Wie viel Energie in kWh verbrauchen sie zusammen in einem Jahr?', unit: 'kWh', raw: E, dec: 2, meta, steps: st, tips: ['Addiere zuerst die Leistungen der Geräte. Ein Jahr hat 365 Tage zu je 24 Stunden.', 'Energie = Leistung mal Zeit. Das Ergebnis in Wh durch 1000 teilen ergibt kWh.'] };
      return { text: kopf + ` Eine kWh kostet ${fmt(pr)} €. Was kostet die Bereitschaft im Jahr?`, unit: '€', raw: E * pr, dec: 2, meta, steps: st.concat([`Kosten: ${fmt(rd(E, 3), 3)} kWh · ${fmt(pr)} €/kWh = ${fmt(rd(E * pr, 3), 3)} €`]), tips: ['Addiere die Leistungen und rechne mit 365 · 24 Stunden die Energie im Jahr aus (in kWh).', 'Kosten = Energie in kWh mal Preis je kWh.'] };
    }],
    ['Prozent', 3, 'Neue Umwälzpumpe: lohnt sich der Tausch?', R => {
      const [Pa, Pn] = pick(R, [[80, 25], [65, 20], [100, 35], [90, 18], [60, 15], [120, 40]]), pr = pick(R, [0.3, 0.32, 0.35, 0.4]), mehr = pick(R, [150, 180, 220, 260, 300]), k = pick(R, ['eur', 'pz', 'am']);
      const Ka = Pa * 8760 / 1000 * pr, Kn = Pn * 8760 / 1000 * pr, sp = Ka - Kn, meta = { Pa, Pn, pr, mehr, k };
      const kopf = `Eine alte Umwälzpumpe mit ${Pa} W läuft im Dauerbetrieb (365 Tage, 24 Stunden). Eine neue Pumpe braucht für dieselbe Arbeit nur ${Pn} W. Eine kWh kostet ${fmt(pr)} €.`;
      const st = [`Stunden im Jahr: 365 · 24 h = 8760 h`, `Kosten alt: ${Pa} W · 8760 h = ${fmt(rd(Pa * 8.76, 2), 2)} kWh, mal ${fmt(pr)} €/kWh = ${fmt(rd(Ka, 2), 2)} €`, `Kosten neu: ${Pn} W · 8760 h = ${fmt(rd(Pn * 8.76, 2), 2)} kWh, mal ${fmt(pr)} €/kWh = ${fmt(rd(Kn, 2), 2)} €`, `Ersparnis: ${fmt(rd(Ka, 2), 2)} € − ${fmt(rd(Kn, 2), 2)} € = ${fmt(rd(sp, 2), 2)} € im Jahr`];
      if (k === 'eur') return { text: kopf + ' Wie viel Euro spart die neue Pumpe im Jahr?', unit: '€', raw: sp, dec: 2, meta, steps: st, tips: ['Rechne die Energiekosten beider Pumpen für ein ganzes Jahr aus (8760 Stunden) und bilde die Differenz.', 'Schneller: Nur die Leistungsdifferenz zählt. Differenz in W mal 8760 h, in kWh umrechnen, mal Preis.'] };
      if (k === 'pz') return { text: kopf + ' Um wie viel Prozent sinken die Stromkosten der Pumpe?', unit: '%', raw: (Pa - Pn) / Pa * 100, dec: 1, meta, steps: st.concat([`Anteil: ${fmt(rd(sp, 2), 2)} € / ${fmt(rd(Ka, 2), 2)} € · 100 % = ${fmt(rd((Pa - Pn) / Pa * 100, 2), 2)} % (gleich (alt − neu) / alt bei den Leistungen)`]), tips: ['Grundwert sind die Kosten der alten Pumpe (100 %). Die Ersparnis ist der Prozentwert.', 'Weil Zeit und Preis bei beiden gleich sind, genügt das Verhältnis der Leistungen: (alt − neu) / alt · 100 %.'] };
      return { text: kopf + ` Die neue Pumpe kostet ${mehr} € mehr als eine Reparatur der alten. Nach wie vielen Jahren hat die Ersparnis den Mehrpreis gedeckt?`, unit: 'Jahre', raw: mehr / sp, dec: 1, meta, steps: st.concat([`Amortisationszeit: ${mehr} € / ${fmt(rd(sp, 2), 2)} € pro Jahr = ${fmt(rd(mehr / sp, 2), 2)} Jahre`]), tips: ['Berechne zuerst die Ersparnis an Stromkosten in einem Jahr.', 'Teile den Mehrpreis durch die Ersparnis pro Jahr: So viele Jahre dauert es, bis sich der Tausch bezahlt macht.'] };
    }],
    /* ---------- Prüfung Teil 1 (v62.179): Rechenaufgaben zu den Themen der Abschlussprüfung Teil 1. Themen und Rechentiefe sind an den Prüfungen ausgerichtet, Texte und Zahlen sind eigene (keine Prüfungsaufgabe übernommen). mat49 bis mat60: 1. Lehrjahr, mat61 bis mat70: 2. Lehrjahr (lehrjahr.js). ---------- */
    [PT1, 1, 'LED: Vorwiderstand berechnen', R => {
      const Ub = pick(R, [5, 9, 12, 24]), Uf = pick(R, [1.8, 2, 2.2, 3, 3.2]), I = pick(R, [10, 15, 20]), k = pick(R, ['R', 'R', 'P']), Ur = rd(Ub - Uf, 1), Rv = Ur / (I / 1000), Pv = Ur * I;
      const kopf = `Eine LED (Durchlassspannung ${fmt(Uf)} V) soll an ${Ub} V mit ${I} mA betrieben werden. Davor sitzt ein Vorwiderstand.`, st = [`Spannung am Vorwiderstand: U_R = ${Ub} V − ${fmt(Uf)} V = ${fmt(Ur)} V`], meta = { Ub, Uf, I, k };
      if (k === 'R') return { text: kopf + ' Wie groß muss der Vorwiderstand sein?', unit: OHM, raw: Rv, dec: 0, meta, steps: st.concat([`Strom in A: ${I} mA = ${fmt(I / 1000)} A`, `R = U_R / I = ${fmt(Ur)} V / ${fmt(I / 1000)} A = ${fmt(rd(Rv, 1), 1)} Ω`]), tips: ['LED und Vorwiderstand liegen in Reihe. Die Betriebsspannung teilt sich auf beide auf, der Strom ist in beiden gleich.', 'Am Vorwiderstand liegt die Betriebsspannung minus die Spannung der LED. So gehst du vor: 1. U_R = Betriebsspannung − LED-Spannung. 2. Strom von mA in A umrechnen (durch 1000). 3. R = U_R / I. 4. Trage R in Ω ein.'] };
      return { text: kopf + ' Welche Leistung setzt der Vorwiderstand in Wärme um?', unit: 'mW', raw: Pv, dec: 0, meta, steps: st.concat([`P = U_R · I = ${fmt(Ur)} V · ${I} mA = ${fmt(rd(Pv, 1), 1)} mW`]), tips: ['LED und Vorwiderstand liegen in Reihe. Für die Leistung am Widerstand brauchst du die Spannung am Widerstand, nicht die ganze Betriebsspannung.', 'P = U_R · I. Volt mal Milliampere ergibt Milliwatt. So gehst du vor: 1. U_R = Betriebsspannung − LED-Spannung. 2. P = U_R · I. 3. Trage P in mW ein.'] };
    }],
    [PT1, 1, 'Reihenschaltung: Strom und Teilspannung', R => {
      const W = [100, 220, 330, 470, 680, 1000], R1 = pick(R, W), R2 = pick(R, W.filter(x => x !== R1)), U = pick(R, [6, 9, 12, 24]), k = pick(R, ['I', 'U2']), Rg = R1 + R2, I = U / Rg * 1000, U2 = U * R2 / Rg, meta = { R1, R2, U, k };
      const kopf = `Zwei Widerstände R1 = ${kO(R1)} und R2 = ${kO(R2)} liegen in Reihe an ${U} V.`, st = [`Gesamtwiderstand: R = R1 + R2 = ${R1} Ω + ${R2} Ω = ${Rg} Ω`, `Strom: I = U / R = ${U} V / ${Rg} Ω = ${fmt(rd(I, 3), 3)} mA`];
      if (k === 'I') return { text: kopf + ' Wie groß ist der Strom?', unit: 'mA', raw: I, dec: 2, meta, steps: st, tips: ['In der Reihenschaltung fließt überall derselbe Strom. Die Widerstände addieren sich.', 'Erst den Gesamtwiderstand bilden, dann das ohmsche Gesetz. So gehst du vor: 1. R = R1 + R2. 2. I = U / R (ergibt A). 3. In mA umrechnen (mal 1000). 4. Trage I in mA ein.'] };
      return { text: kopf + ' Wie groß ist die Spannung an R2?', unit: 'V', raw: U2, dec: 2, meta, steps: st.concat([`Spannung an R2: U2 = I · R2 = ${fmt(rd(I, 3), 3)} mA · ${R2} Ω = ${fmt(rd(U2, 3), 3)} V`]), tips: ['In der Reihenschaltung fließt überall derselbe Strom. An dem größeren Widerstand fällt die größere Spannung ab.', 'Berechne zuerst den Strom, dann die Spannung an R2. So gehst du vor: 1. R = R1 + R2. 2. I = U / R. 3. U2 = I · R2 (Strom in A einsetzen). 4. Trage U2 in V ein.'] };
    }],
    [PT1, 2, 'Parallelschaltung: Ersatzwiderstand und Gesamtstrom', R => {
      const W = [100, 150, 220, 330, 470, 680, 1000, 2200], R1 = pick(R, W), R2 = pick(R, W.filter(x => x !== R1)), U = pick(R, [5, 12, 24]), k = pick(R, ['R', 'I']), Rg = R1 * R2 / (R1 + R2), I = U / Rg * 1000, meta = { R1, R2, U, k };
      const st = [`Formel für zwei parallele Widerstände: R = R1 · R2 / (R1 + R2)`, `Ersatzwiderstand: R = R1 · R2 / (R1 + R2) =${R1} Ω · ${R2} Ω / ${R1 + R2} Ω = ${fmt(rd(Rg, 2), 2)} Ω`];
      if (k === 'R') return { text: `Zwei Widerstände R1 = ${kO(R1)} und R2 = ${kO(R2)} sind parallel geschaltet. Wie groß ist der Ersatzwiderstand?`, unit: OHM, raw: Rg, dec: 1, meta, steps: st, tips: ['In der Parallelschaltung ist der Ersatzwiderstand immer kleiner als der kleinste Einzelwiderstand. Damit kannst du dein Ergebnis prüfen.', 'Für zwei Widerstände gilt: Produkt geteilt durch Summe. So gehst du vor: 1. R1 · R2 rechnen. 2. R1 + R2 rechnen. 3. Das Produkt durch die Summe teilen. 4. Trage R in Ω ein.'] };
      return { text: `Zwei Widerstände R1 = ${kO(R1)} und R2 = ${kO(R2)} liegen parallel an ${U} V. Wie groß ist der Gesamtstrom?`, unit: 'mA', raw: I, dec: 1, meta, steps: [`Strom durch R1: I1 = ${U} V / ${R1} Ω = ${fmt(rd(U / R1 * 1000, 2), 2)} mA`, `Strom durch R2: I2 = ${U} V / ${R2} Ω = ${fmt(rd(U / R2 * 1000, 2), 2)} mA`, `Gesamtstrom: I = I1 + I2 = ${fmt(rd(I, 2), 2)} mA`], tips: ['In der Parallelschaltung liegt an jedem Widerstand dieselbe Spannung. Die Teilströme addieren sich zum Gesamtstrom.', 'Berechne beide Teilströme einzeln und zähle sie zusammen. So gehst du vor: 1. I1 = U / R1. 2. I2 = U / R2. 3. I = I1 + I2. 4. In mA umrechnen (mal 1000) und eintragen.'] };
    }],
    [PT1, 2, 'Spannungsteiler: Teilspannung', R => {
      const W = [1, 2.2, 3.3, 4.7, 6.8, 10], R1 = pick(R, W), R2 = pick(R, W.filter(x => x !== R1)), U = pick(R, [5, 9, 12, 15, 24]), k = pick(R, ['U2', 'U2', 'U1']), U2 = U * R2 / (R1 + R2), meta = { R1, R2, U, k };
      const kopf = `Ein Spannungsteiler aus R1 = ${fmt(R1)} kΩ (oben) und R2 = ${fmt(R2)} kΩ (unten) liegt an ${U} V. Er ist nicht belastet.`, st = [`Gesamtwiderstand: R1 + R2 = ${fmt(R1)} kΩ + ${fmt(R2)} kΩ = ${fmt(rd(R1 + R2, 1))} kΩ`, `U2 = U · R2 / (R1 + R2) = ${U} V · ${fmt(R2)} kΩ / ${fmt(rd(R1 + R2, 1))} kΩ = ${fmt(rd(U2, 3), 3)} V`];
      if (k === 'U2') return { text: kopf + ' Wie groß ist die Spannung an R2?', unit: 'V', raw: U2, dec: 2, meta, steps: st, tips: ['Die Spannungen teilen sich im gleichen Verhältnis auf wie die Widerstände. Am größeren Widerstand liegt die größere Spannung.', 'U2 = U · R2 / (R1 + R2). Die Einheit kΩ kürzt sich heraus. So gehst du vor: 1. R1 + R2 rechnen. 2. R2 durch diese Summe teilen. 3. Mit der Gesamtspannung malnehmen. 4. Trage U2 in V ein.'] };
      return { text: kopf + ' Wie groß ist die Spannung an R1?', unit: 'V', raw: U - U2, dec: 2, meta, steps: st.concat([`U1 = U − U2 = ${U} V − ${fmt(rd(U2, 3), 3)} V = ${fmt(rd(U - U2, 3), 3)} V`]), tips: ['Die Spannungen teilen sich im gleichen Verhältnis auf wie die Widerstände. Beide Teilspannungen zusammen ergeben die Gesamtspannung.', 'U1 = U · R1 / (R1 + R2). Die Einheit kΩ kürzt sich heraus. So gehst du vor: 1. R1 + R2 rechnen. 2. R1 durch diese Summe teilen. 3. Mit der Gesamtspannung malnehmen. 4. Trage U1 in V ein.'] };
    }],
    [PT1, 3, 'Gemischte Schaltung: Ersatzwiderstand', R => {
      const R1 = pick(R, [100, 220, 330, 470]), [R2, R3] = pick(R, [[100, 100], [220, 220], [150, 300], [200, 300], [470, 470], [300, 600], [1000, 1000], [400, 600]]), U = pick(R, [6, 12, 24]), k = pick(R, ['R', 'I']), Rp = R2 * R3 / (R2 + R3), Rg = R1 + Rp, I = U / Rg * 1000, meta = { R1, R2, R3, U, k };
      const kopf = `R2 = ${R2} Ω und R3 = ${R3} Ω sind parallel geschaltet. In Reihe dazu liegt R1 = ${R1} Ω.`, st = [`Parallelteil: R23 = R2 · R3 / (R2 + R3) = ${R2} Ω · ${R3} Ω / ${R2 + R3} Ω = ${fmt(rd(Rp, 2), 2)} Ω`, `Gesamt: R = R1 + R23 = ${R1} Ω + ${fmt(rd(Rp, 2), 2)} Ω = ${fmt(rd(Rg, 2), 2)} Ω`];
      if (k === 'R') return { text: kopf + ' Wie groß ist der Gesamtwiderstand?', unit: OHM, raw: Rg, dec: 1, meta, steps: st, tips: ['Fasse die Schaltung von innen nach außen zusammen: zuerst die beiden parallelen Widerstände, dann die Reihenschaltung.', 'Für den Parallelteil gilt Produkt durch Summe. So gehst du vor: 1. R23 = R2 · R3 / (R2 + R3). 2. R = R1 + R23. 3. Trage R in Ω ein.'] };
      return { text: kopf + ` Die Schaltung liegt an ${U} V. Wie groß ist der Gesamtstrom?`, unit: 'mA', raw: I, dec: 1, meta, steps: st.concat([`I = U / R = ${U} V / ${fmt(rd(Rg, 2), 2)} Ω = ${fmt(rd(I, 2), 2)} mA`]), tips: ['Der Gesamtstrom hängt vom Gesamtwiderstand ab. Fasse zuerst die beiden parallelen Widerstände zusammen, dann die Reihenschaltung.', 'Mit dem Gesamtwiderstand gilt das ohmsche Gesetz. So gehst du vor: 1. R23 = R2 · R3 / (R2 + R3). 2. R = R1 + R23. 3. I = U / R. 4. In mA umrechnen (mal 1000) und eintragen.'] };
    }],
    [PT1, 1, 'Leistung: P = U · I', R => {
      const k = pick(R, ['P', 'I', 'R']);
      if (k === 'P') { const U = pick(R, [12, 24, 230]), I = pick(R, [0.5, 1.5, 2, 4, 6.5]); return { text: `Ein Gerät liegt an ${U} V und nimmt ${fmt(I)} A auf. Wie groß ist seine Leistung?`, unit: 'W', raw: U * I, dec: 1, meta: { k, U, I }, steps: [`Formel: P = U · I`, `P = ${U} V · ${fmt(I)} A = ${fmt(rd(U * I, 1), 1)} W`], tips: ['Die elektrische Leistung ist das Produkt aus Spannung und Strom.', 'P = U · I. Volt mal Ampere ergibt Watt. So gehst du vor: 1. Spannung und Strom aus dem Text nehmen. 2. Beide malnehmen. 3. Trage P in W ein.'] }; }
      if (k === 'I') { const U = 230, P = pick(R, [40, 60, 100, 600, 1200, 2000]); return { text: `Ein Gerät mit ${P} W liegt an ${U} V. Wie groß ist der Strom?`, unit: 'A', raw: P / U, dec: 2, meta: { k, U, P }, steps: [`Formel: P = U · I, umgestellt: I = P / U`, `I = ${P} W / ${U} V = ${fmt(rd(P / U, 3), 3)} A`], tips: ['Die Formel P = U · I muss nach dem Strom umgestellt werden.', 'I = P / U. Watt geteilt durch Volt ergibt Ampere. So gehst du vor: 1. P = U · I nach I umstellen. 2. Leistung durch Spannung teilen. 3. Trage I in A ein.'] }; }
      const U = pick(R, [12, 24, 230]), P = pick(R, [6, 12, 24, 48, 100]); return { text: `Ein Heizwiderstand soll an ${U} V eine Leistung von ${P} W abgeben. Wie groß muss sein Widerstand sein?`, unit: OHM, raw: U * U / P, dec: 1, meta: { k, U, P }, steps: [`Aus P = U · I und I = U / R folgt P = U² / R`, `Umgestellt: R = U² / P = (${U} V)² / ${P} W = ${fmt(rd(U * U / P, 2), 2)} Ω`], tips: ['Der Strom ist hier nicht gegeben. Setze das ohmsche Gesetz in die Leistungsformel ein, dann bleibt nur der Widerstand übrig.', 'Es gilt P = U² / R. So gehst du vor: 1. Nach R umstellen: R = U² / P. 2. Die Spannung mit sich selbst malnehmen. 3. Durch die Leistung teilen. 4. Trage R in Ω ein.'] };
    }],
    [PT1, 2, 'Leistung bei anderer Spannung', R => {
      const U1 = 230, U2 = pick(R, [115, 200, 207, 240]), P1 = pick(R, [500, 1000, 1500, 2000]), Rh = U1 * U1 / P1, P2 = U2 * U2 / Rh;
      return { text: `Ein Heizwiderstand nimmt an ${U1} V eine Leistung von ${P1} W auf. Welche Leistung nimmt er an ${U2} V auf? (Der Widerstand bleibt gleich.)`, unit: 'W', raw: P2, dec: 0, meta: { U1, U2, P1 }, steps: [`Widerstand: R = U1² / P1 = (${U1} V)² / ${P1} W = ${fmt(rd(Rh, 2), 2)} Ω`, `Neue Leistung: P2 = U2² / R = (${U2} V)² / ${fmt(rd(Rh, 2), 2)} Ω = ${fmt(rd(P2, 1), 1)} W`, `Kontrolle: Die Leistung ändert sich mit dem Quadrat der Spannung, (${U2} / ${U1})² = ${fmt(rd(U2 * U2 / (U1 * U1), 3), 3)}`], tips: ['Der Widerstand bleibt gleich, aber mit der Spannung ändert sich auch der Strom. Deshalb ändert sich die Leistung stärker als die Spannung.', 'Rechne über den Widerstand. So gehst du vor: 1. R = U1² / P1. 2. P2 = U2² / R. 3. Trage P2 in W ein.'] };
    }],
    [PT1, 1, 'Wirkungsgrad und Verlustleistung', R => {
      const Pzu = pick(R, [40, 60, 120, 250, 800, 1500]), eta = pick(R, [70, 75, 80, 85, 90, 95]), Pab = Pzu * eta / 100, k = pick(R, ['eta', 'Pv', 'Pzu']), meta = { Pzu, eta, Pab, k };
      if (k === 'eta') return { text: `Ein Netzteil nimmt ${Pzu} W auf und gibt ${fmt(Pab)} W ab. Wie groß ist der Wirkungsgrad?`, unit: '%', raw: eta, dec: 1, meta, steps: [`Formel: η = P_ab / P_zu`, `η = ${fmt(Pab)} W / ${Pzu} W = ${fmt(eta / 100)} = ${eta} %`], tips: ['Der Wirkungsgrad sagt, welcher Anteil der aufgenommenen Leistung genutzt wird. Er ist immer kleiner als 100 %.', 'η = abgegebene Leistung geteilt durch aufgenommene Leistung. So gehst du vor: 1. P_ab durch P_zu teilen. 2. Mit 100 malnehmen. 3. Trage η in % ein.'] };
      if (k === 'Pv') return { text: `Ein Netzteil nimmt ${Pzu} W auf und hat einen Wirkungsgrad von ${eta} %. Wie groß ist die Verlustleistung?`, unit: 'W', raw: Pzu - Pab, dec: 1, meta, steps: [`Abgegebene Leistung: P_ab = η · P_zu = ${fmt(eta / 100)} · ${Pzu} W = ${fmt(Pab)} W`, `Verlust: P_v = P_zu − P_ab = ${Pzu} W − ${fmt(Pab)} W = ${fmt(rd(Pzu - Pab, 2))} W`], tips: ['Die Verlustleistung ist der Teil der aufgenommenen Leistung, der nicht genutzt wird. Meist wird er zu Wärme.', 'Berechne zuerst die abgegebene Leistung. So gehst du vor: 1. P_ab = P_zu · η / 100. 2. P_v = P_zu − P_ab. 3. Trage P_v in W ein.'] };
      return { text: `Ein Motor gibt ${fmt(Pab)} W ab und hat einen Wirkungsgrad von ${eta} %. Welche Leistung nimmt er auf?`, unit: 'W', raw: Pzu, dec: 1, meta, steps: [`Formel: η = P_ab / P_zu, umgestellt: P_zu = P_ab / η`, `P_zu = ${fmt(Pab)} W / ${fmt(eta / 100)} = ${Pzu} W`], tips: ['Die aufgenommene Leistung ist immer größer als die abgegebene. Damit kannst du dein Ergebnis prüfen.', 'Stelle η = P_ab / P_zu nach P_zu um. So gehst du vor: 1. Den Wirkungsgrad als Dezimalzahl schreiben (durch 100). 2. P_ab durch diese Zahl teilen. 3. Trage P_zu in W ein.'] };
    }],
    [PT1, 1, 'Widerstand: Grenzen der Toleranz', R => {
      const Rn = pick(R, [120, 470, 1000, 2200, 4700, 10000]), tol = pick(R, [1, 2, 5, 10]), k = pick(R, ['min', 'max']), d = Rn * tol / 100, v = k === 'min' ? Rn - d : Rn + d;
      return { text: `Ein Widerstand hat den Nennwert ${kO(Rn)} und die Toleranz ±${tol} %. Welchen Wert darf er ${k === 'min' ? 'mindestens' : 'höchstens'} haben?`, unit: OHM, raw: v, dec: 1, meta: { Rn, tol, k }, steps: [`Abweichung: ${tol} % von ${Rn} Ω = ${Rn} Ω · ${tol} / 100 = ${fmt(rd(d, 2))} Ω`, `${k === 'min' ? 'Kleinster' : 'Größter'} Wert: ${Rn} Ω ${k === 'min' ? '−' : '+'} ${fmt(rd(d, 2))} Ω = ${fmt(rd(v, 2))} Ω`], tips: ['Die Toleranz gibt an, um wie viel Prozent der wirkliche Wert vom Nennwert abweichen darf, nach oben und nach unten.', `Berechne zuerst die Abweichung in Ω. So gehst du vor: 1. Nennwert in Ω mal Toleranz geteilt durch 100. 2. Diese Abweichung ${k === 'min' ? 'vom Nennwert abziehen' : 'zum Nennwert dazuzählen'}. 3. Trage den Wert in Ω ein.`] };
    }],
    [PT1, 1, 'Dualzahl in Dezimalzahl umrechnen', R => {
      const n = ri(R, 17, 255), b = n.toString(2), z = b.split('').map((c, i) => c === '1' ? Math.pow(2, b.length - 1 - i) : 0).filter(x => x);
      return { text: `Rechne die Dualzahl ${b} in eine Dezimalzahl um.`, unit: '', raw: n, dec: 0, meta: { n, b }, steps: [`Stellenwerte von rechts nach links: 1, 2, 4, 8, 16, 32, 64, 128`, `Überall, wo eine 1 steht, zählt der Stellenwert: ${z.join(' + ')}`, `Summe: ${n}`], tips: ['Jede Stelle einer Dualzahl hat einen festen Wert. Von rechts nach links verdoppelt er sich: 1, 2, 4, 8 und so weiter.', 'Schreibe die Stellenwerte über die Ziffern. So gehst du vor: 1. Rechts mit 1 anfangen und nach links immer verdoppeln. 2. Nur die Stellenwerte nehmen, unter denen eine 1 steht. 3. Diese Werte zusammenzählen und die Summe eintragen.'] };
    }],
    [PT1, 2, 'Hexadezimalzahl in Dezimalzahl umrechnen', R => {
      let n = ri(R, 26, 255); while (!/[A-F]/.test(n.toString(16).toUpperCase())) n = ri(R, 26, 255);
      const h = n.toString(16).toUpperCase(), hi = Math.floor(n / 16), lo = n % 16;
      return { text: `Rechne die Hexadezimalzahl ${h} in eine Dezimalzahl um.`, unit: '', raw: n, dec: 0, meta: { n, h }, steps: [`Ziffern: ${h[0]} hat den Wert ${hi}, ${h[1]} hat den Wert ${lo} (A = 10, B = 11, C = 12, D = 13, E = 14, F = 15)`, `Die linke Stelle zählt 16-fach: ${hi} · 16 = ${hi * 16}`, `Summe: ${hi * 16} + ${lo} = ${n}`], tips: ['Im Hexadezimalsystem gibt es 16 Ziffern: 0 bis 9 und A bis F. A steht für 10, F für 15.', 'Bei zwei Stellen zählt die linke Stelle 16-fach, die rechte einfach. So gehst du vor: 1. Beide Ziffern in ihre Werte übersetzen. 2. Den linken Wert mal 16 nehmen. 3. Den rechten Wert dazuzählen und die Summe eintragen.'] };
    }],
    [PT1, 2, 'Oszilloskop: Frequenz aus dem Bild', R => {
      const tb = pick(R, [0.1, 0.2, 0.5, 1, 2, 5]), dv = pick(R, [2, 4, 5, 8, 10]), T = rd(tb * dv, 2), f = 1000 / T;
      return { text: `Auf dem Oszilloskop ist eine Periode des Signals ${dv} Kästchen breit. Die Zeitablenkung steht auf ${fmt(tb)} ms je Kästchen. Wie groß ist die Frequenz?`, unit: 'Hz', raw: f, dec: 1, meta: { tb, dv }, steps: [`Periodendauer: T = ${dv} · ${fmt(tb)} ms = ${fmt(T)} ms = ${fmt(T / 1000)} s`, `Frequenz: f = 1 / T = 1 / ${fmt(T / 1000)} s = ${fmt(rd(f, 2), 2)} Hz`], tips: ['Die Periodendauer ist die Zeit für eine vollständige Schwingung. Du liest sie waagerecht ab: Kästchen mal Zeit je Kästchen.', 'Die Frequenz ist der Kehrwert der Periodendauer. So gehst du vor: 1. T = Kästchen · Zeit je Kästchen. 2. T von ms in s umrechnen (durch 1000). 3. f = 1 / T. 4. Trage f in Hz ein.'] };
    }],
    [PT1, 2, 'Kondensator: Zeitkonstante und Ladezeit', R => {
      const Rk = pick(R, [1, 4.7, 10, 47, 100]), Cu = pick(R, [1, 4.7, 10, 47, 100]), tau = Rk * Cu, k = pick(R, ['tau', 't5']), meta = { Rk, Cu, k };
      const kopf = `Ein Kondensator mit ${fmt(Cu)} ${MU}F wird über einen Widerstand von ${fmt(Rk)} kΩ geladen.`, st = [`Formel: τ = R · C`, `Zeitkonstante: τ = R · C = ${fmt(Rk)} kΩ · ${fmt(Cu)} ${MU}F = ${fmt(rd(tau, 2))} ms (kΩ mal ${MU}F ergibt ms)`];
      if (k === 'tau') return { text: kopf + ' Wie groß ist die Zeitkonstante?', unit: 'ms', raw: tau, dec: 1, meta, steps: st, tips: ['Die Zeitkonstante sagt, wie schnell der Kondensator geladen wird. Großer Widerstand oder große Kapazität machen das Laden langsamer.', 'τ = R · C. Mit Ω und F ergibt das Sekunden, mit kΩ und µF Millisekunden. So gehst du vor: 1. Widerstand in kΩ und Kapazität in µF nehmen. 2. Beide malnehmen. 3. Trage τ in ms ein.'] };
      return { text: kopf + ' Nach welcher Zeit gilt er als voll geladen (5 Zeitkonstanten)?', unit: 'ms', raw: 5 * tau, dec: 1, meta, steps: st.concat([`Ladezeit: t = 5 · τ = 5 · ${fmt(rd(tau, 2))} ms = ${fmt(rd(5 * tau, 2))} ms`]), tips: ['Ein Kondensator gilt nach fünf Zeitkonstanten als voll geladen. Berechne also zuerst die Zeitkonstante.', 'τ = R · C, mit kΩ und µF ergibt das Millisekunden. So gehst du vor: 1. τ = R · C. 2. t = 5 · τ. 3. Trage t in ms ein.'] };
    }],
    [PT1, 3, 'Kondensator: Spannung nach einer Ladezeit', R => {
      const U = pick(R, [5, 9, 12, 24]), Rk = pick(R, [1, 10, 47, 100]), Cu = pick(R, [1, 10, 47, 100]), n = pick(R, [1, 2, 3]), tau = Rk * Cu, t = n * tau, u = U * (1 - Math.exp(-n));
      return { text: `Ein leerer Kondensator mit ${fmt(Cu)} ${MU}F wird über ${fmt(Rk)} kΩ an ${U} V geladen. Wie groß ist seine Spannung nach ${fmt(t)} ms?`, unit: 'V', raw: u, dec: 2, meta: { U, Rk, Cu, n }, steps: [`Zeitkonstante: τ = R · C = ${fmt(Rk)} kΩ · ${fmt(Cu)} ${MU}F = ${fmt(tau)} ms`, `Verhältnis: t / τ = ${fmt(t)} ms / ${fmt(tau)} ms = ${n}`, `Ladekurve: u = U · (1 − e^(−t/τ)) = ${U} V · (1 − e^(−${n})) = ${U} V · ${fmt(rd(1 - Math.exp(-n), 4), 4)} = ${fmt(rd(u, 3), 3)} V`], tips: ['Der Kondensator lädt sich nicht gleichmäßig, sondern am Anfang schnell und dann immer langsamer. Nach einer Zeitkonstante hat er rund 63 % der Endspannung.', 'Es gilt u = U · (1 − e^(−t/τ)). So gehst du vor: 1. τ = R · C (kΩ mal µF ergibt ms). 2. t durch τ teilen. 3. Mit dem Taschenrechner e hoch minus dieses Verhältnis rechnen und von 1 abziehen. 4. Mit U malnehmen und in V eintragen.'] };
    }],
    [PT1, 2, 'Relais: Spulenstrom und Leistung', R => {
      const U = pick(R, [5, 12, 24]), Rs = pick(R, [120, 240, 360, 480, 720, 960]), k = pick(R, ['I', 'P']), I = U / Rs * 1000, Pw = U * U / Rs, meta = { U, Rs, k };
      const kopf = `Ein Transistor schaltet eine Relaisspule mit ${Rs} Ω an ${U} V. Die Spannung am durchgeschalteten Transistor wird vernachlässigt.`, st = [`Formel: I = U / R (ohmsches Gesetz)`, `Spulenstrom: I = U / R = ${U} V / ${Rs} Ω = ${fmt(rd(I, 2), 2)} mA`];
      if (k === 'I') return { text: kopf + ' Wie groß ist der Spulenstrom?', unit: 'mA', raw: I, dec: 1, meta, steps: st, tips: ['Die Spule verhält sich bei Gleichspannung wie ein Widerstand. Der Transistor arbeitet hier nur als Schalter.', 'Es gilt das ohmsche Gesetz. So gehst du vor: 1. I = U / R (ergibt A). 2. In mA umrechnen (mal 1000). 3. Trage I in mA ein.'] };
      return { text: kopf + ' Welche Leistung nimmt die Spule auf?', unit: 'W', raw: Pw, dec: 2, meta, steps: st.concat([`Leistung: P = U · I = ${U} V · ${fmt(rd(I, 2), 2)} mA = ${fmt(rd(Pw, 3), 3)} W`]), tips: ['Die Spule verhält sich bei Gleichspannung wie ein Widerstand. Für die Leistung brauchst du zuerst den Strom.', 'P = U · I. So gehst du vor: 1. I = U / R (in A). 2. P = U · I. 3. Trage P in W ein.'] };
    }],
    [PT1, 2, 'Transistor als Schalter: Basiswiderstand', R => {
      const Us = pick(R, [3.3, 5, 12]), k = pick(R, ['RB', 'IB']), Ur = rd(Us - 0.7, 1);
      if (k === 'RB') { const Ib = pick(R, [0.5, 1, 2]), v = Ur / Ib * 1000; return { text: `Ein Transistor wird mit ${fmt(Us)} V angesteuert. Es soll ein Basisstrom von ${fmt(Ib)} mA fließen (U_BE = 0,7 V). Wie groß muss der Basiswiderstand sein?`, unit: OHM, raw: v, dec: 0, meta: { Us, Ib, k }, steps: [`Spannung am Basiswiderstand: ${fmt(Us)} V − 0,7 V = ${fmt(Ur)} V`, `R_B = ${fmt(Ur)} V / ${fmt(Ib)} mA = ${fmt(rd(Ur / Ib, 3), 3)} kΩ = ${fmt(rd(v, 1), 1)} Ω`], tips: ['Zwischen Basis und Emitter fallen rund 0,7 V ab. Der Rest der Steuerspannung liegt am Basiswiderstand.', 'Mit dieser Restspannung gilt das ohmsche Gesetz. So gehst du vor: 1. Steuerspannung − 0,7 V rechnen. 2. Durch den Basisstrom teilen (Volt durch mA ergibt kΩ). 3. In Ω umrechnen (mal 1000) und eintragen.'] }; }
      const Rb = pick(R, [2.2, 4.7, 10]), v = Ur / Rb; return { text: `Ein Transistor wird mit ${fmt(Us)} V über einen Basiswiderstand von ${fmt(Rb)} kΩ angesteuert (U_BE = 0,7 V). Wie groß ist der Basisstrom?`, unit: 'mA', raw: v, dec: 2, meta: { Us, Rb, k }, steps: [`Spannung am Basiswiderstand: ${fmt(Us)} V − 0,7 V = ${fmt(Ur)} V`, `I_B = ${fmt(Ur)} V / ${fmt(Rb)} kΩ = ${fmt(rd(v, 3), 3)} mA`], tips: ['Zwischen Basis und Emitter fallen rund 0,7 V ab. Der Rest der Steuerspannung liegt am Basiswiderstand.', 'Mit dieser Restspannung gilt das ohmsche Gesetz. So gehst du vor: 1. Steuerspannung − 0,7 V rechnen. 2. Durch den Basiswiderstand teilen (Volt durch kΩ ergibt mA). 3. Trage I_B in mA ein.'] };
    }],
    [PT1, 2, 'Z-Diode: höchster Strom und Vorwiderstand', R => {
      const Uz = pick(R, [3.3, 5.1, 6.2, 9.1, 12]), k = pick(R, ['Im', 'Rv']);
      if (k === 'Im') { const Pt = pick(R, [0.5, 1.3]), v = Pt / Uz * 1000; return { text: `Eine Z-Diode mit ${fmt(Uz)} V darf höchstens ${fmt(Pt)} W Verlustleistung aufnehmen. Wie groß darf der Strom durch die Z-Diode höchstens sein?`, unit: 'mA', raw: v, dec: 1, meta: { Uz, Pt, k }, steps: [`Formel: P = U · I, umgestellt: I = P / U`, `I = ${fmt(Pt)} W / ${fmt(Uz)} V = ${fmt(rd(Pt / Uz, 4), 4)} A = ${fmt(rd(v, 2), 2)} mA`], tips: ['An der Z-Diode liegt im Betrieb ihre Z-Spannung. Zusammen mit dem Strom ergibt das die Verlustleistung, die sie erwärmt.', 'Stelle P = U · I nach I um. So gehst du vor: 1. I = P / U (ergibt A). 2. In mA umrechnen (mal 1000). 3. Trage I in mA ein.'] }; }
      const Ub = pick(R, [15, 18, 24]), I = pick(R, [10, 20, 25]), Ur = rd(Ub - Uz, 1), v = Ur / I * 1000; return { text: `Eine Z-Diode mit ${fmt(Uz)} V soll an ${Ub} V betrieben werden. Durch den Vorwiderstand sollen ${I} mA fließen. Wie groß muss der Vorwiderstand sein?`, unit: OHM, raw: v, dec: 0, meta: { Uz, Ub, I, k }, steps: [`Spannung am Vorwiderstand: ${Ub} V − ${fmt(Uz)} V = ${fmt(Ur)} V`, `R = ${fmt(Ur)} V / ${I} mA = ${fmt(rd(Ur / I, 4), 4)} kΩ = ${fmt(rd(v, 1), 1)} Ω`], tips: ['Die Z-Diode hält ihre Spannung fest. Was von der Betriebsspannung übrig bleibt, muss der Vorwiderstand aufnehmen.', 'Mit dieser Restspannung gilt das ohmsche Gesetz. So gehst du vor: 1. Betriebsspannung − Z-Spannung rechnen. 2. Durch den Strom teilen (Volt durch mA ergibt kΩ). 3. In Ω umrechnen (mal 1000) und eintragen.'] };
    }],
    [PT1, 2, 'Operationsverstärker: invertierender Verstärker', R => {
      const k = pick(R, ['Ua', 'Ua', 'Rf']); let Re, Rf, Ue;
      do { Re = pick(R, [1, 2.2, 4.7, 10]); Rf = pick(R, [10, 22, 47, 100]); Ue = pick(R, [0.1, 0.2, 0.5, 1]); } while (Rf / Re * Ue > 12 || Rf <= Re);
      if (k === 'Ua') return { text: `Ein invertierender Verstärker hat den Eingangswiderstand R_e = ${fmt(Re)} kΩ und den Rückkopplungswiderstand R_f = ${fmt(Rf)} kΩ. Am Eingang liegen ${fmt(Ue)} V. Wie groß ist die Ausgangsspannung? (Vorzeichen beachten.)`, unit: 'V', raw: -Rf / Re * Ue, dec: 2, meta: { Re, Rf, Ue, k }, steps: [`Verstärkung: v = −R_f / R_e = −${fmt(Rf)} kΩ / ${fmt(Re)} kΩ = −${fmt(rd(Rf / Re, 3), 3)}`, `U_a = v · U_e = −${fmt(rd(Rf / Re, 3), 3)} · ${fmt(Ue)} V = −${fmt(rd(Rf / Re * Ue, 3), 3)} V`], tips: ['Beim invertierenden Verstärker bestimmen nur die beiden Widerstände die Verstärkung. Das Ausgangssignal hat das umgekehrte Vorzeichen.', 'v = −R_f / R_e. So gehst du vor: 1. R_f durch R_e teilen. 2. Mit der Eingangsspannung malnehmen. 3. Ein Minuszeichen davor setzen. 4. Trage U_a in V ein.'] };
      const v = pick(R, [5, 10, 20, 47]); return { text: `Ein invertierender Verstärker hat den Eingangswiderstand R_e = ${fmt(Re)} kΩ. Der Betrag der Verstärkung soll ${v} sein. Wie groß muss der Rückkopplungswiderstand R_f sein?`, unit: 'kΩ', raw: v * Re, dec: 1, meta: { Re, v, k }, steps: [`Betrag der Verstärkung: v = R_f / R_e, umgestellt: R_f = v · R_e`, `R_f = ${v} · ${fmt(Re)} kΩ = ${fmt(rd(v * Re, 2))} kΩ`], tips: ['Beim invertierenden Verstärker ist die Verstärkung das Verhältnis der beiden Widerstände.', 'v = R_f / R_e (ohne Vorzeichen). So gehst du vor: 1. Nach R_f umstellen: R_f = v · R_e. 2. Verstärkung mal Eingangswiderstand rechnen. 3. Trage R_f in kΩ ein.'] };
    }],
    [PT1, 3, 'Operationsverstärker: nicht invertierender Verstärker', R => {
      let R1, R2, Ue; do { R1 = pick(R, [1, 2.2, 4.7, 10]); R2 = pick(R, [10, 22, 47, 100]); Ue = pick(R, [0.1, 0.2, 0.5, 1]); } while ((1 + R2 / R1) * Ue > 12 || R2 <= R1);
      const v = 1 + R2 / R1, k = pick(R, ['v', 'Ua']), st = [`Formel: v = 1 + R2 / R1`, `Verstärkung: v = 1 + R2 / R1 = 1 + ${fmt(R2)} kΩ / ${fmt(R1)} kΩ = ${fmt(rd(v, 3), 3)}`], kopf = `Ein nicht invertierender Verstärker hat R2 = ${fmt(R2)} kΩ in der Rückkopplung und R1 = ${fmt(R1)} kΩ gegen Masse.`;
      if (k === 'v') return { text: kopf + ' Wie groß ist die Verstärkung?', unit: '', raw: v, dec: 2, meta: { R1, R2, Ue, k }, steps: st, tips: ['Beim nicht invertierenden Verstärker ist die Verstärkung immer größer als 1. Das Vorzeichen bleibt erhalten.', 'v = 1 + R2 / R1. So gehst du vor: 1. R2 durch R1 teilen. 2. Eins dazuzählen. 3. Trage die Verstärkung ein (sie hat keine Einheit).'] };
      return { text: kopf + ` Am Eingang liegen ${fmt(Ue)} V. Wie groß ist die Ausgangsspannung?`, unit: 'V', raw: v * Ue, dec: 2, meta: { R1, R2, Ue, k }, steps: st.concat([`U_a = v · U_e = ${fmt(rd(v, 3), 3)} · ${fmt(Ue)} V = ${fmt(rd(v * Ue, 3), 3)} V`]), tips: ['Beim nicht invertierenden Verstärker ist die Verstärkung immer größer als 1. Das Vorzeichen bleibt erhalten.', 'v = 1 + R2 / R1. So gehst du vor: 1. R2 durch R1 teilen. 2. Eins dazuzählen. 3. Mit der Eingangsspannung malnehmen. 4. Trage U_a in V ein.'] };
    }],
    [PT1, 2, 'Festspannungsregler: Verlustleistung', R => {
      const Ua = pick(R, [3.3, 5]), Ue = pick(R, [9, 12, 15, 24]), I = pick(R, [0.1, 0.25, 0.5, 1]), k = pick(R, ['P', 'P', 'eta']), Ud = rd(Ue - Ua, 1), kopf = `Ein Festspannungsregler macht aus ${Ue} V eine Ausgangsspannung von ${fmt(Ua)} V. Die Last nimmt ${fmt(I)} A auf. Der Eigenverbrauch des Reglers wird vernachlässigt.`;
      if (k === 'P') return { text: kopf + ' Welche Verlustleistung entsteht im Regler?', unit: 'W', raw: Ud * I, dec: 2, meta: { Ua, Ue, I, k }, steps: [`Spannung über dem Regler: ${Ue} V − ${fmt(Ua)} V = ${fmt(Ud)} V`, `P_v = ${fmt(Ud)} V · ${fmt(I)} A = ${fmt(rd(Ud * I, 3), 3)} W`], tips: ['Der Regler sitzt in Reihe zur Last. Er muss die Spannung aufnehmen, die zwischen Eingang und Ausgang übrig bleibt, und wird dabei warm.', 'Durch den Regler fließt der Laststrom. So gehst du vor: 1. Eingangsspannung − Ausgangsspannung rechnen. 2. Mit dem Laststrom malnehmen. 3. Trage P_v in W ein.'] };
      return { text: kopf + ' Wie groß ist der Wirkungsgrad?', unit: '%', raw: Ua / Ue * 100, dec: 1, meta: { Ua, Ue, I, k }, steps: [`Abgegeben: P_ab = ${fmt(Ua)} V · ${fmt(I)} A = ${fmt(rd(Ua * I, 3), 3)} W`, `Aufgenommen: P_zu = ${Ue} V · ${fmt(I)} A = ${fmt(rd(Ue * I, 3), 3)} W`, `η = P_ab / P_zu = ${fmt(rd(Ua / Ue * 100, 2), 2)} %`], tips: ['Der Wirkungsgrad ist die abgegebene Leistung geteilt durch die aufgenommene. Eingang und Ausgang führen hier denselben Strom.', 'Weil der Strom gleich ist, genügt das Verhältnis der Spannungen. So gehst du vor: 1. P_ab = U_a · I. 2. P_zu = U_e · I. 3. P_ab durch P_zu teilen und mit 100 malnehmen. 4. Trage η in % ein.'] };
    }],
    [PT1, 3, 'Spannungsquelle: Innenwiderstand', R => {
      const U0 = pick(R, [1.5, 4.5, 9, 12]), Ri = pick(R, [0.2, 0.5, 1, 2]), I = pick(R, [0.2, 0.4, 0.5]), Uk = rd(U0 - Ri * I, 2), k = pick(R, ['Ri', 'Uk']);
      if (k === 'Ri') return { text: `Eine Batterie hat im Leerlauf ${fmt(U0)} V. Bei einem Laststrom von ${fmt(I)} A sinkt die Klemmenspannung auf ${fmt(Uk)} V. Wie groß ist der Innenwiderstand?`, unit: OHM, raw: (U0 - Uk) / I, dec: 2, meta: { U0, Ri, I, Uk, k }, steps: [`Spannung am Innenwiderstand: ${fmt(U0)} V − ${fmt(Uk)} V = ${fmt(rd(U0 - Uk, 3))} V`, `R_i = ${fmt(rd(U0 - Uk, 3))} V / ${fmt(I)} A = ${fmt(rd((U0 - Uk) / I, 3), 3)} Ω`], tips: ['Jede Spannungsquelle hat einen Innenwiderstand. Fließt Strom, fällt daran ein Teil der Spannung ab und fehlt an den Klemmen.', 'Der fehlende Teil der Spannung liegt am Innenwiderstand. So gehst du vor: 1. Leerlaufspannung − Klemmenspannung rechnen. 2. Durch den Laststrom teilen. 3. Trage R_i in Ω ein.'] };
      return { text: `Eine Batterie hat im Leerlauf ${fmt(U0)} V und einen Innenwiderstand von ${fmt(Ri)} Ω. Wie groß ist die Klemmenspannung bei einem Laststrom von ${fmt(I)} A?`, unit: 'V', raw: U0 - Ri * I, dec: 2, meta: { U0, Ri, I, Uk, k }, steps: [`Spannung am Innenwiderstand: ${fmt(Ri)} Ω · ${fmt(I)} A = ${fmt(rd(Ri * I, 3))} V`, `Klemmenspannung: ${fmt(U0)} V − ${fmt(rd(Ri * I, 3))} V = ${fmt(Uk)} V`], tips: ['Jede Spannungsquelle hat einen Innenwiderstand. Fließt Strom, fällt daran ein Teil der Spannung ab und fehlt an den Klemmen.', 'Berechne zuerst die Spannung am Innenwiderstand. So gehst du vor: 1. Innenwiderstand mal Laststrom rechnen. 2. Das Ergebnis von der Leerlaufspannung abziehen. 3. Trage die Klemmenspannung in V ein.'] };
    }],
    [PT1, 3, 'RC-Tiefpass: Grenzfrequenz', R => {
      const Rk = pick(R, [1, 2.2, 4.7, 10]), Cn = pick(R, [10, 22, 47, 100]), fg = 1 / (2 * Math.PI * Rk * 1000 * Cn * 1e-9);
      return { text: `Ein Tiefpass besteht aus R = ${fmt(Rk)} kΩ und C = ${Cn} nF. Wie groß ist die Grenzfrequenz?`, unit: 'Hz', raw: fg, dec: 0, meta: { Rk, Cn }, steps: [`Formel: f_g = 1 / (2 · π · R · C)`, `Einheiten: R = ${fmt(Rk * 1000)} Ω, C = ${Cn} nF = ${Cn} · 10⁻⁹ F`, `f_g = 1 / (2 · π · ${fmt(Rk * 1000)} Ω · ${Cn} · 10⁻⁹ F) = ${fmt(rd(fg, 1), 1)} Hz`], tips: ['Ein Tiefpass lässt tiefe Frequenzen durch und schwächt hohe ab. Bei der Grenzfrequenz ist die Ausgangsspannung auf rund 71 % gesunken.', 'f_g = 1 / (2 · π · R · C), mit R in Ω und C in F. So gehst du vor: 1. kΩ in Ω umrechnen (mal 1000). 2. nF in F umrechnen (mal 10⁻⁹). 3. 2 · π · R · C rechnen und den Kehrwert bilden. 4. Trage f_g in Hz ein.'] };
    }],
    /* ---------- Bruchrechnung (v62.180, mat71 bis mat79): Themen wie in den Tests der Lehrwerkstatt im 1. Lehrjahr, eigene Texte und Zahlen. Antwort als Bruch (bruch: [Zähler, Nenner]), Eingabe 5/8 oder 1 3/8. ---------- */
    [BR, 1, 'Bruch vollständig kürzen', R => {
      const [z0, n0] = pick(R, [[3, 4], [2, 3], [5, 8], [3, 5], [7, 12], [1, 8], [4, 9], [5, 6], [2, 7], [3, 10]]), f = pick(R, [2, 3, 4, 5, 6, 8, 12, 25]), Z = z0 * f, N = n0 * f;
      return { text: `Kürze den Bruch ${Z}/${N} so weit wie möglich.`, unit: '', bruch: [z0, n0], raw: z0 / n0, dec: 6, meta: { Z, N, f },
        steps: [`Größter gemeinsamer Teiler von ${Z} und ${N}: ${f}`, `Zähler und Nenner durch ${f} teilen: ${Z} : ${f} = ${z0} und ${N} : ${f} = ${n0}`, `${Z}/${N} = ${z0}/${n0}`],
        tips: ['Kürzen heißt: Zähler und Nenner durch dieselbe Zahl teilen. Der Wert des Bruchs bleibt gleich.', 'Suche eine Zahl, durch die sich Zähler und Nenner beide teilen lassen. So gehst du vor: 1. Gemeinsamen Teiler suchen (2, 3, 5 und so weiter). 2. Zähler und Nenner durch ihn teilen. 3. Wiederholen, bis es nicht mehr geht. 4. Trage den Bruch mit Schrägstrich ein, zum Beispiel 3/4.'] };
    }],
    [BR, 1, 'Bruch erweitern', R => {
      const [z0, n0] = pick(R, [[3, 7], [5, 8], [2, 3], [3, 4], [4, 5], [5, 6], [2, 9], [7, 10]]), f = pick(R, [2, 3, 4, 5, 6, 7]), k = pick(R, ['N', 'Z']), Z = z0 * f, N = n0 * f;
      const st = [`Erweiterungszahl: ${k === 'N' ? N + ' : ' + n0 : Z + ' : ' + z0} = ${f}`, `Zähler und Nenner mit ${f} malnehmen: ${z0} · ${f} = ${Z} und ${n0} · ${f} = ${N}`, `${z0}/${n0} = ${Z}/${N}`];
      const tips = ['Erweitern heißt: Zähler und Nenner mit derselben Zahl malnehmen. Der Wert des Bruchs bleibt gleich.', `Finde zuerst die Erweiterungszahl. So gehst du vor: 1. ${k === 'N' ? 'Neuen Nenner durch den alten Nenner teilen' : 'Neuen Zähler durch den alten Zähler teilen'}. 2. Mit dieser Zahl auch ${k === 'N' ? 'den Zähler' : 'den Nenner'} malnehmen. 3. Trage die Zahl ein.`];
      return k === 'N' ? { text: `Erweitere den Bruch ${z0}/${n0} auf den Nenner ${N}. Wie heißt der neue Zähler?`, unit: '', raw: Z, dec: 0, meta: { z0, n0, f, k }, steps: st, tips }
        : { text: `Erweitere den Bruch ${z0}/${n0} auf den Zähler ${Z}. Wie heißt der neue Nenner?`, unit: '', raw: N, dec: 0, meta: { z0, n0, f, k }, steps: st, tips };
    }],
    [BR, 2, 'Brüche addieren und subtrahieren', R => {
      let [a, b] = pick(R, BP), [c, d] = pick(R, BP.filter(x => x[1] !== b)); const op = pick(R, ['+', '−']);
      if (op === '−' && a * d < c * b) { [a, b, c, d] = [c, d, a, b]; }
      const H = b * d / ggt(b, d), za = a * H / b, zc = c * H / d, zr = op === '+' ? za + zc : za - zc, [z, n] = kz(zr, H);
      const st = [`Hauptnenner (kleinstes gemeinsames Vielfaches von ${b} und ${d}): ${H}`, `Erweitern: ${a}/${b} = ${za}/${H} und ${c}/${d} = ${zc}/${H}`, `Zähler ${op === '+' ? 'addieren' : 'abziehen'}: ${za} ${op} ${zc} = ${zr}, also ${zr}/${H}`].concat(bEnde(zr, H));
      return { text: `Berechne ${a}/${b} ${op} ${c}/${d}. Kürze das Ergebnis vollständig.`, unit: '', bruch: [z, n], raw: z / n, dec: 6, meta: { a, b, c, d, op }, steps: st,
        tips: ['Brüche mit verschiedenen Nennern kannst du nicht direkt zusammenzählen. Bringe sie zuerst auf denselben Nenner.', 'Der Hauptnenner ist die kleinste Zahl, in der beide Nenner aufgehen. So gehst du vor: 1. Hauptnenner suchen. 2. Beide Brüche auf den Hauptnenner erweitern. 3. Nur die Zähler verrechnen, der Nenner bleibt. 4. Ergebnis kürzen. 5. Trage den Bruch ein, zum Beispiel 5/8 oder 1 3/8.'] };
    }],
    [BR, 3, 'Gemischte Zahlen addieren und subtrahieren', R => {
      const [a, b] = pick(R, BP), [c, d] = pick(R, BP.filter(x => x[1] !== b)), op = pick(R, ['+', '−']), g2 = ri(R, 1, 2), g1 = op === '−' ? g2 + ri(R, 1, 2) : ri(R, 1, 3);
      const u1 = g1 * b + a, u2 = g2 * d + c, H = b * d / ggt(b, d), za = u1 * H / b, zc = u2 * H / d, zr = op === '+' ? za + zc : za - zc, [z, n] = kz(zr, H);
      const st = [`In unechte Brüche umwandeln: ${g1} ${a}/${b} = ${u1}/${b} und ${g2} ${c}/${d} = ${u2}/${d}`, `Hauptnenner von ${b} und ${d}: ${H}`, `Erweitern: ${u1}/${b} = ${za}/${H} und ${u2}/${d} = ${zc}/${H}`, `Zähler ${op === '+' ? 'addieren' : 'abziehen'}: ${za} ${op} ${zc} = ${zr}, also ${zr}/${H}`].concat(bEnde(zr, H));
      return { text: `Berechne ${g1} ${a}/${b} ${op} ${g2} ${c}/${d}. Kürze das Ergebnis vollständig.`, unit: '', bruch: [z, n], raw: z / n, dec: 6, meta: { g1, a, b, g2, c, d, op }, steps: st,
        tips: ['Eine gemischte Zahl besteht aus einer ganzen Zahl und einem Bruch. Wandle sie zuerst in einen unechten Bruch um: ganze Zahl mal Nenner plus Zähler.', 'Danach rechnest du wie mit normalen Brüchen. So gehst du vor: 1. Beide gemischten Zahlen in unechte Brüche umwandeln. 2. Hauptnenner suchen und erweitern. 3. Zähler verrechnen. 4. Kürzen. 5. Trage das Ergebnis ein, zum Beispiel 11/8 oder 1 3/8.'] };
    }],
    [BR, 2, 'Brüche multiplizieren', R => {
      const [a, b] = pick(R, BP), [c, d] = pick(R, [[3, 8], [4, 9], [2, 3], [3, 4], [5, 6], [3, 10], [4, 5], [2, 7], [9, 10]]), g = pick(R, [0, 0, 1, 2]), u = g * b + a, [z, n] = kz(u * c, b * d);
      const st = (g ? [`Gemischte Zahl umwandeln: ${g} ${a}/${b} = ${u}/${b}`] : []).concat([`Zähler mal Zähler und Nenner mal Nenner: ${u} · ${c} = ${u * c} und ${b} · ${d} = ${b * d}`, `Also ${u * c}/${b * d}`], bEnde(u * c, b * d));
      return { text: `Berechne ${g ? g + ' ' : ''}${a}/${b} · ${c}/${d}. Kürze das Ergebnis vollständig.`, unit: '', bruch: [z, n], raw: z / n, dec: 6, meta: { g, a, b, c, d }, steps: st,
        tips: ['Beim Malnehmen brauchst du keinen Hauptnenner. Zähler mal Zähler, Nenner mal Nenner.', `Du darfst vor dem Rechnen über Kreuz kürzen, das macht die Zahlen kleiner. So gehst du vor: 1. ${g ? 'Gemischte Zahl in einen unechten Bruch umwandeln. 2. ' : ''}Zähler mal Zähler rechnen. ${g ? 3 : 2}. Nenner mal Nenner rechnen. ${g ? 4 : 3}. Ergebnis kürzen. ${g ? 5 : 4}. Trage den Bruch ein.`] };
    }],
    [BR, 2, 'Brüche dividieren', R => {
      const [a, b] = pick(R, [[7, 10], [3, 4], [2, 3], [5, 8], [4, 9], [5, 6], [3, 5], [9, 10]]), [c, d] = pick(R, [[14, 15], [3, 8], [5, 6], [2, 5], [4, 7], [9, 20], [1, 4], [5, 12]]), [z, n] = kz(a * d, b * c);
      const st = ['Durch einen Bruch teilen heißt: mit dem Kehrwert malnehmen.', `${a}/${b} : ${c}/${d} = ${a}/${b} · ${d}/${c}`, `Zähler mal Zähler und Nenner mal Nenner: ${a} · ${d} = ${a * d} und ${b} · ${c} = ${b * c}, also ${a * d}/${b * c}`].concat(bEnde(a * d, b * c));
      return { text: `Berechne ${a}/${b} : ${c}/${d}. Kürze das Ergebnis vollständig.`, unit: '', bruch: [z, n], raw: z / n, dec: 6, meta: { a, b, c, d }, steps: st,
        tips: ['Durch einen Bruch teilst du, indem du mit seinem Kehrwert malnimmst. Der Kehrwert vertauscht Zähler und Nenner.', 'Nur der zweite Bruch wird umgedreht. So gehst du vor: 1. Kehrwert des zweiten Bruchs bilden. 2. Aus dem Geteilt ein Mal machen. 3. Zähler mal Zähler, Nenner mal Nenner. 4. Kürzen. 5. Trage den Bruch ein.'] };
    }],
    [BR, 1, 'Bruch in Dezimalzahl umrechnen', R => {
      const [z, n] = pick(R, [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [5, 8], [7, 8], [3, 10], [7, 10], [9, 10], [1, 20], [7, 20], [11, 20], [3, 25], [9, 25], [3, 40]]);
      return { text: `Schreibe den Bruch ${z}/${n} als Dezimalzahl.`, unit: '', raw: z / n, dec: 3, meta: { z, n },
        steps: [`Der Bruchstrich bedeutet geteilt: ${z}/${n} = ${z} : ${n}`, `${z} : ${n} = ${fmt(z / n)}`],
        tips: ['Der Bruchstrich ist ein Geteilt-Zeichen. Teile den Zähler durch den Nenner.', 'Du kannst auch erst auf den Nenner 10, 100 oder 1000 erweitern. So gehst du vor: 1. Zähler durch Nenner teilen. 2. Bei Bedarf Nullen anhängen und weiter teilen. 3. Trage die Dezimalzahl mit Komma ein.'] };
    }],
    [BR, 2, 'Bruchteil einer Menge', R => {
      const [z, n] = pick(R, [[3, 4], [2, 3], [5, 6], [3, 8], [2, 5], [1, 4], [5, 12]]), L = pick(R, [12, 20, 24, 36, 40, 60, 120].filter(x => x % n === 0)), k = pick(R, ['v', 'r']), teil = L / n, v = z * teil;
      const st = [`1/${n} von ${L} m: ${L} m : ${n} = ${teil} m`, `${z}/${n} von ${L} m: ${z} · ${teil} m = ${v} m`].concat(k === 'r' ? [`Rest: ${L} m − ${v} m = ${L - v} m`] : []);
      return { text: `Auf einer Rolle sind ${L} m Litze. Für die Lötübungen werden ${z}/${n} davon verbraucht. ${k === 'v' ? 'Wie viele Meter werden verbraucht?' : 'Wie viele Meter bleiben übrig?'}`, unit: 'm', raw: k === 'v' ? v : L - v, dec: 0, meta: { z, n, L, k }, steps: st,
        tips: ['Der Nenner sagt, in wie viele gleiche Teile die Menge geteilt wird. Der Zähler sagt, wie viele dieser Teile gemeint sind.', `Rechne zuerst einen Teil aus. So gehst du vor: 1. Menge durch den Nenner teilen. 2. Ergebnis mit dem Zähler malnehmen. ${k === 'r' ? '3. Vom Ganzen abziehen. 4.' : '3.'} Trage die Meter ein.`] };
    }],
    [BR, 3, 'Werkstatt: Litze zuschneiden', R => {
      const [g, a, b] = pick(R, [[3, 1, 2], [4, 1, 2], [5, 1, 4], [2, 3, 4], [6, 1, 2], [3, 3, 4]]), [c, d] = pick(R, [[1, 4], [3, 8], [1, 8], [5, 8]]), tot = g + a / b, k = pick(R, [4, 5, 6, 8].filter(x => x * c / d < tot - 0.01)) || 2;
      const u = g * b + a, zt = u * 8 / b, zs = k * c * 8 / d, zr = zt - zs, [z, n] = kz(zr, 8), [sz, sn] = kz(k * c, d);
      const st = [`Abgeschnitten: ${k} · ${c}/${d} m = ${k * c}/${d} m${sn !== d ? ' = ' + bt(sz, sn) + ' m' : ''}`, `Rolle als unechter Bruch: ${g} ${a}/${b} m = ${u}/${b} m`, `Beides in Achteln: ${zt}/8 m − ${zs}/8 m = ${zr}/8 m`].concat(bEnde(zr, 8));
      return { text: `Auf einer Rolle sind ${g} ${a}/${b} m Litze. Du schneidest ${k} Stücke mit je ${c}/${d} m ab. Wie viele Meter bleiben auf der Rolle? Gib das Ergebnis als gekürzten Bruch oder als gemischte Zahl an.`, unit: 'm', bruch: [z, n], raw: z / n, dec: 6, meta: { g, a, b, c, d, k }, steps: st,
        tips: ['Rechne zuerst aus, wie viel du insgesamt abschneidest. Das ziehst du von der Rolle ab.', 'Bringe alles auf denselben Nenner. So gehst du vor: 1. Anzahl der Stücke mal Länge eines Stücks. 2. Die gemischte Zahl der Rolle in einen unechten Bruch umwandeln. 3. Beide Brüche auf denselben Nenner bringen. 4. Abziehen und kürzen. 5. Trage den Bruch ein, zum Beispiel 9/4 oder 2 1/4.'] };
    }],
    /* ---------- Klammern (v62.180, mat80 bis mat88): Klammern auflösen, ausklammern, binomische Formeln. Gefragt ist eine Zahl aus dem Ergebnis (vor dem x, vor dem x² oder die einzelne Zahl), damit die Eingabe eine Zahl bleibt. ---------- */
    [KL, 1, 'Klammer ausmultiplizieren', R => {
      const f = pick(R, [2, 3, 4, 5, 6, -2, -3]), a = pick(R, [1, 2, 3, 4, 5]), b = pick(R, [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7]), k = pick(R, ['x', 'c']);
      return { text: `Löse die Klammer auf: ${mz(f)} · (${poly(0, a, b)}). ${frage(k)}`, unit: '', raw: k === 'x' ? f * a : f * b, dec: 0, meta: { f, a, b, k },
        steps: [`Jedes Glied in der Klammer mit ${mz(f)} malnehmen: ${kl(f)} · ${a === 1 ? '' : a}x = ${mz(f * a)}x und ${kl(f)} · ${kl(b)} = ${mz(f * b)}`, `Aufgelöst: ${poly(0, f * a, f * b)}`, `${k === 'x' ? 'Vor dem x' : 'Ohne x'} steht ${mz(k === 'x' ? f * a : f * b)}.`],
        tips: ['Die Zahl vor der Klammer wird mit jedem Glied in der Klammer malgenommen, nicht nur mit dem ersten.', 'Achte auf die Vorzeichen: Minus mal Minus ergibt Plus, Minus mal Plus ergibt Minus. So gehst du vor: 1. Zahl vor der Klammer mal das x-Glied. 2. Zahl vor der Klammer mal die einzelne Zahl. 3. Ergebnis ohne Klammer aufschreiben. 4. Trage die gefragte Zahl ein, bei Minus mit Vorzeichen.'] };
    }],
    [KL, 1, 'Minusklammer auflösen', R => {
      const p = ri(R, 4, 9), a = pick(R, [1, 2, 3, 4, 5].filter(x => x !== p)), b = pick(R, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]), q0 = ri(R, 1, 9), q = q0 === b ? q0 + 1 : q0, k = pick(R, ['x', 'c']);
      return { text: `Löse die Klammer auf und fasse zusammen: ${p}x − (${poly(0, a, b)}) + ${q}. ${frage(k)}`, unit: '', raw: k === 'x' ? p - a : q - b, dec: 0, meta: { p, a, b, q, k },
        steps: [`Ein Minus vor der Klammer dreht jedes Vorzeichen in der Klammer um: −(${poly(0, a, b)}) = ${poly(0, -a, -b)}`, `Ohne Klammer: ${p}x ${vz(-a, 'x')} ${vz(-b)} + ${q}`, `x-Glieder: ${p}x ${vz(-a, 'x')} = ${mz(p - a)}x. Zahlen: ${mz(-b)} + ${q} = ${mz(q - b)}`, `Aufgelöst: ${poly(0, p - a, q - b)}`],
        tips: ['Steht ein Minus vor der Klammer, ändert sich beim Auflösen jedes Vorzeichen in der Klammer.', 'Löse erst die Klammer auf, fasse dann zusammen. So gehst du vor: 1. Klammer weglassen und jedes Vorzeichen darin umdrehen. 2. Alle Glieder mit x zusammenfassen. 3. Alle einzelnen Zahlen zusammenfassen. 4. Trage die gefragte Zahl ein, bei Minus mit Vorzeichen.'] };
    }],
    [KL, 2, 'Zwei Klammern ausmultiplizieren', R => {
      const W = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7], p = pick(R, [1, 1, 2, 3]), a = pick(R, W), b = pick(R, W.filter(x => p * x + a !== 0)), k = pick(R, ['x', 'c']), B = p * b + a, K = a * b;
      return { text: `Multipliziere aus und fasse zusammen: (${poly(0, p, a)}) · (${poly(0, 1, b)}). ${frage(k)}`, unit: '', raw: k === 'x' ? B : K, dec: 0, meta: { p, a, b, k },
        steps: [`Jedes Glied der ersten Klammer mit jedem Glied der zweiten malnehmen: ${p === 1 ? '' : p}x · x = ${p === 1 ? '' : p}x², ${p === 1 ? '' : p}x · ${kl(b)} = ${mz(p * b)}x, ${kl(a)} · x = ${mz(a)}x, ${kl(a)} · ${kl(b)} = ${mz(K)}`, `x-Glieder zusammenfassen: ${mz(p * b)}x ${vz(a, 'x')} = ${mz(B)}x`, `Aufgelöst: ${poly(p, B, K)}`],
        tips: ['Jedes Glied der ersten Klammer wird mit jedem Glied der zweiten Klammer malgenommen. Das ergibt vier Produkte.', 'Schreib alle vier Produkte auf, bevor du zusammenfasst. So gehst du vor: 1. Erstes Glied mal beide Glieder der zweiten Klammer. 2. Zweites Glied mal beide Glieder der zweiten Klammer. 3. Die beiden Glieder mit x zusammenfassen. 4. Trage die gefragte Zahl ein, bei Minus mit Vorzeichen.'] };
    }],
    [KL, 2, 'Binomische Formel anwenden', R => {
      const a = pick(R, [1, 1, 2, 3, 4]), b = ri(R, 1, 7), s = pick(R, [1, -1]), k = pick(R, a > 1 ? ['x', 'c', 'x2'] : ['x', 'x', 'c']), A = a * a, B = 2 * a * b * s, K = b * b, ax = (a === 1 ? '' : a) + 'x';
      return { text: `Löse mit der binomischen Formel auf: (${poly(0, a, s * b)})². ${frage(k)}`, unit: '', raw: k === 'x' ? B : k === 'c' ? K : A, dec: 0, meta: { a, b, s, k },
        steps: [`Binomische Formel: (a ${s > 0 ? '+' : '−'} b)² = a² ${s > 0 ? '+' : '−'} 2ab + b²`, `Hier ist a = ${ax} und b = ${b}`, `a² = ${A === 1 ? '' : A}x², 2ab = 2 · ${ax} · ${b} = ${2 * a * b}x, b² = ${K}`, `Aufgelöst: ${poly(A, B, K)}`],
        tips: ['Eine Klammer hoch 2 heißt: die Klammer mal sich selbst. Dafür gibt es die binomischen Formeln, zum Beispiel (a + b)² = a² + 2ab + b².', 'Das mittlere Glied 2ab wird oft vergessen. So gehst du vor: 1. a und b in der Klammer bestimmen. 2. a² ausrechnen. 3. 2 · a · b ausrechnen, bei Minus in der Klammer mit Minus davor. 4. b² ausrechnen. 5. Trage die gefragte Zahl ein, bei Minus mit Vorzeichen.'] };
    }],
    [KL, 2, 'Klammern auflösen und zusammenfassen', R => {
      const g = ri(R, 2, 4), d = ri(R, 1, 3), f = pick(R, [2, 3, 4, 5, 6, 7].filter(x => x !== g * d)), b = ri(R, 1, 6), e = ri(R, 1, 5), k = pick(R, ['x', 'c']), X = f - g * d, K = -f * b - g * e;
      return { text: `Löse die Klammern auf und fasse zusammen: ${f}(${poly(0, 1, -b)}) − ${g}(${poly(0, d, e)}). ${frage(k)}`, unit: '', raw: k === 'x' ? X : K, dec: 0, meta: { f, b, g, d, e, k },
        steps: [`Erste Klammer: ${f} · x = ${f}x und ${f} · (−${b}) = −${f * b}`, `Zweite Klammer mit −${g}: −${g} · ${d === 1 ? '' : d}x = −${g * d}x und −${g} · ${e} = −${g * e}`, `Ohne Klammern: ${f}x − ${f * b} − ${g * d}x − ${g * e}`, `Aufgelöst: ${poly(0, X, K)}`],
        tips: ['Löse jede Klammer einzeln auf. Das Minus vor der zweiten Klammer gehört zur Zahl davor und wirkt auf jedes Glied.', 'Erst auflösen, dann sortieren. So gehst du vor: 1. Erste Klammer ausmultiplizieren. 2. Zweite Klammer mit der negativen Zahl ausmultiplizieren. 3. Glieder mit x zusammenfassen. 4. Einzelne Zahlen zusammenfassen. 5. Trage die gefragte Zahl ein, bei Minus mit Vorzeichen.'] };
    }],
    [KL, 1, 'Ausklammern: größte gemeinsame Zahl', R => {
      const g = pick(R, [2, 3, 4, 5, 6, 7, 8]), a = ri(R, 1, 5), b = pick(R, [1, 2, 3, 4, 5, 6, 7].filter(x => ggt(a, x) === 1)), s = pick(R, [1, -1]);
      return { text: `Klammere die größte gemeinsame Zahl aus: ${poly(0, g * a, s * g * b)}. Welche Zahl steht dann vor der Klammer?`, unit: '', raw: g, dec: 0, meta: { g, a, b, s },
        steps: [`Größte Zahl, durch die sich ${g * a} und ${g * b} beide teilen lassen: ${g}`, `${g * a}x : ${g} = ${a === 1 ? '' : a}x und ${g * b} : ${g} = ${b}`, `Ausgeklammert: ${g} · (${poly(0, a, s * b)})`, `Probe: Ausmultiplizieren ergibt wieder ${poly(0, g * a, s * g * b)}`],
        tips: ['Ausklammern ist das Gegenteil von Ausmultiplizieren. Du suchst eine Zahl, die in beiden Gliedern steckt.', 'Gesucht ist der größte gemeinsame Teiler der beiden Zahlen. So gehst du vor: 1. Teiler der ersten Zahl aufschreiben. 2. Teiler der zweiten Zahl aufschreiben. 3. Den größten gemeinsamen Teiler nehmen. 4. Probe: ausmultiplizieren. 5. Trage die Zahl vor der Klammer ein.'] };
    }],
    [KL, 3, 'Verschachtelte Klammern auflösen', R => {
      const p = ri(R, 3, 8), q = ri(R, 2, 6), r = pick(R, [1, 2, 3, 4, 5].filter(x => x !== q && p - q + x !== 0)), c = pick(R, [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]), k = pick(R, ['x', 'c']);
      return { text: `Löse von innen nach außen auf und fasse zusammen: ${p}x − [${q}x − (${poly(0, r, c)})]. ${frage(k)}`, unit: '', raw: k === 'x' ? p - q + r : c, dec: 0, meta: { p, q, r, c, k },
        steps: [`Innere Klammer zuerst, das Minus davor dreht die Vorzeichen um: ${q}x − (${poly(0, r, c)}) = ${q}x ${vz(-r, 'x')} ${vz(-c)} = ${poly(0, q - r, -c)}`, `Eckige Klammer, wieder steht ein Minus davor: ${p}x − [${poly(0, q - r, -c)}] = ${p}x ${vz(r - q, 'x')} ${vz(c)}`, `Aufgelöst: ${poly(0, p - q + r, c)}`],
        tips: ['Bei verschachtelten Klammern arbeitest du von innen nach außen. Jedes Minus vor einer Klammer dreht alle Vorzeichen darin um.', 'Zwei Minus hintereinander heben sich auf. So gehst du vor: 1. Runde Klammer auflösen (Vorzeichen umdrehen). 2. In der eckigen Klammer zusammenfassen. 3. Eckige Klammer auflösen (Vorzeichen wieder umdrehen). 4. Zusammenfassen. 5. Trage die gefragte Zahl ein, bei Minus mit Vorzeichen.'] };
    }],
    [KL, 3, 'Harte Nuss: Binom und zwei Klammern', R => {
      const a = ri(R, 2, 4), b = ri(R, 1, 4), c = pick(R, [2, 3, 4, 5].filter(x => x !== a)), d = ri(R, 1, 3), k = pick(R, ['x2', 'x', 'c']), A = a - c, B = -2 * a * b, K = a * b * b + c * d * d;
      return { text: `Löse auf und fasse zusammen: ${a}(${poly(0, 1, -b)})² − ${c}(${poly(0, 1, d)})(${poly(0, 1, -d)}). ${frage(k)}`, unit: '', raw: k === 'x2' ? A : k === 'x' ? B : K, dec: 0, meta: { a, b, c, d, k },
        steps: [`Binom: (${poly(0, 1, -b)})² = ${poly(1, -2 * b, b * b)}`, `Mal ${a}: ${poly(a, -2 * a * b, a * b * b)}`, `Dritte binomische Formel: (${poly(0, 1, d)})(${poly(0, 1, -d)}) = x² − ${d * d}`, `Mal −${c}: −${c}x² + ${c * d * d}`, `Zusammenfassen: ${a}x² − ${c}x² = ${mz(A)}x², ${mz(B)}x bleibt, ${a * b * b} + ${c * d * d} = ${K}`, `Aufgelöst: ${poly(A, B, K)}`],
        tips: ['Hier stecken zwei binomische Formeln: (a − b)² = a² − 2ab + b² und (a + b)(a − b) = a² − b². Löse beide Teile getrennt auf.', 'Die Zahl vor der Klammer wird erst nach dem Auflösen des Binoms verteilt. So gehst du vor: 1. Erstes Binom auflösen. 2. Mit der Zahl davor malnehmen. 3. Zweiten Teil mit der dritten binomischen Formel auflösen. 4. Mit der negativen Zahl davor malnehmen. 5. Gleiche Glieder zusammenfassen. 6. Trage die gefragte Zahl ein, bei Minus mit Vorzeichen.'] };
    }],
    [KL, 2, 'Praxis: Fläche einer Leiterplatte', R => {
      const a = ri(R, 2, 8), b = ri(R, 1, 5), x = pick(R, [8, 10, 12, 15, 20]), A = (x + a) * (x - b);
      return { text: `Eine Leiterplatte ist (x + ${a}) cm lang und (x − ${b}) cm breit. Stelle die Formel für die Fläche auf, multipliziere aus und berechne die Fläche für x = ${x}.`, unit: 'cm²', raw: A, dec: 0, meta: { a, b, x },
        steps: [`Fläche = Länge mal Breite: A = (x + ${a}) · (x − ${b})`, `Ausmultipliziert: A = ${poly(1, a - b, -a * b)}`, `x = ${x} einsetzen: ${x * x} ${vz((a - b) * x)} ${vz(-a * b)} = ${A}`, `Probe mit den Klammern: (${x} + ${a}) · (${x} − ${b}) = ${x + a} · ${x - b} = ${A}`],
        tips: ['Die Fläche eines Rechtecks ist Länge mal Breite. Hier sind Länge und Breite Klammern mit x.', 'Du kannst x gleich in die Klammern einsetzen oder erst ausmultiplizieren. Beides muss dasselbe ergeben. So gehst du vor: 1. A = Länge · Breite aufschreiben. 2. Klammern ausmultiplizieren und zusammenfassen. 3. Für x die Zahl einsetzen. 4. Probe mit den Klammern. 5. Trage die Fläche in cm² ein.'] };
    }],
    /* ===== Nachtrag zur 183: je zwei weitere Aufgaben pro Rubrik (mat89 bis mat106) ===== */
    ['Einheiten', 1, 'Zeit umrechnen: Stunden, Minuten, Sekunden', R => {
      const [v, f, t, fak, mal] = pick(R, [[90, 'min', 'h', 60, false], [45, 'min', 'h', 60, false], [150, 'min', 'h', 60, false], [36, 'min', 'h', 60, false], [1.25, 'h', 'min', 60, true], [0.4, 'h', 'min', 60, true], [2.5, 'h', 'min', 60, true], [2.5, 'min', 's', 60, true], [12, 'min', 's', 60, true], [210, 's', 'min', 60, false], [450, 's', 'min', 60, false], [0.5, 'h', 's', 3600, true], [5400, 's', 'h', 3600, false]]);
      const raw = rs(mal ? v * fak : v / fak);
      return { text: `Rechne ${fmt(v)} ${f} in ${t} um.`, unit: t, raw, dec: 6, meta: { v, f, t, fak, mal },
        steps: [`1 ${mal ? f : t} = ${fak} ${mal ? t : f}`, mal ? `In die kleinere Einheit wird malgenommen: ${fmt(v)} · ${fak} = ${fmt(raw)} ${t}` : `In die größere Einheit wird geteilt: ${fmt(v)} : ${fak} = ${fmt(raw)} ${t}`],
        tips: ['Eine Stunde hat 60 Minuten, eine Minute hat 60 Sekunden. Eine Stunde hat also 3600 Sekunden.', mal ? `Die Einheit wird kleiner, die Zahl wird größer: mal ${fak}.` : `Die Einheit wird größer, die Zahl wird kleiner: geteilt durch ${fak}.`] };
    }],
    ['Einheiten', 2, 'Kondensator: Vorsätze der Kapazität', R => {
      const [f, t, mal, werte] = pick(R, [['nF', MU + 'F', false, [4.7, 22, 68, 100, 330, 470]], [MU + 'F', 'nF', true, [0.1, 0.22, 0.33, 0.47, 1, 2.2, 4.7]], ['pF', 'nF', false, [22, 68, 100, 470, 2200, 4700]], ['nF', 'pF', true, [0.1, 0.47, 1, 1.5, 2.2, 4.7, 10]]]), v = pick(R, werte), raw = rs(mal ? v * 1000 : v / 1000);
      return { text: `Auf einem Kondensator steht ${fmt(v)} ${f}. Rechne den Wert in ${t} um.`, unit: t, raw, dec: 6, meta: { v, f, t, mal },
        steps: [`Reihenfolge der Vorsätze: 1 ${MU}F = 1000 nF und 1 nF = 1000 pF`, mal ? `In die kleinere Einheit wird malgenommen: ${fmt(v)} · 1000 = ${fmt(raw)} ${t}` : `In die größere Einheit wird geteilt: ${fmt(v)} : 1000 = ${fmt(raw)} ${t}`],
        tips: [`Zwischen ${MU}F, nF und pF liegt jeweils der Faktor 1000.`, mal ? 'Die Einheit wird kleiner, also mal 1000: Das Komma wandert drei Stellen nach rechts.' : 'Die Einheit wird größer, also geteilt durch 1000: Das Komma wandert drei Stellen nach links.'] };
    }],
    ['Dreisatz', 1, 'Dreisatz direkt: Lötzinn für Platinen', R => {
      const n1 = pick(R, [4, 5, 8, 10]), je = pick(R, [3, 4.5, 6, 7.5]), n2 = pick(R, [12, 15, 20, 25, 30]), m1 = rs(n1 * je), raw = rs(n2 * je);
      return { text: `Für ${n1} gleiche Platinen brauchst du ${fmt(m1)} g Lötzinn. Wie viel Lötzinn brauchst du für ${n2} Platinen?`, unit: 'g', raw, dec: 1, meta: { n1, je, n2, m1 },
        steps: [`${n1} Platinen brauchen ${fmt(m1)} g`, `1 Platine braucht ${fmt(m1)} g : ${n1} = ${fmt(je)} g`, `${n2} Platinen brauchen ${n2} · ${fmt(je)} g = ${fmt(raw)} g`],
        tips: ['Mehr Platinen brauchen mehr Lötzinn. Das ist ein direkter Dreisatz.', 'Rechne zuerst auf eine Platine herunter (teilen), dann auf die gesuchte Anzahl hoch (malnehmen).'] };
    }],
    ['Dreisatz', 2, 'Dreisatz indirekt: Arbeit im Team', R => {
      const a = pick(R, [2, 3, 4]), t = pick(R, [6, 8, 12]), b = pick(R, [2, 3, 4, 6, 8].filter(x => x !== a && (a * t * 2) % x === 0)), ges = a * t, raw = rs(ges / b);
      return { text: `${a} Auszubildende brauchen für das Bestücken einer Serie ${t} Stunden. Wie lange brauchen ${b} Auszubildende, wenn alle gleich schnell arbeiten?`, unit: 'h', raw, dec: 1, meta: { a, t, b },
        steps: [`${a} Auszubildende brauchen ${t} h`, `1 Auszubildender braucht ${a} · ${t} h = ${ges} h`, `${b} Auszubildende brauchen ${ges} h : ${b} = ${fmt(raw)} h`],
        tips: ['Mehr Leute brauchen weniger Zeit. Das ist ein indirekter Dreisatz.', 'Rechne zuerst aus, wie lange eine Person allein braucht (malnehmen). Teile dann durch die neue Anzahl.'] };
    }],
    ['Prozent', 1, 'Ausschuss: Wie viele Teile sind in Ordnung?', R => {
      const [G, p] = pick(R, [[200, 4], [200, 5], [200, 12], [250, 2], [250, 4], [250, 8], [400, 5], [400, 12], [500, 2], [500, 8], [800, 5], [800, 2]]), W = G * p / 100, raw = G - W;
      return { text: `Von ${G} gefertigten Baugruppen fallen ${p} % bei der Prüfung durch. Wie viele Baugruppen sind in Ordnung?`, unit: 'Stück', raw, dec: 0, meta: { G, p, W },
        steps: [`Ausschuss: W = G · p / 100 = ${G} · ${p} / 100 = ${W} Stück`, `In Ordnung: ${G} − ${W} = ${raw} Stück`, `Anderer Weg: ${100 - p} % von ${G} = ${raw} Stück`],
        tips: ['Rechne zuerst aus, wie viele Baugruppen Ausschuss sind (Prozentwert).', `Ziehe den Ausschuss von der Gesamtzahl ab. Oder rechne gleich mit ${100 - p} %.`] };
    }],
    ['Prozent', 2, 'Preiserhöhung in Prozent', R => {
      const a = pick(R, [40, 50, 80, 120, 250]), p = pick(R, [5, 8, 10, 12.5, 20]), n = rs(a * (1 + p / 100)), d = rs(n - a);
      return { text: `Eine Rolle Schaltdraht kostete bisher ${fmtMoney(a)} €. Jetzt kostet sie ${fmtMoney(n)} €. Um wie viel Prozent ist der Preis gestiegen?`, unit: '%', raw: p, dec: 1, meta: { a, n, p },
        steps: [`Erhöhung in Euro: ${fmtMoney(n)} € − ${fmtMoney(a)} € = ${fmtMoney(d)} €`, `Grundwert ist der alte Preis: p = ${fmtMoney(d)} / ${fmtMoney(a)} · 100 % = ${fmt(p)} %`],
        tips: ['Rechne zuerst aus, um wie viele Euro der Preis gestiegen ist.', 'Der alte Preis ist der Grundwert (100 %). Teile die Erhöhung durch den alten Preis und nimm mit 100 mal.'] };
    }],
    [BR, 1, 'Dezimalzahl als Bruch schreiben', R => {
      const [d, z, n, Z, N] = pick(R, [[0.25, 1, 4, 25, 100], [0.75, 3, 4, 75, 100], [0.2, 1, 5, 2, 10], [0.4, 2, 5, 4, 10], [0.6, 3, 5, 6, 10], [0.125, 1, 8, 125, 1000], [0.375, 3, 8, 375, 1000], [0.5, 1, 2, 5, 10], [0.05, 1, 20, 5, 100], [0.15, 3, 20, 15, 100], [0.8, 4, 5, 8, 10], [0.35, 7, 20, 35, 100]]), g = Z / z;
      return { text: `Schreibe die Dezimalzahl ${fmt(d)} als Bruch und kürze so weit wie möglich.`, unit: '', bruch: [z, n], raw: z / n, dec: 6, meta: { d, Z, N },
        steps: [`Stellen nach dem Komma zählen: ${fmt(d)} = ${Z}/${N}`, `Kürzen mit ${g}: ${Z} : ${g} = ${z} und ${N} : ${g} = ${n}`, `${fmt(d)} = ${z}/${n}`],
        tips: ['Eine Stelle nach dem Komma bedeutet Zehntel, zwei Stellen Hundertstel, drei Stellen Tausendstel.', 'So gehst du vor: 1. Zahl ohne Komma in den Zähler schreiben. 2. In den Nenner 10, 100 oder 1000 schreiben. 3. Vollständig kürzen. 4. Trage den Bruch mit Schrägstrich ein, zum Beispiel 3/4.'] };
    }],
    [BR, 2, 'Werkstatt: Zollmaß in Millimeter', R => {
      const [z, n] = pick(R, [[1, 4], [3, 8], [1, 2], [5, 8], [3, 4], [1, 8], [7, 8], [3, 16], [5, 16]]), raw = z / n * 25.4, teil = rs(25.4 / n);
      return { text: `Ein Bohrer hat den Durchmesser ${z}/${n} Zoll. Ein Zoll sind 25,4 mm. Wie groß ist der Durchmesser in Millimetern?`, unit: 'mm', raw, dec: 4, meta: { z, n },
        steps: [`1/${n} Zoll: 25,4 mm : ${n} = ${fmt(teil)} mm`, `${z}/${n} Zoll: ${z} · ${fmt(teil)} mm = ${fmt(rs(raw))} mm`],
        tips: ['Der Bruch sagt, welcher Teil von einem Zoll gemeint ist. Ein Zoll sind 25,4 mm.', 'Teile 25,4 mm durch den Nenner und nimm das Ergebnis mit dem Zähler mal.'] };
    }],
    [KL, 1, 'Zahlen rechnen: Klammer zuerst', R => {
      const a = ri(R, 2, 6), b = ri(R, 3, 9), c = ri(R, 2, 8), d = ri(R, 1, 9), s = b + c, raw = a * s - d;
      return { text: `Rechne aus: ${a} · (${b} + ${c}) − ${d}`, unit: '', raw, dec: 0, meta: { a, b, c, d },
        steps: [`Zuerst die Klammer: ${b} + ${c} = ${s}`, `Dann Punkt vor Strich: ${a} · ${s} = ${a * s}`, `Zum Schluss abziehen: ${a * s} − ${d} = ${raw}`],
        tips: ['Die Reihenfolge ist fest: zuerst die Klammer, dann Punktrechnung, dann Strichrechnung.', `Rechne nicht ${a} · ${b} allein. Die ${a} gilt für die ganze Klammer.`] };
    }],
    [KL, 2, 'Praxis: Spannung an zwei Widerständen in Reihe', R => {
      const I = pick(R, [2, 5, 10, 20]), R1 = pick(R, [100, 220, 330, 470]), R2 = pick(R, [150, 270, 390, 560]), s = R1 + R2, raw = rs(I / 1000 * s);
      return { text: `Durch zwei Widerstände in Reihe fließen ${I} mA. Die Widerstände haben R1 = ${R1} Ω und R2 = ${R2} Ω. Berechne die Gesamtspannung mit U = I · (R1 + R2).`, unit: 'V', raw, dec: 2, meta: { I, R1, R2 },
        steps: [`Strom in Ampere: ${I} mA = ${fmt(I / 1000)} A`, `Zuerst die Klammer: ${R1} Ω + ${R2} Ω = ${s} Ω`, `U = ${fmt(I / 1000)} A · ${s} Ω = ${fmt(raw)} V`, `Probe ohne Klammer: ${fmt(I / 1000)} · ${R1} + ${fmt(I / 1000)} · ${R2} = ${fmt(rs(I / 1000 * R1))} V + ${fmt(rs(I / 1000 * R2))} V = ${fmt(raw)} V`],
        tips: ['Rechne den Strom zuerst in Ampere um: 1000 mA = 1 A.', 'Zuerst die Klammer ausrechnen (beide Widerstände zusammenzählen), dann mit dem Strom malnehmen.'] };
    }],
    ['Umstellen', 1, 'Leistung: Strom bestimmen', R => {
      const U = pick(R, [5, 12, 24, 230]), I = pick(R, [0.2, 0.5, 1.5, 2, 4]), P = rs(U * I);
      return { text: `Ein Gerät nimmt an ${U} V eine Leistung von ${fmt(P)} W auf. Wie groß ist der Strom? Stelle P = U · I nach I um.`, unit: 'A', raw: I, dec: 2, meta: { U, I, P },
        steps: ['Formel: P = U · I   (gesucht: I)', 'Beide Seiten durch U teilen:   I = P / U', `I = ${fmt(P)} W / ${U} V = ${fmt(I)} A`, `Probe: ${U} V · ${fmt(I)} A = ${fmt(P)} W`],
        tips: ['Das I steht in einem Produkt mit U. Du bekommst es allein, indem du beide Seiten durch U teilst.', 'Umgestellt: I = P / U. Jetzt nur noch einsetzen und rechnen.'] };
    }],
    ['Umstellen', 2, 'Elektrische Arbeit: Betriebszeit bestimmen', R => {
      const P = pick(R, [40, 60, 150, 500, 2000]), t = pick(R, [1.5, 2, 4, 6, 8]), W = rs(P * t / 1000);
      return { text: `Ein Gerät mit ${P} W hat ${fmt(W)} kWh verbraucht. Wie lange war es eingeschaltet? Stelle W = P · t nach t um.`, unit: 'h', raw: t, dec: 2, meta: { P, t, W },
        steps: ['Formel: W = P · t   (gesucht: t)', 'Beide Seiten durch P teilen:   t = W / P', `Einheiten anpassen: ${fmt(W)} kWh = ${fmt(rs(W * 1000))} Wh`, `t = ${fmt(rs(W * 1000))} Wh / ${P} W = ${fmt(t)} h`],
        tips: ['Stelle zuerst nach t um: Das t bekommst du allein, indem du durch P teilst.', 'Achte auf die Einheiten: Rechne kWh in Wh um (mal 1000), bevor du durch die Leistung in Watt teilst.'] };
    }],
    ['Geometrie', 1, 'Rechteck: Fläche und Umfang einer Leiterplatte', R => {
      const l = pick(R, [50, 80, 100, 120, 160]), b = pick(R, [30, 40, 60, 75]), k = pick(R, ['A', 'U']), raw = k === 'A' ? l * b : 2 * (l + b);
      return { text: `Eine rechteckige Leiterplatte ist ${l} mm lang und ${b} mm breit. ${k === 'A' ? 'Wie groß ist ihre Fläche?' : 'Wie lang ist ihr Umfang?'}`, unit: k === 'A' ? 'mm²' : 'mm', raw, dec: 0, meta: { l, b, k },
        steps: k === 'A' ? ['Formel: A = l · b', `A = ${l} mm · ${b} mm = ${raw} mm²`] : ['Formel: U = 2 · (l + b)', `Zuerst die Klammer: ${l} mm + ${b} mm = ${l + b} mm`, `U = 2 · ${l + b} mm = ${raw} mm`],
        tips: [k === 'A' ? 'Die Fläche eines Rechtecks ist Länge mal Breite.' : 'Der Umfang ist der Weg einmal außen herum: zweimal die Länge und zweimal die Breite.', k === 'A' ? 'Achte auf die Einheit: Millimeter mal Millimeter ergibt Quadratmillimeter.' : 'Zähle Länge und Breite zusammen und nimm das Ergebnis mal 2.'] };
    }],
    ['Geometrie', 2, 'Quader: Volumen eines Gehäuses', R => {
      const l = pick(R, [8, 10, 12, 15, 20]), b = pick(R, [5, 6, 8, 10]), h = pick(R, [2.5, 3, 4, 5]), V = rs(l * b * h), raw = rs(V / 1000);
      return { text: `Ein Gehäuse ist innen ${l} cm lang, ${b} cm breit und ${fmt(h)} cm hoch. Wie viel Liter Vergussmasse passen hinein?`, unit: 'l', raw, dec: 4, meta: { l, b, h },
        steps: ['Formel: V = l · b · h', `V = ${l} cm · ${b} cm · ${fmt(h)} cm = ${fmt(V)} cm³`, `1 l = 1000 cm³: ${fmt(V)} cm³ : 1000 = ${fmt(raw)} l`],
        tips: ['Das Volumen eines Quaders ist Länge mal Breite mal Höhe.', 'Das Ergebnis hat die Einheit cm³. Ein Liter sind 1000 cm³, also durch 1000 teilen.'] };
    }],
    ['Messwerte', 1, 'Toleranz: Höchstmaß und Mindestmaß', R => {
      const N = pick(R, [12.5, 20, 25, 40, 63]), t = pick(R, [0.02, 0.05, 0.1, 0.2]), k = pick(R, ['max', 'min']), raw = rs(k === 'max' ? N + t : N - t);
      return { text: `Auf der Zeichnung steht das Maß ${fmt(N)} mm ± ${fmt(t)} mm. Wie groß ist das ${k === 'max' ? 'Höchstmaß' : 'Mindestmaß'}?`, unit: 'mm', raw, dec: 2, meta: { N, t, k },
        steps: [`${k === 'max' ? 'Höchstmaß = Nennmaß + Toleranz' : 'Mindestmaß = Nennmaß − Toleranz'}`, `${fmt(N)} mm ${k === 'max' ? '+' : '−'} ${fmt(t)} mm = ${fmt(raw)} mm`, `Alle Maße von ${fmt(rs(N - t))} mm bis ${fmt(rs(N + t))} mm sind in Ordnung.`],
        tips: ['Das Zeichen ± heißt: Das Maß darf um diesen Wert größer oder kleiner sein.', k === 'max' ? 'Für das Höchstmaß zählst du die Toleranz zum Nennmaß dazu.' : 'Für das Mindestmaß ziehst du die Toleranz vom Nennmaß ab.'] };
    }],
    ['Messwerte', 2, 'Abweichung vom Sollwert in Prozent', R => {
      const s = pick(R, [5, 12, 24, 10]), p = pick(R, [-5, -2.5, -2, 1, 2, 2.5, 5]), m = rs(s * (1 + p / 100)), d = rs(m - s);
      return { text: `Ein Netzteil soll ${s} V liefern. Du misst ${fmt(m)} V. Um wie viel Prozent weicht der Messwert vom Sollwert ab? Ist der Messwert kleiner als der Sollwert, hat das Ergebnis ein Minus.`, unit: '%', raw: p, dec: 1, meta: { s, m, p },
        steps: [`Abweichung: Messwert − Sollwert = ${fmt(m)} V − ${s} V = ${mz(d).replace('.', ',')} V`, `Bezogen auf den Sollwert: ${mz(d).replace('.', ',')} V / ${s} V · 100 % = ${mz(p).replace('.', ',')} %`],
        tips: ['Rechne zuerst die Abweichung in Volt aus: Messwert minus Sollwert.', 'Der Sollwert ist der Grundwert (100 %). Teile die Abweichung durch den Sollwert und nimm mit 100 mal.'] };
    }],
    [PT1, 1, 'Transistor: Stromverstärkung', R => {
      const Ib = pick(R, [20, 50, 100, 200]), B = pick(R, [100, 150, 200, 250]), Ic = rs(Ib * B / 1000), k = pick(R, ['Ic', 'B']);
      return k === 'Ic'
        ? { text: `Ein Transistor hat die Stromverstärkung B = ${B}. In die Basis fließen ${Ib} ${MU}A. Wie groß ist der Kollektorstrom?`, unit: 'mA', raw: Ic, dec: 1, meta: { k, Ib, B, Ic },
          steps: ['Formel: I_C = B · I_B', `I_C = ${B} · ${Ib} ${MU}A = ${Ib * B} ${MU}A`, `In Milliampere: ${Ib * B} ${MU}A : 1000 = ${fmt(Ic)} mA`],
          tips: ['Der Kollektorstrom ist um die Stromverstärkung B größer als der Basisstrom.', `Nimm den Basisstrom mit B mal. Rechne am Ende von ${MU}A in mA um (durch 1000).`] }
        : { text: `Bei einem Transistor fließen ${Ib} ${MU}A in die Basis und ${fmt(Ic)} mA in den Kollektor. Wie groß ist die Stromverstärkung B?`, unit: '', label: 'Stromverstärkung B', raw: B, dec: 0, meta: { k, Ib, B, Ic },
          steps: ['Formel: B = I_C / I_B', `Gleiche Einheit: ${fmt(Ic)} mA = ${Ib * B} ${MU}A`, `B = ${Ib * B} ${MU}A / ${Ib} ${MU}A = ${B}`],
          tips: ['Die Stromverstärkung sagt, wie viel mal größer der Kollektorstrom als der Basisstrom ist.', `Bringe beide Ströme auf dieselbe Einheit (1 mA = 1000 ${MU}A), dann teile Kollektorstrom durch Basisstrom.`] };
    }],
    [PT1, 2, 'Kondensatoren: parallel und in Reihe', R => {
      const [C1, C2] = pick(R, [[100, 100], [220, 220], [100, 150], [47, 47], [330, 220], [100, 400], [150, 300], [220, 330], [470, 470]]), k = pick(R, ['par', 'ser']), raw = k === 'par' ? C1 + C2 : C1 * C2 / (C1 + C2);
      return { text: `Zwei Kondensatoren mit C1 = ${C1} nF und C2 = ${C2} nF sind ${k === 'par' ? 'parallel' : 'in Reihe'} geschaltet. Wie groß ist die Gesamtkapazität?`, unit: 'nF', raw, dec: 1, meta: { k, C1, C2 },
        steps: k === 'par' ? ['Parallelschaltung: Die Kapazitäten addieren sich.', `C = C1 + C2 = ${C1} nF + ${C2} nF = ${raw} nF`] : ['Reihenschaltung: C = C1 · C2 / (C1 + C2)', `C = ${C1} · ${C2} / (${C1} + ${C2}) nF = ${C1 * C2} / ${C1 + C2} nF = ${fmt(rd(raw, 1))} nF`, 'Die Gesamtkapazität ist kleiner als die kleinste Einzelkapazität.'],
        tips: ['Bei Kondensatoren ist es umgekehrt wie bei Widerständen: Parallel wird die Kapazität größer, in Reihe wird sie kleiner.', k === 'par' ? 'Parallel: einfach zusammenzählen.' : 'In Reihe bei zwei Kondensatoren: Produkt geteilt durch Summe.'] };
        }],
    /* ===== v62.184: Rubrik Elektrotechnik (mat107 bis mat124): Wechselstrom, Drehstrom, Messen und Prüfen, Bauteilauslegung ===== */
    ['Elektrotechnik', 2, 'Spannungsteiler mit Last', R => {
      const U = pick(R, [10, 12, 24]), R1 = pick(R, [1, 2.2, 4.7, 10]), R2 = pick(R, [1, 2.2, 4.7, 10]), RL = pick(R, [10, 22, 47]), Rp = R2 * RL / (R2 + RL), raw = U * Rp / (R1 + Rp);
      return { text: `Ein Spannungsteiler aus R1 = ${fmt(R1)} kΩ (oben) und R2 = ${fmt(R2)} kΩ (unten) liegt an ${U} V. Parallel zu R2 hängt eine Last mit ${RL} kΩ. Wie groß ist die Spannung an der Last?`, unit: 'V', raw, dec: 2, meta: { U, R1, R2, RL },
        steps: [`Last und R2 liegen parallel: R2L = R2 · RL / (R2 + RL) = ${fmt(R2)} kΩ · ${RL} kΩ / (${fmt(R2)} kΩ + ${RL} kΩ) = ${fmt(rd(Rp, 3))} kΩ`, `Teilerformel: U2 = U · R2L / (R1 + R2L) = ${U} V · ${fmt(rd(Rp, 3))} kΩ / (${fmt(R1)} kΩ + ${fmt(rd(Rp, 3))} kΩ) = ${fmt(rd(raw, 3))} V`, `Ohne Last wären es ${fmt(rd(U * R2 / (R1 + R2), 2))} V. Die Last zieht die Spannung herunter.`],
        tips: ['Die Last liegt parallel zu R2. Dadurch wird der untere Widerstand kleiner und die Spannung sinkt.', 'So gehst du vor: 1. R2 und RL zu einem Widerstand zusammenfassen (parallel). 2. Mit diesem Wert die Teilerformel U2 = U · R2L / (R1 + R2L) rechnen.'] };
    }],
    ['Elektrotechnik', 3, 'Brückenschaltung: Brückenspannung', R => {
      const U = pick(R, [10, 12, 24]), W = [100, 220, 330, 470, 680, 1000], R1 = pick(R, W), R2 = pick(R, W), R3 = pick(R, W), R4 = pick(R, W.filter(x => x * R1 !== R2 * R3)), UA = U * R2 / (R1 + R2), UB = U * R4 / (R3 + R4), raw = Math.abs(UA - UB);
      return { text: `Eine Brücke liegt an ${U} V. Linker Zweig: R1 = ${R1} Ω oben, R2 = ${R2} Ω unten, dazwischen Punkt A. Rechter Zweig: R3 = ${R3} Ω oben, R4 = ${R4} Ω unten, dazwischen Punkt B. Wie groß ist der Betrag der Spannung zwischen A und B?`, unit: 'V', raw, dec: 3, meta: { U, R1, R2, R3, R4 },
        steps: [`Punkt A gegen Masse: UA = U · R2 / (R1 + R2) = ${U} V · ${R2} Ω / ${R1 + R2} Ω = ${fmt(rd(UA, 3))} V`, `Punkt B gegen Masse: UB = U · R4 / (R3 + R4) = ${U} V · ${R4} Ω / ${R3 + R4} Ω = ${fmt(rd(UB, 3))} V`, `Brückenspannung: Betrag von UA − UB = ${fmt(rd(raw, 3))} V`],
        tips: ['Eine Brücke besteht aus zwei Spannungsteilern an derselben Spannung. Die Brückenspannung ist der Unterschied der beiden Teilspannungen.', 'So gehst du vor: 1. UA aus dem linken Teiler. 2. UB aus dem rechten Teiler. 3. Die kleinere von der größeren Spannung abziehen.'] };
    }],
    ['Elektrotechnik', 2, 'Kondensator an Wechselspannung: Blindwiderstand', R => {
      const f = pick(R, [50, 100, 400, 1000]), Cu = pick(R, [1, 2.2, 4.7, 10, 22, 47]), raw = 1 / (2 * Math.PI * f * Cu * 1e-6);
      return { text: `Ein Kondensator mit ${fmt(Cu)} ${MU}F liegt an einer Wechselspannung mit ${f} Hz. Wie groß ist sein Blindwiderstand?`, unit: OHM, raw, dec: 1, meta: { f, Cu },
        steps: ['Formel: XC = 1 / (2 · π · f · C)', `Einheit: C = ${fmt(Cu)} ${MU}F = ${fmt(Cu)} · 10⁻⁶ F`, `XC = 1 / (2 · π · ${f} Hz · ${fmt(Cu)} · 10⁻⁶ F) = ${fmt(rd(raw, 2))} ${OHM}`],
        tips: ['Je höher die Frequenz und je größer der Kondensator, desto kleiner ist sein Blindwiderstand.', `XC = 1 / (2 · π · f · C), mit C in Farad. 1 ${MU}F sind 10⁻⁶ F.`] };
    }],
    ['Elektrotechnik', 2, 'Spule an Wechselspannung: Blindwiderstand', R => {
      const f = pick(R, [50, 100, 400, 1000]), L = pick(R, [10, 22, 47, 100, 220]), raw = 2 * Math.PI * f * L / 1000;
      return { text: `Eine Spule mit ${L} mH liegt an einer Wechselspannung mit ${f} Hz. Der Drahtwiderstand wird vernachlässigt. Wie groß ist ihr Blindwiderstand?`, unit: OHM, raw, dec: 1, meta: { f, L },
        steps: ['Formel: XL = 2 · π · f · L', `Einheit: L = ${L} mH = ${fmt(L / 1000)} H`, `XL = 2 · π · ${f} Hz · ${fmt(L / 1000)} H = ${fmt(rd(raw, 2))} ${OHM}`],
        tips: ['Je höher die Frequenz und je größer die Induktivität, desto größer ist der Blindwiderstand der Spule.', 'XL = 2 · π · f · L, mit L in Henry. 1 mH sind 0,001 H.'] };
    }],
    ['Elektrotechnik', 3, 'Reihenschaltung R und C: Scheinwiderstand', R => {
      const [Rw, X] = pick(R, [[30, 40], [60, 80], [80, 60], [120, 90], [150, 200], [100, 100], [220, 150], [47, 68], [330, 470]]), raw = Math.sqrt(Rw * Rw + X * X);
      return { text: `Ein Widerstand mit ${Rw} Ω liegt in Reihe mit einem Kondensator, der bei der Betriebsfrequenz einen Blindwiderstand von ${X} Ω hat. Wie groß ist der Scheinwiderstand der Schaltung?`, unit: OHM, raw, dec: 1, meta: { Rw, X },
        steps: ['Wirk- und Blindwiderstand stehen im Zeigerbild senkrecht aufeinander: Z = √(R² + XC²)', `Z = √((${Rw} Ω)² + (${X} Ω)²) = √(${Rw * Rw + X * X} Ω²) = ${fmt(rd(raw, 2))} ${OHM}`],
        tips: ['Wirkwiderstand und Blindwiderstand darfst du nicht einfach zusammenzählen. Beide bilden ein rechtwinkliges Dreieck.', 'Rechne wie beim Satz des Pythagoras: Z = √(R² + XC²).'] };
    }],
    ['Elektrotechnik', 2, 'Wechselstrom: Wirkleistung mit cos φ', R => {
      const U = 230, I = pick(R, [2, 3.5, 5, 8, 12]), c = pick(R, [0.6, 0.7, 0.8, 0.85, 0.9]), raw = U * I * c;
      return { text: `Ein Motor nimmt an ${U} V einen Strom von ${fmt(I)} A auf. Der Leistungsfaktor ist cos φ = ${fmt(c)}. Wie groß ist die Wirkleistung?`, unit: 'W', raw, dec: 1, meta: { U, I, c },
        steps: ['Formel: P = U · I · cos φ', `Scheinleistung: S = U · I = ${U} V · ${fmt(I)} A = ${fmt(rs(U * I))} VA`, `Wirkleistung: P = ${fmt(rs(U * I))} VA · ${fmt(c)} = ${fmt(rd(raw, 1))} W`],
        tips: ['Bei Motoren ist nur ein Teil der Scheinleistung Wirkleistung. Der Leistungsfaktor cos φ sagt, wie groß dieser Teil ist.', 'P = U · I · cos φ.'] };
    }],
    ['Elektrotechnik', 2, 'Drehstrom: Leistung eines Motors', R => {
      const U = 400, I = pick(R, [4, 6.3, 10, 16, 25]), c = pick(R, [0.8, 0.85, 0.9]), raw = Math.sqrt(3) * U * I * c / 1000;
      return { text: `Ein Drehstrommotor (symmetrische Last) liegt an ${U} V (Leiterspannung) und nimmt je Außenleiter ${fmt(I)} A auf. Der Leistungsfaktor ist cos φ = ${fmt(c)}. Wie groß ist die aufgenommene Wirkleistung?`, unit: 'kW', raw, dec: 2, meta: { U, I, c },
        steps: ['Formel für symmetrische Last: P = √3 · U · I · cos φ', `P = 1,732 · ${U} V · ${fmt(I)} A · ${fmt(c)} = ${fmt(rd(raw * 1000, 0))} W`, `In Kilowatt: ${fmt(rd(raw * 1000, 0))} W : 1000 = ${fmt(rd(raw, 3))} kW`],
        tips: ['Bei Drehstrom kommt der Faktor √3 (rund 1,732) dazu. U ist die Spannung zwischen zwei Außenleitern, I der Strom in einem Außenleiter.', 'P = √3 · U · I · cos φ. Das Ergebnis in W teilst du durch 1000.'] };
    }],
    ['Elektrotechnik', 2, 'Stern und Dreieck: Strangwerte', R => {
      const k = pick(R, ['U', 'I']), U = pick(R, [400, 690, 230]), Is = pick(R, [5, 8, 12, 20]), w3 = Math.sqrt(3);
      if (k === 'U') return { text: `Ein symmetrischer Verbraucher ist im Stern an ein Drehstromnetz mit ${U} V Leiterspannung angeschlossen. Welche Spannung liegt an einem Strang?`, unit: 'V', raw: U / w3, dec: 0, meta: { k, U, Is },
        steps: ['Sternschaltung: Jeder Strang liegt zwischen Außenleiter und Sternpunkt.', `Strangspannung: U_Str = U / √3 = ${U} V / 1,732 = ${fmt(rd(U / w3, 1))} V`],
        tips: ['Im Stern ist die Strangspannung kleiner als die Leiterspannung, der Strangstrom ist gleich dem Leiterstrom.', 'U_Str = U / √3, mit √3 rund 1,732.'] };
      return { text: `Ein symmetrischer Verbraucher ist im Dreieck an ein Drehstromnetz angeschlossen. In jedem Strang fließen ${Is} A. Wie groß ist der Strom in einem Außenleiter?`, unit: 'A', raw: Is * w3, dec: 1, meta: { k, U, Is },
        steps: ['Dreieckschaltung: Jeder Strang liegt zwischen zwei Außenleitern. An jedem Außenleiter treffen sich zwei Stränge.', `Leiterstrom: I = √3 · I_Str = 1,732 · ${Is} A = ${fmt(rd(Is * w3, 2))} A`],
        tips: ['Im Dreieck ist die Strangspannung gleich der Leiterspannung, der Leiterstrom ist größer als der Strangstrom.', 'I = √3 · I_Str, mit √3 rund 1,732.'] };
    }],
    ['Elektrotechnik', 3, 'Blindleistung kompensieren', R => {
      const P = pick(R, [4, 6, 10, 15, 22]), c1 = pick(R, [0.6, 0.7, 0.75]), c2 = pick(R, [0.9, 0.95]), t1 = Math.tan(Math.acos(c1)), t2 = Math.tan(Math.acos(c2)), raw = P * (t1 - t2);
      return { text: `Eine Anlage mit induktiver Last nimmt ${P} kW Wirkleistung bei cos φ = ${fmt(c1)} auf. Der Leistungsfaktor soll auf ${fmt(c2)} verbessert werden. Welche Blindleistung müssen die Kondensatoren liefern?`, unit: 'kvar', raw, dec: 2, meta: { P, c1, c2 },
        steps: ['Formel: QC = P · (tan φ1 − tan φ2)', `Aus cos φ1 = ${fmt(c1)} folgt tan φ1 = ${fmt(rd(t1, 4))}. Aus cos φ2 = ${fmt(c2)} folgt tan φ2 = ${fmt(rd(t2, 4))}.`, `QC = ${P} kW · (${fmt(rd(t1, 4))} − ${fmt(rd(t2, 4))}) = ${fmt(rd(raw, 3))} kvar`],
        tips: ['Die Wirkleistung bleibt gleich. Die Kondensatoren nehmen der Anlage einen Teil der induktiven Blindleistung ab.', 'So gehst du vor: 1. Aus jedem cos φ den Winkel bestimmen (cos⁻¹) und davon den tan. 2. QC = P · (tan φ1 − tan φ2).'] };
    }],
    ['Elektrotechnik', 3, 'Messfehler durch den Innenwiderstand des Messgeräts', R => {
      const U = pick(R, [10, 12, 24]), R1 = pick(R, [100, 220, 470, 1000]), R2 = pick(R, [100, 220, 470, 1000]), Ri = pick(R, [1, 10]), Rp = R2 * Ri * 1000 / (R2 + Ri * 1000), raw = U * Rp / (R1 + Rp);
      return { text: `Ein Spannungsteiler aus R1 = ${R1} kΩ und R2 = ${R2} kΩ liegt an ${U} V. Ein Spannungsmesser mit ${Ri} MΩ Innenwiderstand misst an R2. Welche Spannung zeigt er an?`, unit: 'V', raw, dec: 2, meta: { U, R1, R2, Ri },
        steps: [`Das Messgerät liegt parallel zu R2: R2M = R2 · Ri / (R2 + Ri) = ${R2} kΩ · ${Ri * 1000} kΩ / (${R2} kΩ + ${Ri * 1000} kΩ) = ${fmt(rd(Rp, 2))} kΩ`, `Anzeige: U2 = U · R2M / (R1 + R2M) = ${U} V · ${fmt(rd(Rp, 2))} kΩ / (${R1} kΩ + ${fmt(rd(Rp, 2))} kΩ) = ${fmt(rd(raw, 3))} V`, `Ohne Messgerät liegen an R2 genau ${fmt(rd(U * R2 / (R1 + R2), 3))} V. Das Messgerät belastet die Schaltung und zeigt deshalb zu wenig an.`],
        tips: ['Ein Spannungsmesser ist selbst ein Widerstand. Er liegt parallel zur Messstelle und wirkt wie eine zusätzliche Last.', 'So gehst du vor: 1. R2 und Ri parallel zusammenfassen (Ri in kΩ umrechnen). 2. Teilerformel mit dem neuen Wert.'] };
    }],
    ['Elektrotechnik', 2, 'Fehlerschleife: Kurzschlussstrom', R => {
      const U = 230, Z = pick(R, [0.4, 0.5, 0.8, 1.15, 1.5, 2, 2.3]), raw = U / Z;
      return { text: `An einer Steckdose wird eine Schleifenimpedanz von ${fmt(Z)} Ω gemessen. Die Spannung gegen Erde beträgt ${U} V. Welcher Strom fließt bei einem Körperschluss?`, unit: 'A', raw, dec: 1, meta: { U, Z },
        steps: ['Formel: Ik = U0 / Zs', `Ik = ${U} V / ${fmt(Z)} Ω = ${fmt(rd(raw, 1))} A`, 'Dieser Strom muss größer sein als der Strom, bei dem die Sicherung schnell genug abschaltet (Abschaltbedingung).'],
        tips: ['Die Fehlerschleife ist der ganze Weg des Fehlerstroms: Trafo, Außenleiter, Fehlerstelle, Schutzleiter und zurück.', 'Es gilt das ohmsche Gesetz: Ik = U0 / Zs.'] };
    }],
    ['Elektrotechnik', 1, 'Geräteprüfung: Schutzleiterwiderstand', R => {
      const I = 200, Um = pick(R, [16, 24, 36, 50, 64, 90, 120]), raw = Um / I;
      return { text: `Bei der Prüfung eines Geräts fließt ein Prüfstrom von ${I} mA durch den Schutzleiter. Dabei fallen ${Um} mV ab. Wie groß ist der Schutzleiterwiderstand?`, unit: OHM, raw, dec: 2, meta: { I, Um },
        steps: ['Formel: R = U / I', `R = ${Um} mV / ${I} mA = ${fmt(rd(raw, 3))} ${OHM}`, 'Richtwert bei Anschlussleitungen bis 5 m Länge: höchstens 0,3 Ω.'],
        tips: ['Der Schutzleiter soll einen Fehlerstrom gut ableiten. Dafür muss sein Widerstand klein sein.', 'R = U / I. Millivolt durch Milliampere ergibt direkt Ohm.'] };
    }],
    ['Elektrotechnik', 2, 'Isolationsprüfung: Strom durch die Isolation', R => {
      const U = pick(R, [250, 500]), Ri = pick(R, [1, 2, 5, 10, 25, 50]), raw = U / Ri;
      return { text: `Bei einer Isolationsmessung mit ${U} V Prüfspannung zeigt das Gerät ${Ri} MΩ an. Welcher Strom fließt dabei durch die Isolation?`, unit: MU + 'A', raw, dec: 0, meta: { U, Ri },
        steps: ['Formel: I = U / R', `I = ${U} V / ${Ri} MΩ = ${fmt(rs(raw))} ${MU}A`],
        tips: ['Auch eine gute Isolation lässt einen sehr kleinen Strom durch. Je größer der Isolationswiderstand, desto kleiner ist dieser Strom.', 'I = U / R. Volt durch Megaohm ergibt direkt Mikroampere.'] };
    }],
    ['Elektrotechnik', 1, 'Pulsweitenmodulation: Mittelwert der Spannung', R => {
      const Ub = pick(R, [5, 12, 24]), T = pick(R, [1, 2, 5, 10]), D = pick(R, [20, 25, 40, 60, 75, 80]), ton = rs(T * D / 100), raw = Ub * D / 100;
      return { text: `Ein Ausgang schaltet ${Ub} V mit Pulsweitenmodulation. Die Periodendauer ist ${T} ms, eingeschaltet ist er davon jeweils ${fmt(ton)} ms. Wie groß ist der Mittelwert der Spannung?`, unit: 'V', raw, dec: 2, meta: { Ub, T, D, ton },
        steps: [`Tastgrad: g = Einschaltzeit / Periodendauer = ${fmt(ton)} ms / ${T} ms = ${fmt(D / 100)}`, `Mittelwert: U = g · Ub = ${fmt(D / 100)} · ${Ub} V = ${fmt(rs(raw))} V`],
        tips: ['Der Tastgrad sagt, welchen Teil der Zeit der Ausgang eingeschaltet ist.', 'So gehst du vor: 1. Einschaltzeit durch Periodendauer teilen. 2. Mit der Betriebsspannung malnehmen.'] };
    }],
    ['Elektrotechnik', 2, 'Elektrolytkondensator: Lebensdauer und Temperatur', R => {
      const L0 = pick(R, [2000, 5000, 10000]), T0 = pick(R, [85, 105]), d = pick(R, [10, 20, 30, 40]), T = T0 - d, raw = L0 * Math.pow(2, d / 10);
      return { text: `Ein Elektrolytkondensator ist mit ${L0} Stunden Lebensdauer bei ${T0} °C angegeben. Als Faustregel verdoppelt sich die Lebensdauer je 10 °C weniger. Welche Lebensdauer ist bei ${T} °C Betriebstemperatur zu erwarten?`, unit: 'h', raw, dec: 0, meta: { L0, T0, T },
        steps: [`Temperaturabstand: ${T0} °C − ${T} °C = ${d} °C, das sind ${d / 10} Schritte von je 10 °C`, `Je Schritt verdoppelt sich die Lebensdauer: Faktor 2^${d / 10} = ${Math.pow(2, d / 10)}`, `Lebensdauer: ${L0} h · ${Math.pow(2, d / 10)} = ${fmt(raw)} h`],
        tips: ['Wärme lässt den Elektrolyten schneller altern. Jede Absenkung um 10 °C verdoppelt nach der Faustregel die Lebensdauer.', 'So gehst du vor: 1. Temperaturabstand bestimmen. 2. Durch 10 teilen, das ist die Zahl der Verdopplungen. 3. Die Lebensdauer so oft mit 2 malnehmen.'] };
    }],
    ['Elektrotechnik', 3, 'Spannungsteiler: ungünstigster Fall mit Toleranz', R => {
      const U = pick(R, [10, 12]), R1 = pick(R, [1, 2.2, 4.7, 10]), R2 = pick(R, [1, 2.2, 4.7, 10]), p = pick(R, [1, 5, 10]), a = rs(R1 * (1 - p / 100)), b = rs(R2 * (1 + p / 100)), raw = U * b / (a + b);
      return { text: `Ein Spannungsteiler aus R1 = ${fmt(R1)} kΩ (oben) und R2 = ${fmt(R2)} kΩ (unten) liegt an genau ${U} V. Beide Widerstände haben ${p} % Toleranz. Wie groß kann die Spannung an R2 im ungünstigsten Fall höchstens werden?`, unit: 'V', raw, dec: 3, meta: { U, R1, R2, p },
        steps: [`Die Spannung an R2 wird am größten, wenn R2 am oberen und R1 am unteren Rand liegt.`, `R1 kleinster Wert: ${fmt(R1)} kΩ · ${fmt(rs(1 - p / 100))} = ${fmt(a)} kΩ. R2 größter Wert: ${fmt(R2)} kΩ · ${fmt(rs(1 + p / 100))} = ${fmt(b)} kΩ.`, `U2 = U · R2 / (R1 + R2) = ${U} V · ${fmt(b)} kΩ / (${fmt(a)} kΩ + ${fmt(b)} kΩ) = ${fmt(rd(raw, 4))} V`, `Mit den Nennwerten wären es ${fmt(rd(U * R2 / (R1 + R2), 3))} V.`],
        tips: ['Überlege zuerst, in welche Richtung jeder Widerstand abweichen muss, damit die Spannung an R2 möglichst groß wird.', 'R2 so groß wie möglich, R1 so klein wie möglich. Dann die Teilerformel mit diesen Grenzwerten rechnen.'] };
    }],
    ['Elektrotechnik', 3, 'Kühlkörper auslegen', R => {
      const P = pick(R, [5, 8, 10, 15]), Tj = pick(R, [125, 150]), Ta = pick(R, [25, 40, 50]), Rjc = pick(R, [1.5, 2, 3]), Rck = pick(R, [0.5, 1]), ges = (Tj - Ta) / P, raw = ges - Rjc - Rck;
      return { text: `Ein Transistor setzt ${P} W in Wärme um. Die Sperrschicht darf höchstens ${Tj} °C warm werden, die Umgebung hat ${Ta} °C. Wärmewiderstand Sperrschicht zu Gehäuse: ${fmt(Rjc)} K/W, Gehäuse zu Kühlkörper: ${fmt(Rck)} K/W. Welchen Wärmewiderstand darf der Kühlkörper höchstens haben?`, unit: 'K/W', raw, dec: 3, meta: { P, Tj, Ta, Rjc, Rck },
        steps: [`Erlaubter Temperaturunterschied: ${Tj} °C − ${Ta} °C = ${Tj - Ta} K`, `Erlaubter Wärmewiderstand der ganzen Kette: R_ges = ${Tj - Ta} K / ${P} W = ${fmt(rd(ges, 3))} K/W`, `Davon ab gehen Sperrschicht zu Gehäuse und Gehäuse zu Kühlkörper: ${fmt(rd(ges, 3))} K/W − ${fmt(Rjc)} K/W − ${fmt(Rck)} K/W = ${fmt(rd(raw, 3))} K/W`],
        tips: ['Wärme fließt wie Strom durch eine Reihenschaltung: Sperrschicht, Gehäuse, Kühlkörper, Luft. Die Wärmewiderstände zählen sich zusammen.', 'So gehst du vor: 1. Temperaturunterschied durch die Leistung teilen. 2. Die beiden bekannten Wärmewiderstände abziehen.'] };
    }],
    ['Elektrotechnik', 1, 'Funk: Wellenlänge aus der Frequenz', R => {
      const f = pick(R, [27, 88, 100, 145, 433, 868, 2400]), raw = 300 / f;
      return { text: `Ein Sender arbeitet auf ${f} MHz. Wie groß ist die Wellenlänge in Luft? Rechne mit einer Ausbreitungsgeschwindigkeit von 300 000 km/s.`, unit: 'm', raw, dec: 3, meta: { f },
        steps: ['Formel: λ = c / f', `Mit c = 300 000 000 m/s und f = ${f} MHz = ${f} · 10⁶ Hz: λ = 300 / ${f} m = ${fmt(rd(raw, 4))} m`],
        tips: ['Je höher die Frequenz, desto kürzer die Welle.', 'Kurzform: Wellenlänge in Metern = 300 geteilt durch die Frequenz in MHz.'] };
    }],
    /* ===== v62.184: Rubrik Elektronik vertieft (mat125 bis mat144): Pegel und Funk, Wandler, Schaltregler, Schnittstellen, Operationsverstärker ===== */
    ['Elektronik vertieft', 1, 'Pegel: Leistungsverstärkung in dB', R => {
      const P1 = pick(R, [1, 2, 5, 10]), k = pick(R, [2, 4, 10, 20, 50, 100, 200]), P2 = P1 * k, raw = 10 * Math.log10(k);
      return { text: `Ein Verstärker macht aus ${P1} mW Eingangsleistung ${P2} mW Ausgangsleistung. Wie groß ist die Verstärkung in dB?`, unit: 'dB', raw, dec: 1, meta: { P1, P2 },
        steps: ['Formel für Leistungen: g = 10 · lg(P2 / P1)', `Verhältnis: P2 / P1 = ${P2} mW / ${P1} mW = ${k}`, `g = 10 · lg(${k}) = ${fmt(rd(raw, 2))} dB`],
        tips: ['Das Dezibel beschreibt ein Verhältnis. Verdoppelte Leistung sind rund 3 dB, zehnfache Leistung sind 10 dB.', 'g = 10 · lg(P2 / P1). lg ist der Logarithmus zur Basis 10 (Taste log).'] };
    }],
    ['Elektronik vertieft', 2, 'Pegel: Spannungsverstärkung in dB', R => {
      const U1 = pick(R, [10, 20, 50, 100]), k = pick(R, [2, 5, 10, 20, 50, 100]), U2 = U1 * k, raw = 20 * Math.log10(k);
      return { text: `Ein Verstärker macht aus ${U1} mV am Eingang ${U2} mV am Ausgang. Ein- und Ausgang haben denselben Widerstand. Wie groß ist die Verstärkung in dB?`, unit: 'dB', raw, dec: 1, meta: { U1, U2 },
        steps: ['Formel für Spannungen: g = 20 · lg(U2 / U1)', `Verhältnis: U2 / U1 = ${U2} mV / ${U1} mV = ${k}`, `g = 20 · lg(${k}) = ${fmt(rd(raw, 2))} dB`],
        tips: ['Bei Spannungen steht eine 20 vor dem Logarithmus, weil die Leistung mit dem Quadrat der Spannung wächst. Doppelte Spannung sind rund 6 dB.', 'g = 20 · lg(U2 / U1).'] };
    }],
    ['Elektronik vertieft', 2, 'Pegel: dBm und Milliwatt', R => {
      const k = pick(R, ['L', 'P']), P = pick(R, [2, 5, 20, 50, 200, 500]), L = pick(R, [3, 7, 10, 13, 17, 20, 27, 30]);
      if (k === 'L') return { text: `Ein Sender gibt ${P} mW ab. Wie groß ist der Leistungspegel in dBm?`, unit: 'dBm', raw: 10 * Math.log10(P), dec: 1, meta: { k, P, L },
        steps: ['Der Pegel in dBm bezieht die Leistung auf 1 mW: L = 10 · lg(P / 1 mW)', `L = 10 · lg(${P}) = ${fmt(rd(10 * Math.log10(P), 2))} dBm`],
        tips: ['0 dBm sind genau 1 mW. 10 dBm sind 10 mW, 20 dBm sind 100 mW.', 'L = 10 · lg(P in mW).'] };
      return { text: `Ein Signal hat einen Leistungspegel von ${L} dBm. Wie groß ist die Leistung?`, unit: 'mW', raw: Math.pow(10, L / 10), dec: 1, meta: { k, P, L },
        steps: ['Umkehrung der Pegelformel: P = 1 mW · 10^(L / 10)', `P = 1 mW · 10^(${fmt(L / 10)}) = ${fmt(rd(Math.pow(10, L / 10), 2))} mW`],
        tips: ['0 dBm sind genau 1 mW. Je 10 dB mehr verzehnfacht sich die Leistung, je 3 dB mehr verdoppelt sie sich ungefähr.', 'P in mW = 10 hoch (Pegel geteilt durch 10).'] };
    }],
    ['Elektronik vertieft', 2, 'Pegelplan einer Übertragungsstrecke', R => {
      const Ls = pick(R, [0, 10, 13, 20]), a1 = pick(R, [1.5, 3, 4.5, 6]), g = pick(R, [10, 15, 20]), a2 = pick(R, [0.5, 2, 2.5]), raw = Ls - a1 + g - a2;
      return { text: `Ein Sender liefert ${Ls} dBm. Es folgen ein Kabel mit ${fmt(a1)} dB Dämpfung, ein Verstärker mit ${g} dB Verstärkung und ein zweites Kabel mit ${fmt(a2)} dB Dämpfung. Welcher Pegel kommt am Ende an?`, unit: 'dBm', raw, dec: 1, meta: { Ls, a1, g, a2 },
        steps: ['In dB wird nur zusammengezählt und abgezogen: Verstärkung plus, Dämpfung minus.', `L = ${Ls} dBm − ${fmt(a1)} dB + ${g} dB − ${fmt(a2)} dB = ${fmt(rs(raw))} dBm`],
        tips: ['Das ist der große Vorteil der Pegelrechnung: Aus Malnehmen und Teilen wird Zusammenzählen und Abziehen.', 'Starte beim Senderpegel. Ziehe jede Dämpfung ab und zähle jede Verstärkung dazu.'] };
    }],
    ['Elektronik vertieft', 1, 'Koaxialkabel: Dämpfung nach Länge', R => {
      const a = pick(R, [6.5, 11, 17, 22, 28]), l = pick(R, [15, 25, 40, 60, 75]), raw = a * l / 100;
      return { text: `Ein Koaxialkabel hat laut Datenblatt bei der Betriebsfrequenz ${fmt(a)} dB Dämpfung je 100 m. Wie groß ist die Dämpfung bei ${l} m Kabel?`, unit: 'dB', raw, dec: 3, meta: { a, l },
        steps: [`Dämpfung je Meter: ${fmt(a)} dB : 100 = ${fmt(rs(a / 100))} dB`, `Für ${l} m: ${fmt(rs(a / 100))} dB · ${l} = ${fmt(rs(raw))} dB`],
        tips: ['Die Dämpfung in dB wächst gleichmäßig mit der Länge. Doppelte Länge, doppelte dB-Zahl.', 'Das ist ein Dreisatz: von 100 m auf 1 m herunter, dann auf die gesuchte Länge hoch.'] };
    }],
    ['Elektronik vertieft', 3, 'Anpassung: Reflexionsfaktor und Stehwellenverhältnis', R => {
      const k = pick(R, ['r', 's']), Z0 = 50, ZL = pick(R, [12.5, 25, 75, 100, 150, 200, 300]), r = Math.abs(ZL - Z0) / (ZL + Z0), s = (1 + r) / (1 - r);
      const st = ['Formel: r = Betrag von (ZL − Z0) / (ZL + Z0)', `r = Betrag von (${fmt(ZL)} Ω − ${Z0} Ω) / (${fmt(ZL)} Ω + ${Z0} Ω) = ${fmt(rd(r, 4))}`];
      if (k === 'r') return { text: `An ein Kabel mit ${Z0} Ω Wellenwiderstand ist eine rein ohmsche Last mit ${fmt(ZL)} Ω angeschlossen. Wie groß ist der Betrag des Reflexionsfaktors?`, unit: '', raw: r, dec: 3, meta: { k, Z0, ZL }, steps: st,
        tips: ['Nur wenn die Last genau so groß ist wie der Wellenwiderstand, wird nichts zurückgeworfen. Dann ist der Reflexionsfaktor 0.', 'r = Betrag von (ZL − Z0) / (ZL + Z0). Das Ergebnis liegt zwischen 0 und 1 und hat keine Einheit.'] };
      return { text: `An ein Kabel mit ${Z0} Ω Wellenwiderstand ist eine Antenne mit ${fmt(ZL)} Ω (rein ohmsch) angeschlossen. Wie groß ist das Stehwellenverhältnis?`, unit: '', raw: s, dec: 2, meta: { k, Z0, ZL }, steps: st.concat([`Stehwellenverhältnis: s = (1 + r) / (1 − r) = ${fmt(rd(1 + r, 4))} / ${fmt(rd(1 - r, 4))} = ${fmt(rd(s, 3))}`]),
        tips: ['Bei perfekter Anpassung ist das Stehwellenverhältnis 1. Je schlechter die Anpassung, desto größer wird es.', 'So gehst du vor: 1. Reflexionsfaktor r = Betrag von (ZL − Z0) / (ZL + Z0). 2. s = (1 + r) / (1 − r).'] };
    }],
    ['Elektronik vertieft', 3, 'Funkstrecke: Freiraumdämpfung', R => {
      const d = pick(R, [0.1, 0.5, 1, 2, 5, 10]), f = pick(R, [145, 433, 868, 2400]), raw = 32.44 + 20 * Math.log10(d) + 20 * Math.log10(f);
      return { text: `Zwischen zwei Antennen liegen ${fmt(d)} km freie Sicht. Die Frequenz ist ${f} MHz. Wie groß ist die Freiraumdämpfung? Nutze a = 32,44 dB + 20 · lg(d in km) + 20 · lg(f in MHz).`, unit: 'dB', raw, dec: 1, meta: { d, f },
        steps: [`Anteil der Entfernung: 20 · lg(${fmt(d)}) = ${fmt(rd(20 * Math.log10(d), 2))} dB`, `Anteil der Frequenz: 20 · lg(${f}) = ${fmt(rd(20 * Math.log10(f), 2))} dB`, `Summe: 32,44 dB ${20 * Math.log10(d) < 0 ? '− ' + fmt(rd(-20 * Math.log10(d), 2)) : '+ ' + fmt(rd(20 * Math.log10(d), 2))} dB + ${fmt(rd(20 * Math.log10(f), 2))} dB = ${fmt(rd(raw, 2))} dB`],
        tips: ['Die Welle verteilt sich im Raum. Doppelte Entfernung oder doppelte Frequenz kosten jeweils rund 6 dB.', 'Setze die Entfernung in km und die Frequenz in MHz ein. Der Logarithmus einer Zahl unter 1 ist negativ.'] };
    }],
    ['Elektronik vertieft', 2, 'AD-Wandler: Größe einer Stufe', R => {
      const Ur = pick(R, [2.5, 3.3, 4.096, 5]), n = pick(R, [8, 10, 12]), N = Math.pow(2, n), raw = Ur * 1000 / N;
      return { text: `Ein AD-Wandler mit ${n} Bit arbeitet mit ${fmt(Ur)} V Referenzspannung. Wie groß ist eine Stufe (1 LSB)? Rechne mit 2ⁿ Stufen.`, unit: 'mV', raw, dec: 2, meta: { Ur, n },
        steps: [`Zahl der Stufen: 2^${n} = ${N}`, `Eine Stufe: U_LSB = U_ref / 2^n = ${fmt(Ur * 1000)} mV / ${N} = ${fmt(rd(raw, 3))} mV`],
        tips: ['Der Wandler teilt die Referenzspannung in gleich große Stufen. Mit jedem Bit mehr verdoppelt sich die Zahl der Stufen.', 'U_LSB = U_ref / 2^n. Rechne die Referenzspannung vorher in mV um.'] };
    }],
    ['Elektronik vertieft', 2, 'AD-Wandler: Spannung aus dem Zahlenwert', R => {
      const Ur = pick(R, [3.3, 5]), n = pick(R, [10, 12]), N = Math.pow(2, n), Z = pick(R, [205, 300, 512, 614, 768, 1000]) * (n === 12 ? 4 : 1), raw = Z * Ur / N;
      return { text: `Ein AD-Wandler mit ${n} Bit und ${fmt(Ur)} V Referenzspannung liefert den Zahlenwert ${Z}. Welche Spannung liegt am Eingang? Rechne mit 2ⁿ Stufen.`, unit: 'V', raw, dec: 3, meta: { Ur, n, Z },
        steps: [`Zahl der Stufen: 2^${n} = ${N}`, `Spannung: U = Zahlenwert · U_ref / 2^n = ${Z} · ${fmt(Ur)} V / ${N} = ${fmt(rd(raw, 4))} V`],
        tips: ['Der Zahlenwert sagt, wie viele Stufen die Eingangsspannung hoch ist.', 'U = Zahlenwert · U_ref / 2^n.'] };
    }],
    ['Elektronik vertieft', 1, 'Abtasten: kleinste Abtastrate', R => {
      const f = pick(R, [3.4, 4, 8, 15, 20, 22]), raw = 2 * f;
      return { text: `Ein Signal enthält Frequenzen bis ${fmt(f)} kHz. Welche Grenze muss die Abtastrate nach dem Abtasttheorem überschreiten, damit das Signal noch richtig erfasst wird?`, unit: 'kHz', raw, dec: 1, meta: { f },
        steps: ['Abtasttheorem: Die Abtastrate muss größer sein als das Doppelte der höchsten Signalfrequenz.', `Grenze: 2 · ${fmt(f)} kHz = ${fmt(rs(raw))} kHz`],
        tips: ['Je Schwingung braucht der Wandler mehr als zwei Messpunkte.', 'Grenze der Abtastrate = 2 · höchste Signalfrequenz.'] };
    }],
    ['Elektronik vertieft', 3, 'Abtasten: Alias-Frequenz', R => {
      const fs = pick(R, [8, 10, 20, 48]), q = pick(R, [0.6, 0.7, 0.75, 0.9]), f = rs(fs * q), raw = fs - f;
      return { text: `Ein AD-Wandler tastet mit ${fs} kHz ab. Ohne Filter gelangt ein Sinus mit ${fmt(f)} kHz an den Eingang. Bei welcher Frequenz erscheint dieses Signal in den abgetasteten Daten?`, unit: 'kHz', raw, dec: 2, meta: { fs, f },
        steps: [`Halbe Abtastrate: ${fs} kHz : 2 = ${fmt(fs / 2)} kHz. Das Signal liegt darüber, es wird also gespiegelt.`, `Alias-Frequenz: f_a = f_s − f = ${fs} kHz − ${fmt(f)} kHz = ${fmt(rs(raw))} kHz`],
        tips: ['Signale oberhalb der halben Abtastrate tauchen an einer falschen, tieferen Stelle wieder auf. Deshalb sitzt vor dem Wandler ein Tiefpass.', 'Liegt die Signalfrequenz zwischen halber und ganzer Abtastrate, gilt: Alias-Frequenz = Abtastrate − Signalfrequenz.'] };
    }],
    ['Elektronik vertieft', 2, 'Abwärtswandler: Tastgrad', R => {
      const Ue = pick(R, [12, 24, 48]), Ua = pick(R, [3.3, 5, 9, 12].filter(x => x < Ue)), raw = Ua / Ue * 100;
      return { text: `Ein Abwärtswandler soll aus ${Ue} V eine Ausgangsspannung von ${fmt(Ua)} V machen. Verluste werden vernachlässigt, der Drosselstrom reißt nicht ab. Welchen Tastgrad braucht der Schalter?`, unit: '%', raw, dec: 2, meta: { Ue, Ua },
        steps: ['Beim Abwärtswandler gilt: Ua = g · Ue', `Tastgrad: g = Ua / Ue = ${fmt(Ua)} V / ${Ue} V = ${fmt(rd(raw / 100, 4))}`, `In Prozent: ${fmt(rd(raw, 2))} %`],
        tips: ['Der Schalter legt die Eingangsspannung nur einen Teil der Zeit an die Drossel. Dieser Teil ist der Tastgrad.', 'g = Ua / Ue, mal 100 ergibt Prozent.'] };
    }],
    ['Elektronik vertieft', 3, 'Abwärtswandler: Welligkeit des Drosselstroms', R => {
      const Ue = pick(R, [12, 24]), Ua = pick(R, [3.3, 5]), L = pick(R, [22, 47, 100]), f = pick(R, [100, 250, 500]), g = Ua / Ue, raw = (Ue - Ua) * g / (L * 1e-6 * f * 1e3);
      return { text: `Ein Abwärtswandler macht aus ${Ue} V eine Ausgangsspannung von ${fmt(Ua)} V. Die Drossel hat ${L} ${MU}H, die Schaltfrequenz ist ${f} kHz. Wie groß ist die Welligkeit des Drosselstroms (Spitze zu Spitze)?`, unit: 'A', raw, dec: 3, meta: { Ue, Ua, L, f },
        steps: [`Tastgrad: g = Ua / Ue = ${fmt(rd(g, 4))}`, `Einschaltzeit: t_ein = g / f = ${fmt(rd(g, 4))} / ${f} kHz = ${fmt(rd(g / f * 1000, 3))} ${MU}s`, `In dieser Zeit liegt an der Drossel Ue − Ua = ${fmt(rs(Ue - Ua))} V. Stromanstieg: ΔI = (Ue − Ua) · t_ein / L = ${fmt(rs(Ue - Ua))} V · ${fmt(rd(g / f * 1000, 3))} ${MU}s / ${L} ${MU}H = ${fmt(rd(raw, 3))} A`],
        tips: ['Solange der Schalter leitet, steigt der Strom in der Drossel gleichmäßig an. Die Spannung an der Drossel ist dabei Ue − Ua.', 'So gehst du vor: 1. Tastgrad g = Ua / Ue. 2. Einschaltzeit t_ein = g / f. 3. ΔI = (Ue − Ua) · t_ein / L.'] };
    }],
    ['Elektronik vertieft', 1, 'MOSFET: Verlustleistung im eingeschalteten Zustand', R => {
      const I = pick(R, [2, 5, 8, 10, 15]), Rm = pick(R, [8, 20, 45, 100]), raw = I * I * Rm / 1000;
      return { text: `Ein MOSFET hat eingeschaltet einen Widerstand von ${Rm} mΩ. Es fließen dauerhaft ${I} A. Welche Leistung wird im MOSFET zu Wärme?`, unit: 'W', raw, dec: 3, meta: { I, Rm },
        steps: ['Formel: P = I² · R', `R = ${Rm} mΩ = ${fmt(Rm / 1000)} Ω`, `P = (${I} A)² · ${fmt(Rm / 1000)} Ω = ${fmt(rs(raw))} W`],
        tips: ['Eingeschaltet verhält sich der MOSFET wie ein kleiner Widerstand. Die Verluste wachsen mit dem Quadrat des Stroms.', 'P = I² · R, mit R in Ohm (mΩ durch 1000 teilen).'] };
    }],
    ['Elektronik vertieft', 3, 'MOSFET: Schaltverluste', R => {
      const U = pick(R, [12, 24, 48]), I = pick(R, [2, 5, 10]), t = pick(R, [40, 60, 100]), f = pick(R, [100, 200, 500]), raw = 0.5 * U * I * t * 1e-9 * f * 1e3;
      return { text: `Ein MOSFET schaltet ${U} V und ${I} A mit ${f} kHz. Ein- und Ausschalten dauern zusammen ${t} ns. Wie groß sind die Schaltverluste? Nutze die Näherung P = 0,5 · U · I · t · f.`, unit: 'W', raw, dec: 3, meta: { U, I, t, f },
        steps: [`Einheiten: t = ${t} ns = ${t} · 10⁻⁹ s, f = ${f} kHz = ${f} · 10³ Hz`, `P = 0,5 · ${U} V · ${I} A · ${t} · 10⁻⁹ s · ${f} · 10³ Hz = ${fmt(rd(raw, 4))} W`],
        tips: ['Während des Umschaltens liegen kurz gleichzeitig Spannung und Strom am MOSFET an. Das passiert bei jeder Periode, deshalb wachsen die Verluste mit der Frequenz.', 'Rechne ns in s (mal 10⁻⁹) und kHz in Hz (mal 10³) um, dann alles malnehmen.'] };
    }],
    ['Elektronik vertieft', 2, 'Serielle Schnittstelle: Bitdauer und Zeit je Zeichen', R => {
      const k = pick(R, ['bit', 'byte']), b = pick(R, [9600, 19200, 38400, 57600, 115200]), bit = 1e6 / b;
      if (k === 'bit') return { text: `Eine serielle Schnittstelle (UART) arbeitet mit ${b} Baud. Wie lange dauert ein Bit?`, unit: MU + 's', raw: bit, dec: 1, meta: { k, b },
        steps: ['Formel: Bitdauer = 1 / Baudrate', `Bitdauer = 1 / ${b} s = ${fmt(rd(bit, 2))} ${MU}s`],
        tips: ['Die Baudrate sagt, wie viele Bits je Sekunde übertragen werden.', `Bitdauer = 1 / Baudrate. Eine Sekunde hat 1 000 000 ${MU}s.`] };
      return { text: `Eine serielle Schnittstelle (UART) arbeitet mit ${b} Baud. Ein Zeichen besteht aus 1 Startbit, 8 Datenbits und 1 Stoppbit. Wie lange dauert die Übertragung eines Zeichens?`, unit: MU + 's', raw: 10 * bit, dec: 1, meta: { k, b },
        steps: ['Bits je Zeichen: 1 + 8 + 1 = 10', `Bitdauer = 1 / ${b} s = ${fmt(rd(bit, 2))} ${MU}s`, `Zeit je Zeichen: 10 · ${fmt(rd(bit, 2))} ${MU}s = ${fmt(rd(10 * bit, 2))} ${MU}s`],
        tips: ['Zu den 8 Datenbits kommen Startbit und Stoppbit dazu.', `So gehst du vor: 1. Bitdauer = 1 / Baudrate (in ${MU}s). 2. Mal 10 Bits.`] };
    }],
    ['Elektronik vertieft', 2, 'I²C-Bus: kleinster Pull-up-Widerstand', R => {
      const V = pick(R, [3, 3.3, 3.6, 5]), I = pick(R, [3, 3, 20]), raw = (V - 0.4) / I;
      return { text: `An einem I²C-Bus mit ${fmt(V)} V darf ein Baustein die Leitung mit höchstens ${I} mA auf 0,4 V herunterziehen. Wie groß muss der Pull-up-Widerstand mindestens sein?`, unit: 'kΩ', raw, dec: 3, meta: { V, I },
        steps: [`Am Widerstand liegt bei gezogener Leitung: ${fmt(V)} V − 0,4 V = ${fmt(rs(V - 0.4))} V`, `Kleinster Wert: R = U / I = ${fmt(rs(V - 0.4))} V / ${I} mA = ${fmt(rd(raw, 3))} kΩ`],
        tips: ['Zieht ein Baustein die Leitung auf Low, fließt Strom durch den Pull-up in den Baustein. Dieser Strom darf den erlaubten Wert nicht übersteigen.', 'R = (Betriebsspannung − 0,4 V) / erlaubter Strom. Volt durch Milliampere ergibt Kiloohm.'] };
    }],
    ['Elektronik vertieft', 2, 'Operationsverstärker: Bandbreite bei Verstärkung', R => {
      const G = pick(R, [1, 3, 10]), V = pick(R, [10, 20, 50, 100]), raw = G * 1000 / V;
      return { text: `Ein Operationsverstärker hat ein Verstärkungs-Bandbreite-Produkt von ${G} MHz. Er wird als nicht invertierender Verstärker mit der Verstärkung ${V} betrieben. Bis zu welcher Frequenz bleibt diese Verstärkung ungefähr erhalten?`, unit: 'kHz', raw, dec: 1, meta: { G, V },
        steps: ['Faustformel: Grenzfrequenz = Verstärkungs-Bandbreite-Produkt / Verstärkung', `f_g = ${G} MHz / ${V} = ${G * 1000} kHz / ${V} = ${fmt(rs(raw))} kHz`],
        tips: ['Verstärkung und Bandbreite hängen zusammen: Je mehr Verstärkung du einstellst, desto kleiner wird die nutzbare Bandbreite.', 'f_g = Verstärkungs-Bandbreite-Produkt / Verstärkung. Rechne MHz in kHz um (mal 1000).'] };
    }],
    ['Elektronik vertieft', 3, 'Operationsverstärker: Anstiegsgeschwindigkeit', R => {
      const S = pick(R, [0.5, 1, 7, 13]), U = pick(R, [1, 2, 5, 10]), raw = S * 1e6 / (2 * Math.PI * U) / 1000;
      return { text: `Ein Operationsverstärker hat eine Anstiegsgeschwindigkeit von ${fmt(S)} V/${MU}s. Er soll einen Sinus mit ${U} V Scheitelwert ausgeben. Bis zu welcher Frequenz gelingt das unverzerrt?`, unit: 'kHz', raw, dec: 1, meta: { S, U },
        steps: ['Die steilste Stelle eines Sinus hat die Steigung 2 · π · f · Û. Diese Steigung darf die Anstiegsgeschwindigkeit nicht übersteigen.', 'Umgestellt: f_max = SR / (2 · π · Û)', `SR = ${fmt(S)} V/${MU}s = ${fmt(S)} · 10⁶ V/s`, `f_max = ${fmt(S)} · 10⁶ V/s / (2 · π · ${U} V) = ${fmt(rd(raw * 1000, 0))} Hz = ${fmt(rd(raw, 2))} kHz`],
        tips: ['Der Ausgang kann seine Spannung nur begrenzt schnell ändern. Bei großen Amplituden und hohen Frequenzen wird aus dem Sinus sonst ein Dreieck.', `f_max = SR / (2 · π · Û). Rechne V/${MU}s in V/s um (mal 10⁶).`] };
    }],
    ['Elektronik vertieft', 3, 'Komparator mit Hysterese', R => {
      const Us = pick(R, [10, 12, 13.5]), R1 = pick(R, [1, 2.2, 4.7, 10]), R2 = pick(R, [47, 100, 220]), raw = 2 * Us * R1 / R2;
      return { text: `Ein nicht invertierender Schmitt-Trigger: Das Eingangssignal liegt über R1 = ${fmt(R1)} kΩ am Plus-Eingang, R2 = ${R2} kΩ führt vom Ausgang zurück zum Plus-Eingang, der Minus-Eingang liegt an Masse. Der Ausgang springt zwischen +${fmt(Us)} V und −${fmt(Us)} V. Wie groß ist die Hysterese (Abstand der beiden Schaltschwellen)?`, unit: 'V', raw, dec: 2, meta: { Us, R1, R2 },
        steps: [`Umgeschaltet wird, wenn der Plus-Eingang 0 V erreicht. Das ist der Fall bei U_ein = ± U_aus · R1 / R2.`, `Eine Schwelle: ${fmt(Us)} V · ${fmt(R1)} kΩ / ${R2} kΩ = ${fmt(rd(Us * R1 / R2, 4))} V (einmal positiv, einmal negativ)`, `Hysterese: 2 · ${fmt(rd(Us * R1 / R2, 4))} V = ${fmt(rd(raw, 3))} V`],
        tips: ['Durch die Rückkopplung auf den Plus-Eingang gibt es zwei Schaltschwellen. Ein verrauschtes Signal schaltet dadurch nicht mehrfach hin und her.', 'Schwellen: ± U_aus · R1 / R2. Die Hysterese ist der Abstand der beiden Schwellen, also das Doppelte.'] };
        }]
  ];
  const tasks = defs.map((d, i) => ({ id: 'mat' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  /* Fertige Aufgabe aus Aufgabe + Seed (gleicher Seed = gleiche Zahlen) */
  function build(t, seed) {
    const R = C.rng(t.id + ':' + (seed == null ? 0 : seed)), g = t.gen(R), B = g.bruch || null, value = B ? B[0] / B[1] : rd(g.raw, g.dec), exact = B ? true : value === rs(g.raw), dec = g.dec;
    const tol = B ? 1e-9 : exact ? Math.max(1e-6, Math.abs(value) * 1e-6) : Math.pow(10, -dec);
    /* sol = Lösung als Text; bei Bruch-Aufgaben der gekürzte Bruch, dazu die gemischte Zahl */
    const sol = (B ? bt(B[0], B[1]) + (B[1] > 1 && B[0] > B[1] ? ' (= ' + gem(B[0], B[1]) + ')' : '') : fmt(value, Math.max(dec, 0))) + (g.unit ? ' ' + g.unit : '');
    return { id: t.id, seed, cat: t.cat, level: t.level, title: t.title, text: g.text + (exact ? '' : ' Runde auf ' + dig(dec) + '.'), unit: g.unit, label: g.label || (B ? 'Dein Ergebnis als Bruch' : 'Dein Ergebnis'), value, tol, dec, exact, bruch: B, sol,
      steps: g.steps.concat(['Ergebnis: ' + sol]), tips: g.tips, svg: g.svg || null, skizze: g.skizze || null, meta: g.meta, raw: g.raw };
  }

  /* ---------- Beispiele (Reiter "Beispiele", Aufruf ?bsp): Schritt für Schritt durchgerechnet ---------- */
  const bs = [];
  { const c = C.convert(72, 'km/h', 'm/s'); bs.push({ id: 'mb1', tab: 'einh', titel: 'Einheiten: 72 km/h in m/s', aufgabe: 'Ein Förderband läuft mit 72 km/h. Wie viel sind das in m/s?', steps: c.steps.concat(['Probe: 20 m/s · 3,6 = 72 km/h ✓']), ergebnis: '72 km/h = 20 m/s', set: { fam: 'geschw', v: '72', from: 'km/h', to: 'm/s' } }); }
  { const d = C.dreisatz('direkt', 8, 14.4, 25, 'm', '€'); bs.push({ id: 'mb2', tab: 'drei', titel: 'Dreisatz: Preis für 25 m Kabel', aufgabe: '8 m Kabel kosten 14,40 €. Was kosten 25 m?', steps: d.steps, ergebnis: '25 m kosten ' + fmtMoney(d.value) + ' €', set: { typ: 'direkt', a: '8', b: '14,4', x: '25', la: 'm', lb: '€' } }); }
  { const r1 = C.proz('minder', 250, 12), r2 = C.proz('mwst', r1.value, 19); bs.push({ id: 'mb3', tab: 'proz', titel: 'Prozent: Rabatt und Mehrwertsteuer', aufgabe: 'Ein Messgerät kostet netto 250 €. Du bekommst 12 % Rabatt, danach kommen 19 % Mehrwertsteuer dazu. Was ist der Endpreis?', steps: ['Schritt 1: Rabatt abziehen'].concat(r1.steps, ['Schritt 2: Mehrwertsteuer aufschlagen'], r2.steps), ergebnis: 'Endpreis: ' + fmtMoney(r2.value) + ' €', set: { k: 'minder', x: '250', y: '12', z: '' } }); }
  { const u = C.umformung('kreis', 'd'), env = { A: 78.54 }, v = C.solveFor('kreis', 'd', env); bs.push({ id: 'mb4', tab: 'umst', titel: 'Formel umstellen: Durchmesser aus der Kreisfläche', aufgabe: 'Eine Kreisscheibe hat A = 78,54 mm². Wie groß ist d? Stelle A = π · d² / 4 nach d um.', steps: ['Start: ' + C.pretty(u.start), ...u.steps.map(s => s.op + ':  ' + C.pretty(s.eq)), C.calcLine('d', u.expr, env, 1, 'mm')], ergebnis: 'd = ' + fmt(rd(v, 1)) + ' mm', set: { f: 'kreis', t: 'd' } }); }
  { const p = C.pyth({ a: 60, b: 80 }); bs.push({ id: 'mb5', tab: 'geo', titel: 'Pythagoras: Diagonale eines Rahmens', aufgabe: 'Ein rechteckiger Rahmen ist 60 cm hoch und 80 cm breit. Wie lang ist die Diagonale?', steps: ['Die Diagonale ist die Hypotenuse des rechtwinkligen Dreiecks aus Höhe und Breite.', 'Satz des Pythagoras: a² + b² = c²', p.steps[0]], ergebnis: 'Diagonale: ' + fmt(p.c) + ' cm', set: { sub: 'tri', known: 'ab', v1: '60', v2: '80' } }); }
  { const t = C.solveTri({ a: 1.5, b: 6 }); bs.push({ id: 'mb6', tab: 'geo', titel: 'Winkelfunktion: Neigung einer Rampe', aufgabe: 'Eine Rampe überwindet 1,5 m Höhe auf 6 m Länge (waagerecht gemessen). Welchen Winkel hat sie?', steps: ['Gegenkathete a = 1,5 m (Höhe), Ankathete b = 6 m (Länge). Gesucht ist α.', 'Gegenkathete und Ankathete gehören zum Tangens:', t.steps[2]], ergebnis: 'α ≈ ' + C.fmtDe(t.alpha, 1) + '°', set: { sub: 'tri', known: 'ab', v1: '1,5', v2: '6' } }); }
  { const v = [25.02, 24.98, 25.01, 25.03, 24.96], s = C.stats(v, 3); bs.push({ id: 'mb7', tab: 'mess', titel: 'Messwerte: Mittelwert und Streuung', aufgabe: 'Fünf Messungen (mm): 25,02; 24,98; 25,01; 25,03; 24,96. Mittelwert, Median, Spannweite und Standardabweichung?', steps: s.steps, ergebnis: `x̄ = ${fmt(s.mean)} mm, Median = ${fmt(s.median)} mm, R = ${fmt(s.range)} mm, s ≈ ${fmt(rd(s.stdev, 3))} mm`, set: { txt: '25,02 24,98 25,01 25,03 24,96' } }); }
  { const u = C.umformung('draht', 'A'), env = { rho: 0.0178, l: 50, R: 0.5 }, v = C.solveFor('draht', 'A', env); bs.push({ id: 'mb8', tab: 'umst', titel: 'Leiterwiderstand: Querschnitt einer Kupferleitung', aufgabe: 'Eine 50 m lange Kupferleitung (ρ = 0,0178 Ω·mm²/m) soll höchstens 0,5 Ω haben. Welchen Querschnitt braucht sie mindestens? Stelle R = ρ · l / A nach A um.', steps: ['Start: ' + C.pretty(u.start), ...u.steps.map(s => s.op + ':  ' + C.pretty(s.eq)), C.calcLine('A', u.expr, env, 2, 'mm²'), 'Probe: 0,0178 · 50 / 1,78 = 0,5 Ω ✓'], ergebnis: 'A = ' + fmt(rd(v, 2)) + ' mm²', set: { f: 'draht', t: 'A' } }); }
  { const u = C.umformung('ladung', 't'), env = { Q: 2400, I: 300 }, v = C.solveFor('ladung', 't', env); bs.push({ id: 'mb9', tab: 'umst', titel: 'Akku: Laufzeit aus Ladung und Strom', aufgabe: 'Ein Akku hat 2400 mAh. Ein Gerät nimmt 300 mA auf. Wie lange läuft es? Stelle Q = I · t nach t um.', steps: ['Start: ' + C.pretty(u.start), ...u.steps.map(s => s.op + ':  ' + C.pretty(s.eq)), C.calcLine('t', u.expr, env, 1, 'h')], ergebnis: 't = ' + fmt(rd(v, 1)) + ' h', set: { f: 'ladung', t: 't' } }); }
  function fmtMoney(v) { return C.fmtDe(v, 2); }

  root.MAT_DATA = { tasks, beispiele: bs, cats, build };
  root.MAT_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.MAT_DATA, TASKS: root.MAT_TASKS, build, tasks, beispiele: bs };
})(typeof window !== 'undefined' ? window : globalThis);
