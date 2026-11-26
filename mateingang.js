'use strict';
/* Rechen-Lab: Eingangstest (Mathe-Brücke M0). Stellt fest, wo jemand zu Beginn der Ausbildung in Mathe steht.
   5 Themenfelder mit je 4 Fragen (Niveau Ende Klasse 10), Zufallswerte aus einem Startwert, Eingabe als Zahl (Komma, auch Bruch 5/4) oder Auswahl.
   window.MAT_EINGANG { FELDER, bauen(seed), pruefe(q, eingabe), auswerten(fragen, antworten), ampel(n), lies(s) }
   Frage: { id, feld, typ: 'num' | 'sel', text, unit, value, tol, options, richtig, weg: [Zeilen], lsg }
   Die Oberfläche (Reiter "Eingangstest") steht in matui.js. Hier gibt es kein DOM. */
(function (root) {
  const C = root.MAT_CORE || require('./matcore.js');
  const { rng, ri, pick, shuffle, fmt, parseDe, parseBruch, sup, fin, rs } = C;

  /* tab: Reiter im Mathe-Lab, in den "Üben" springt; kat: Aufgabenliste (Brüche haben keinen eigenen Reiter) */
  const FELDER = [
    { k: 'bruch', name: 'Brüche', tab: 'tasks', kat: 'Bruchrechnung' },
    { k: 'proz', name: 'Prozent', tab: 'proz' },
    { k: 'pot', name: 'Potenzen und Vorsätze', tab: 'einh' },
    { k: 'umst', name: 'Formeln umstellen', tab: 'umst' },
    { k: 'drei', name: 'Dreisatz', tab: 'drei' }
  ];
  const PRO_FELD = 4;

  /* ---------- kleine Bausteine ---------- */
  const ggT = (a, b) => b ? ggT(b, a % b) : a;
  const kgV = (a, b) => a / ggT(a, b) * b;
  /* Zahlenfrage; ganz = nur genau dieser Wert zählt, sonst 0,1 % Spielraum (Rundung) */
  const num = (text, value, unit, weg, ganz) => ({ typ: 'num', text, unit: unit || '', value: rs(value), tol: ganz ? 1e-9 : Math.max(1e-9, Math.abs(value) * 0.001), weg });
  /* Auswahlfrage: genau eine richtige und drei falsche Antworten, gemischt */
  const wahl = (R, text, richtig, falsch, weg) => {
    const opts = shuffle(R, [richtig].concat(falsch));
    return { typ: 'sel', text, unit: '', options: opts, richtig: opts.indexOf(richtig), weg };
  };
  const dez = v => fmt(v, 6);

  /* ---------- Fragen-Generatoren: je Feld vier kleine Funktionen (R = Zufallsfunktion) ---------- */
  const GEN = {
    bruch: [
      R => { /* Addition mit verschiedenen Nennern */
        const [b, d] = pick(R, [[2, 4], [4, 8], [2, 5], [5, 10], [4, 5], [2, 10], [4, 10], [5, 20]]), a = ri(R, 1, b - 1), c = ri(R, 1, d - 1), L = kgV(b, d), z = a * (L / b) + c * (L / d);
        return num(`Berechne ${a}/${b} + ${c}/${d}. Du kannst das Ergebnis als Dezimalzahl oder als Bruch eingeben.`, z / L, '',
          [`Hauptnenner: ${L}`, `${a}/${b} = ${a * (L / b)}/${L} und ${c}/${d} = ${c * (L / d)}/${L}`, `Zähler addieren: ${a * (L / b)} + ${c * (L / d)} = ${z}, also ${z}/${L} = ${dez(z / L)}`]);
      },
      R => { /* Multiplikation oder Division */
        const b = pick(R, [2, 4, 5, 8, 10]), a = ri(R, 1, b - 1);
        if (R() < 0.5) {
          const d = pick(R, [2, 4, 5, 10]), c = ri(R, 1, d - 1);
          return num(`Berechne ${a}/${b} · ${c}/${d}. Dezimalzahl oder Bruch.`, a * c / (b * d), '', [`Zähler mal Zähler, Nenner mal Nenner: ${a * c}/${b * d}`, `als Dezimalzahl: ${dez(a * c / (b * d))}`]);
        }
        const q = pick(R, [2, 4, 5, 10]);
        return num(`Berechne ${a}/${b} geteilt durch 1/${q}. Dezimalzahl oder Bruch.`, a * q / b, '', [`Durch einen Bruch teilen heißt: mit dem Kehrwert malnehmen`, `${a}/${b} · ${q}/1 = ${a * q}/${b} = ${dez(a * q / b)}`]);
      },
      R => { /* Parallelschaltung */
        let [a, b] = pick(R, [[20, 20], [30, 60], [12, 6], [10, 40], [15, 10], [60, 20], [40, 40], [100, 25]]); if (R() < 0.5) [a, b] = [b, a];
        const v = a * b / (a + b);
        return num(`Zwei Widerstände mit ${a} Ω und ${b} Ω sind parallel geschaltet. Es gilt 1/Rges = 1/R1 + 1/R2. Wie groß ist Rges?`, v, 'Ω',
          [`1/Rges = 1/${a} + 1/${b} = ${b}/${a * b} + ${a}/${a * b} = ${a + b}/${a * b}`, `Kehrwert bilden: Rges = ${a * b}/${a + b} = ${dez(v)} Ω`]);
      },
      R => { /* typischer Fehler: Zähler und Nenner einzeln addieren */
        const [a, b] = pick(R, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [2, 7]]), r = `${a + b}/${a * b}`;
        return wahl(R, `Was ergibt 1/${a} + 1/${b}?`, r, [`2/${a + b}`, `1/${a + b}`, `1/${a * b}`],
          [`Gleichnamig machen: 1/${a} = ${b}/${a * b} und 1/${b} = ${a}/${a * b}`, `Nur die Zähler werden addiert: ${b} + ${a} = ${a + b}, also ${r}`, `Zähler und Nenner einzeln zu addieren ist ein typischer Fehler.`]);
      }
    ],
    proz: [
      R => {
        const G = pick(R, [80, 120, 150, 250, 400, 600, 800, 1200]), p = pick(R, [3, 5, 8, 12, 15, 18, 20, 25, 35]), W = G * p / 100;
        return num(`Wie viel sind ${p} % von ${G} €?`, W, '€', [`Prozentwert = Grundwert · Prozentsatz`, `${G} € · ${p} / 100 = ${dez(W)} €`]);
      },
      R => {
        if (R() < 0.5) {
          const n = pick(R, [50, 80, 120, 200, 250, 400]), v = n * 1.19;
          return num(`Eine Platine kostet netto ${n} €. Dazu kommen 19 % Mehrwertsteuer. Wie hoch ist der Bruttopreis?`, v, '€', [`Brutto = Netto · 1,19`, `${n} € · 1,19 = ${dez(v)} €`]);
        }
        const P = pick(R, [80, 120, 200, 250, 400]), p = pick(R, [5, 10, 15, 20, 25]), v = P * (100 - p) / 100;
        return num(`Ein Netzteil kostet ${P} €. Bei Abnahme gibt es ${p} % Rabatt. Wie viel musst du zahlen?`, v, '€', [`Rabatt: ${P} € · ${p} / 100 = ${dez(P * p / 100)} €`, `Zu zahlen: ${P} € − ${dez(P * p / 100)} € = ${dez(v)} €`]);
      },
      R => {
        const G = pick(R, [50, 200, 250, 400, 500, 800]), p = pick(R, [2, 4, 6, 8, 10, 12]), W = G * p / 100;
        return num(`Von ${G} gefertigten Baugruppen sind ${W} defekt. Wie viel Prozent sind das?`, p, '%', [`Prozentsatz = Prozentwert / Grundwert`, `${W} / ${G} = ${dez(W / G)} = ${p} %`]);
      },
      R => {
        const G = pick(R, [200, 240, 300, 400, 600, 800]), p = pick(R, [5, 10, 15, 20, 25]), W = G * p / 100;
        return num(`Nach einem Preisnachlass von ${p} % spart man ${W} €. Wie teuer war der Artikel vorher?`, G, '€', [`Grundwert = Prozentwert / Prozentsatz`, `${W} € / ${dez(p / 100)} = ${G} €`]);
      }
    ],
    pot: [
      R => {
        const [von, nach] = pick(R, [['kΩ', 'Ω'], ['µF', 'nF'], ['MHz', 'kHz'], ['V', 'mV'], ['mA', 'µA']]), m = pick(R, [1.5, 2.2, 3.3, 4.7, 6.8, 12, 47]);
        return num(`Rechne ${fmt(m)} ${von} in ${nach} um.`, m * 1000, nach, [`Von ${von} nach ${nach} ist die Einheit 1000-mal kleiner, die Zahl wird 1000-mal größer`, `${fmt(m)} · 1000 = ${dez(m * 1000)} ${nach}`]);
      },
      R => {
        const w = R(), a = ri(R, 2, 6), b = ri(R, 2, 5);
        if (w < 0.34) return num(`Schreibe das Ergebnis als Zehnerpotenz: 10${sup(a)} · 10${sup(b)} = 10ⁿ. Wie groß ist n?`, a + b, '', [`Beim Malnehmen addieren sich die Hochzahlen: ${a} + ${b} = ${a + b}`], true);
        if (w < 0.67) return num(`Schreibe das Ergebnis als Zehnerpotenz: 10${sup(a + b)} : 10${sup(b)} = 10ⁿ. Wie groß ist n?`, a, '', [`Beim Teilen werden die Hochzahlen subtrahiert: ${a + b} − ${b} = ${a}`], true);
        return num(`Schreibe das Ergebnis als Zehnerpotenz: (10${sup(a)})${sup(b)} = 10ⁿ. Wie groß ist n?`, a * b, '', [`Eine Potenz wird potenziert, indem man die Hochzahlen multipliziert: ${a} · ${b} = ${a * b}`], true);
      },
      R => {
        const m = pick(R, [1.5, 2.2, 3.3, 4.7, 6.8]), e = ri(R, 3, 6), t = x => `${fmt(m)} · 10${sup(x)}`;
        return wahl(R, `Wie schreibt man ${fmt(m / Math.pow(10, e), 9)} in wissenschaftlicher Schreibweise?`, t(-e), [t(-e + 1), t(-e - 1), t(e)],
          [`Das Komma wandert so weit nach rechts, bis eine Ziffer ungleich 0 vor dem Komma steht: ${e} Stellen`, `Für Zahlen kleiner als 1 ist die Hochzahl negativ: ${t(-e)}`]);
      },
      R => {
        const [von, nach, f, werte] = pick(R, [['MΩ', 'Ω', 1e6, [2, 2.2, 3.3, 4.7, 5.6]], ['µA', 'A', 1e-6, [10, 47, 220, 470]], ['pF', 'nF', 1e-3, [100, 220, 470, 680]], ['GHz', 'MHz', 1e3, [2, 2.4, 3.6, 5.2]]]), m = pick(R, werte);
        return num(`Rechne ${fmt(m)} ${von} in ${nach} um.`, m * f, nach, [`1 ${von} = ${dez(f)} ${nach}`, `${fmt(m)} · ${dez(f)} = ${dez(m * f)} ${nach}`]);
      }
    ],
    umst: [
      R => {
        const Rw = pick(R, [100, 220, 330, 470, 680]), I = pick(R, [0.01, 0.02, 0.05]), U = Rw * I;
        return num(`Es gilt U = R · I. Gegeben: U = ${dez(U)} V und I = ${dez(I)} A. Berechne R.`, Rw, 'Ω', [`Umstellen: durch I teilen, also R = U / I`, `R = ${dez(U)} V / ${dez(I)} A = ${Rw} Ω`]);
      },
      R => {
        const [a, b, c] = pick(R, [['P', 'U', 'I'], ['U', 'R', 'I'], ['s', 'v', 't'], ['A', 'a', 'b'], ['Q', 'I', 't']]), z = R() < 0.5 ? c : b, o = z === c ? b : c;
        return wahl(R, `Stelle ${a} = ${b} · ${c} nach ${z} um.`, `${z} = ${a} / ${o}`, [`${z} = ${a} · ${o}`, `${z} = ${o} / ${a}`, `${z} = ${a} − ${o}`],
          [`${o} steht als Faktor neben ${z}. Beide Seiten durch ${o} teilen.`, `Ergebnis: ${z} = ${a} / ${o}`]);
      },
      R => {
        const [U, Rw] = pick(R, [[10, 25], [12, 48], [20, 40], [6, 18], [15, 45], [8, 16]]), P = U * U / Rw;
        return num(`Für die Leistung gilt P = U² / R. Gegeben: P = ${dez(P)} W und R = ${Rw} Ω. Berechne U.`, U, 'V', [`Umstellen: mit R malnehmen, dann die Wurzel ziehen: U = √(P · R)`, `U = √(${dez(P)} · ${Rw}) = √${dez(P * Rw)} = ${U} V`]);
      },
      R => {
        const U1 = pick(R, [1.2, 2.2, 3.3]), U2 = pick(R, [0.7, 1.8, 2.7, 4.7]), U3 = pick(R, [2, 3, 4, 5, 6.3]), Ug = rs(U1 + U2 + U3);
        return num(`In einer Reihenschaltung gilt Ug = U1 + U2 + U3. Gegeben: Ug = ${dez(Ug)} V, U1 = ${dez(U1)} V und U2 = ${dez(U2)} V. Berechne U3.`, U3, 'V',
          [`Umstellen: U1 und U2 auf beiden Seiten abziehen, also U3 = Ug − U1 − U2`, `U3 = ${dez(Ug)} − ${dez(U1)} − ${dez(U2)} = ${dez(U3)} V`]);
      }
    ],
    drei: [
      R => {
        const p = pick(R, [0.1, 0.25, 0.3, 0.4, 0.45, 0.6]), a = pick(R, [5, 8, 10, 20, 25]), x = pick(R, [12, 15, 30, 40, 60]), b = rs(a * p);
        return num(`${a} Widerstände kosten zusammen ${dez(b)} €. Was kosten ${x} Widerstände?`, x * p, '€', [`Auf 1 Stück: ${dez(b)} € / ${a} = ${dez(p)} €`, `Auf ${x} Stück: ${dez(p)} € · ${x} = ${dez(x * p)} €`]);
      },
      R => {
        const a = pick(R, [2, 3, 4, 6]), f = pick(R, [2, 3]), b = pick(R, [12, 24, 36, 48]);
        return num(`${a} Lötplätze brauchen für einen Auftrag ${b} Stunden. Wie viele Stunden brauchen ${a * f} Lötplätze?`, b / f, 'h', [`Mehr Plätze, weniger Zeit (umgekehrt proportional)`, `Auf 1 Platz: ${b} h · ${a} = ${b * a} h`, `Auf ${a * f} Plätze: ${b * a} h / ${a * f} = ${dez(b / f)} h`]);
      },
      R => {
        const [a, b, T] = pick(R, [[1, 4, 250], [2, 3, 500], [1, 9, 300], [3, 5, 400], [1, 3, 200], [2, 5, 350]]), v = T * a / (a + b);
        return num(`Ein Reiniger wird im Verhältnis ${a}:${b} (Konzentrat zu Wasser) angesetzt. Insgesamt sollen ${T} ml entstehen. Wie viel ml Konzentrat brauchst du?`, v, 'ml',
          [`Teile insgesamt: ${a} + ${b} = ${a + b}`, `Ein Teil: ${T} ml / ${a + b} = ${dez(T / (a + b))} ml`, `Konzentrat: ${a} Teile = ${dez(v)} ml`]);
      },
      R => {
        const a = pick(R, [30, 45, 60]), s = pick(R, [0.8, 1, 1.2, 1.6]), b = rs(a * s);
        return num(`Ein Fahrzeug legt bei gleichbleibender Geschwindigkeit in ${a} Minuten ${dez(b)} km zurück. Wie viele km sind es in 2 Stunden?`, 120 * s, 'km',
          [`2 Stunden = 120 Minuten`, `Auf 1 Minute: ${dez(b)} km / ${a} = ${dez(s)} km`, `Auf 120 Minuten: ${dez(s)} km · 120 = ${dez(120 * s)} km`]);
      }
    ]
  };

  /* 20 Fragen, nach Feldern geordnet. Gleicher Startwert ergibt gleiche Fragen. */
  function bauen(seed) {
    const out = []; let n = 0;
    FELDER.forEach(f => GEN[f.k].forEach((g, i) => {
      const q = g(rng((seed >>> 0) + (n + 1) * 7919)); n++;
      q.id = f.k + (i + 1); q.feld = f.k;
      q.lsg = q.typ === 'sel' ? q.options[q.richtig] : dez(q.value) + (q.unit ? ' ' + q.unit : '');
      out.push(q);
    }));
    return out;
  }

  /* Eingabe lesen: Dezimalzahl mit Komma oder Punkt, auch Bruch "5/4" oder "1 1/4"; sonst NaN */
  function lies(s) {
    s = String(s == null ? '' : s).trim();
    if (s.indexOf('/') >= 0) { const f = parseBruch(s); return f ? f.z / f.n : NaN; }
    return parseDe(s);
  }

  /* eingabe: Text (typ num) oder Nummer der gewählten Antwort (typ sel); leer = übersprungen = falsch */
  function pruefe(q, eingabe) {
    if (eingabe == null || eingabe === '') return false;
    if (q.typ === 'sel') return +eingabe === q.richtig;
    const v = lies(eingabe);
    return fin(v) && Math.abs(v - q.value) <= q.tol;
  }

  /* grün ab 3 von 4, gelb bei 2, rot bei 0 bis 1 */
  const ampel = n => n >= 3 ? 'gruen' : n === 2 ? 'gelb' : 'rot';

  function auswerten(fragen, antworten) {
    const ok = fragen.map((q, i) => pruefe(q, antworten[i]));
    const felder = FELDER.map(f => {
      const richtig = fragen.reduce((s, q, i) => s + (q.feld === f.k && ok[i] ? 1 : 0), 0);
      return { k: f.k, name: f.name, tab: f.tab, kat: f.kat, richtig, von: PRO_FELD, ampel: ampel(richtig) };
    });
    const richtig = ok.filter(Boolean).length;
    return { ok, felder, richtig, von: fragen.length, prozent: Math.round(100 * richtig / fragen.length) };
  }

  const API = { FELDER, bauen, pruefe, auswerten, ampel, lies };
  root.MAT_EINGANG = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
