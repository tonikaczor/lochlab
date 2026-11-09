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
  const cats = ['Einheiten', 'Dreisatz', 'Prozent', 'Umstellen', 'Geometrie', 'Messwerte'];

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
      return umst('kreis', 'd', { A }, 1, `Eine Kreisscheibe hat eine Fläche von ${fmt(A)} mm². Wie groß ist ihr Durchmesser?`);
    }],
    ['Umstellen', 2, 'Dichte: Masse bestimmen', R => {
      const [mat, rho] = pick(R, [['Aluminium', 2.7], ['Stahl', 7.85], ['Kupfer', 8.9], ['Blei', 11.34]]), V = pick(R, [20, 50, 120, 250]);
      return umst('dichte', 'm', { rho, V }, 1, `Ein Block aus ${mat} (Dichte ${fmt(rho)} g/cm³) hat ein Volumen von ${V} cm³. Welche Masse hat er?`);
    }],
    /* ===== Geometrie ===== */
    ['Geometrie', 1, 'Kreisfläche', R => {
      const d = pick(R, [10, 12, 20, 25, 40, 50]), g = C.geo('kreis', { d }, 'mm', 1), A = g.results[1];
      return { text: `Wie groß ist die Fläche einer Kreisscheibe mit dem Durchmesser ${d} mm? (π vom Taschenrechner)`, unit: 'mm²', raw: A.value, dec: 1, steps: [A.line], meta: { d }, tips: ['Kreisfläche: A = π · d² / 4 (mit dem Durchmesser) oder A = π · r².', `Rechne d² = ${d} · ${d}, mal π, durch 4.`] };
    }],
    ['Geometrie', 2, 'Unterlegscheibe (Kreisring)', R => {
      const D = pick(R, [20, 24, 30, 40]), d = pick(R, [6, 8, 10, 12]), g = C.geo('ring', { D, d }, 'mm', 1), A = g.results[0];
      return { text: `Eine Unterlegscheibe hat außen ${D} mm und innen ${d} mm Durchmesser. Wie groß ist ihre Fläche?`, unit: 'mm²', raw: A.value, dec: 1, steps: ['Ring = große Kreisfläche − kleine Kreisfläche', A.line], meta: { D, d }, tips: ['Berechne die Fläche des Außenkreises und ziehe die Fläche des Lochs ab.', 'A = π · (D² − d²) / 4. Rechne erst die Klammer.'] };
    }],
    ['Geometrie', 2, 'Zylindervolumen', R => {
      const d = pick(R, [2, 4, 5, 8]), h = pick(R, [10, 12, 15, 20]), g = C.geo('zylinder', { d, h }, 'cm', 1), V = g.results[0];
      return { text: `Ein Zylinder hat den Durchmesser ${d} cm und die Höhe ${h} cm. Wie groß ist sein Volumen?`, unit: 'cm³', raw: V.value, dec: 1, steps: ['Volumen = Grundfläche · Höhe', V.line], meta: { d, h }, tips: ['Volumen = Grundfläche (Kreis) mal Höhe.', 'V = π · d² / 4 · h. Alle Längen in cm einsetzen, dann kommt cm³ heraus.'] };
    }],
    ['Geometrie', 3, 'Masse einer Welle', R => {
      const d = pick(R, [8, 10, 12, 20]), h = pick(R, [40, 50, 80, 100]), [mat, rho] = pick(R, [['Stahl', 7.85], ['Aluminium', 2.7], ['Messing', 8.4], ['Kupfer', 8.9]]), V = Math.PI * d * d / 4 * h, m = rho * V / 1000;
      return { text: `Eine Welle aus ${mat} (Dichte ${fmt(rho)} g/cm³) hat ${d} cm Durchmesser und ${h} cm Länge. Welche Masse hat sie in kg?`, unit: 'kg', raw: m, dec: 2, meta: { d, h, rho },
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
      if (wl) return { text: kopf + ' Wie lang ist der Draht?', unit: 'm', raw: l, dec: 1, meta: { d, D, N, rho, wl }, steps: s1, tips: ['Eine Windung ist ein Kreis mit dem Umfang U = π · D. Der Draht ist N-mal so lang.', `Rechne π · ${D} mm · ${N} und wandle von mm in m um (durch 1000).`] };
      return { text: kopf + ' Wie groß ist der Widerstand der Wicklung?', unit: OHM, raw: Rw, dec: 1, meta: { d, D, N, rho, wl }, steps: [...s1, `Drahtquerschnitt: A = π · d² / 4 = π · ${fmt(d)}² / 4 = ${fmt(rd(A, 4), 4)} mm²`, `R = ρ · l / A = 0,0178 · ${fmt(rd(l, 2), 2)} / ${fmt(rd(A, 4), 4)} = ${fmt(rd(Rw, 2), 2)} Ω`], tips: ['Zuerst die Drahtlänge: eine Windung ist ein Kreis (Umfang π · D), mal die Zahl der Windungen. Dann den Querschnitt des Drahtes als Kreis.', 'Dann R = ρ · l / A mit l in m und A in mm². Rechne mit den ungerundeten Zwischenwerten weiter.'] };
    }],
    ['Umstellen', 3, 'Widerstand bei anderer Temperatur', R => {
      const al = 0.0039, R20 = pick(R, [8, 12, 25, 40, 60]), th = pick(R, [50, 60, 80, 100, 120]), dR = al * R20 * (th - 20), Rw = rd(R20 + dR, 2);
      if (R() < 0.5) return { text: `Eine Kupferwicklung hat bei 20 °C einen Widerstand von ${R20} Ω (Temperaturbeiwert von Kupfer α = 0,0039 1/K). Wie groß ist ihr Widerstand bei ${th} °C?`, unit: 'Ω', raw: R20 + dR, dec: 2, meta: { al, R20, th, rev: false }, steps: [`Temperaturdifferenz: Δϑ = ${th} °C − 20 °C = ${th - 20} K`, `Widerstandsänderung: ΔR = α · R20 · Δϑ = 0,0039 1/K · ${R20} Ω · ${th - 20} K = ${fmt(rd(dR, 3), 3)} Ω`, `R = R20 + ΔR = ${R20} Ω + ${fmt(rd(dR, 3), 3)} Ω = ${fmt(rd(R20 + dR, 3), 3)} Ω`], tips: ['Kupfer wird bei Erwärmung hochohmiger. Zuerst die Temperaturdifferenz Δϑ zu 20 °C bilden.', 'ΔR = α · R20 · Δϑ. Dann ist der warme Widerstand R20 + ΔR.'] };
      const th2 = pick(R, [45, 55, 70, 85, 95, 110]), W2 = rd(R20 * (1 + al * (th2 - 20)), 2);
      return { text: `Die Kupferwicklung eines Motors hat bei 20 °C einen Widerstand von ${R20} Ω. Nach längerem Betrieb misst man ${fmt(W2)} Ω (α = 0,0039 1/K). Welche Temperatur hat die Wicklung?`, unit: '°C', raw: 20 + (W2 / R20 - 1) / al, dec: 0, meta: { al, R20, W2, rev: true }, steps: [`Widerstandsänderung: ΔR = ${fmt(W2)} Ω − ${R20} Ω = ${fmt(rd(W2 - R20, 3), 3)} Ω`, `Aus ΔR = α · R20 · Δϑ folgt Δϑ = ΔR / (α · R20) = ${fmt(rd(W2 - R20, 3), 3)} Ω / (0,0039 1/K · ${R20} Ω) = ${fmt(rd((W2 - R20) / (al * R20), 1), 1)} K`, `Temperatur: ϑ = 20 °C + Δϑ = ${fmt(rd(20 + (W2 - R20) / (al * R20), 1), 1)} °C`], tips: ['Der Widerstand ist um ΔR = R warm − R20 gestiegen. Daraus lässt sich die Temperaturdifferenz berechnen.', 'Stelle ΔR = α · R20 · Δϑ nach Δϑ um. Zum Ergebnis kommen die 20 °C Ausgangstemperatur dazu.'] };
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
    }]
  ];
  const tasks = defs.map((d, i) => ({ id: 'mat' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  /* Fertige Aufgabe aus Aufgabe + Seed (gleicher Seed = gleiche Zahlen) */
  function build(t, seed) {
    const R = C.rng(t.id + ':' + (seed == null ? 0 : seed)), g = t.gen(R), value = rd(g.raw, g.dec), exact = value === rs(g.raw), dec = g.dec;
    const tol = exact ? Math.max(1e-6, Math.abs(value) * 1e-6) : Math.pow(10, -dec);
    return { id: t.id, seed, cat: t.cat, level: t.level, title: t.title, text: g.text + (exact ? '' : ' Runde auf ' + dig(dec) + '.'), unit: g.unit, label: g.label || 'Dein Ergebnis', value, tol, dec, exact,
      steps: g.steps.concat(['Ergebnis: ' + fmt(value, Math.max(dec, 0)) + (g.unit ? ' ' + g.unit : '')]), tips: g.tips, svg: g.svg || null, meta: g.meta, raw: g.raw };
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
