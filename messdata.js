'use strict';
/* Tonfunk MessLab: Beispiele und Aufgaben (Messaufgaben mit Zahlenfeldern, Messfehler, Fehlersuche).
   Wird von mess.js über MESS_DATA(api) geladen. Die Zahlen der Aufgaben stammen aus der Simulation oder aus einfacher Rechnung. */
(function (root) {
  root.MESS_DATA = function (api) {
    const RES = api.RES, KD = api.KINDS;
    const ex = (cat, name, info, make) => ({ lab: 'mess', cat, name, info, make });
    const PSU = (v, extra, x) => ['BAT', x || 2, 4, 1, String(v), Object.assign({ vr: 'psu' }, extra || {})];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const part = l => api.sch.parts.find(p => p.l === l);
    const kindPart = k => api.sch.parts.find(p => p.k === k);
    const partI = (E, p) => { const e = E.c.elems.filter(x => x.part && x.part.id === p.id)[0]; return e ? (e.type === 'V' ? -e.i : e.i) : NaN; };
    const evalNow = (t) => { const E = api.simEval(); E.run(t || 0.2); return E; };
    const avgOf = (p, secs) => { const E = api.simEval(); let s = 0, n = 0; for (let k = 0; k < Math.round(secs / 0.0005); k++) { E.run(0.0005); const v = api.vAcross(E, p); if (isFinite(v)) { s += v; n++; } } return n ? s / n : NaN; };
    const genOf = p => { const s = String(p.v).replace(',', '.'), f = s.match(/([0-9]*\.?[0-9]+)\s*([kM]?)\s*Hz/i), a = s.match(/([0-9]*\.?[0-9]+)\s*(m?)\s*V/); return { f: f ? parseFloat(f[1]) * ({ k: 1e3, K: 1e3, M: 1e6 }[f[2]] || 1) : 1000, a: a ? parseFloat(a[1]) * (a[2] === 'm' ? 1e-3 : 1) : 5, w: p.vr || 'sin' }; };
    const fmtF = f => f >= 1e3 ? (f / 1e3) + 'kHz' : f + 'Hz';
    const meterSet = (dial, jack) => { const m = api.meter; if (!m) return; api.meterDial(dial); m.jack = jack || 'V'; m.fuse = false; m.fuse10 = false; api.meterReset(); };

    /* ---------------- Beispiele ---------------- */
    const EX = [
      ex('Multimeter', 'Spannung messen: Spannungsteiler', 'Zwei Widerstände teilen 9 V. Stelle das Multimeter auf V⎓ und miss an R1 und R2.', () => ({ parts: [PSU(9, null, 4), ['R', 8, 2, 1, '1k', { l: 'R1' }], ['R', 8, 6, 1, '2k', { l: 'R2' }], ['GND', 4, 10]], wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8]], scopes: [] })),
      ex('Multimeter', 'Strom messen: Reihenschaltung', 'Das Amperemeter (AM) liegt in Reihe. Probiere auch das Multimeter im Bereich A: Dort tippst du das Bauteil an.', () => ({ parts: [PSU(9), ['R', 2, 2, 0, '1k', { l: 'R1' }], ['AM', 6, 2, 0, ''], ['R', 10, 2, 1, '2k', { l: 'R2' }]], wires: [[2, 4, 2, 2], [10, 6, 10, 8, 2, 8]], scopes: [] })),
      ex('Multimeter', 'Widerstand messen (spannungsfrei)', 'Ein Netz aus drei Widerständen. Stelle das Multimeter auf Ω und setze die Messspitzen an A und B. Der Ohm-Bereich braucht Ruhe: Simulation pausieren.', () => ({ parts: [['R', 2, 2, 0, '220', { l: 'R1' }], ['R', 6, 2, 1, '330', { l: 'R2' }], ['R', 10, 2, 1, '470', { l: 'R3' }]], wires: [[6, 2, 10, 2], [6, 6, 10, 6]], scopes: [] })),
      ex('Multimeter', 'Knotenregel: Parallelschaltung', 'Der Gesamtstrom teilt sich auf. Miss I1, I2 und den Gesamtstrom und vergleiche.', () => ({ parts: [PSU(12), ['R', 6, 2, 1, '1k', { l: 'R1' }], ['R', 10, 2, 1, '470', { l: 'R2' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2, 6, 2], [6, 2, 10, 2], [6, 6, 6, 8, 2, 8], [10, 6, 10, 8, 6, 8]], scopes: [] })),
      ex('Netzgerät', 'Netzgerät: Konstantspannung (CV)', '12 V, Strombegrenzung 100 mA, Last 1 kΩ. Der Strom ist klein, die Spannung bleibt. Öffne die Werkbank und sieh dir CV und CC an.', () => ({ parts: [PSU(12, { imax: '100mA' }), ['R', 2, 2, 0, '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [] })),
      ex('Netzgerät', 'Netzgerät: Strombegrenzung (CC)', 'Die Last wäre für 176 mA gut, das Netzgerät erlaubt nur 30 mA: Die Spannung bricht auf etwa 2 V ein, es leuchtet CC.', () => ({ parts: [PSU(12, { imax: '30mA' }), ['R', 2, 2, 0, '68', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [0] , win: 0.02 })),
      ex('Netzgerät', 'LED direkt am Netzgerät (mit Strombegrenzung)', 'Ohne Vorwiderstand würde die LED verbrennen. Die Strombegrenzung von 20 mA schützt sie.', () => ({ parts: [PSU(5, { imax: '20mA' }), ['LED', 2, 2, 0, 'rot', { l: 'LED1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [] })),
      ex('Oszilloskop', 'Sinus am Oszilloskop', '5 V und 1 kHz. Öffne die Werkbank, setze am Oszilloskop einen Messpunkt auf den Generator und lies Periodendauer und Spitze-Spitze-Spannung ab.', () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz', { l: 'G1' }], ['R', 2, 2, 0, '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [0], tempo: 0.3, win: 0.006 })),
      ex('Oszilloskop', 'RC-Tiefpass mit Rechteck', 'Das Rechteck lädt den Kondensator über 1 kΩ. Die Zeitkonstante beträgt 0,1 ms. Miss sie mit den Cursorn.', () => ({ parts: [['AC', 2, 4, 1, '5V 500Hz', { l: 'G1', vr: 'sq' }], ['R', 2, 2, 0, '1k', { l: 'R1' }], ['C', 6, 2, 1, '100n', { l: 'C1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2], tempo: 0.3, win: 0.004 })),
      ex('Oszilloskop', 'Einweggleichrichter', 'Eine Diode lässt nur die positiven Halbwellen durch. Vergleiche Spitzenwert, Mittelwert und Effektivwert.', () => ({ parts: [['AC', 2, 4, 1, '10V 50Hz', { l: 'G1' }], ['D', 2, 2, 0, '1N4007', { l: 'D1' }], ['R', 6, 2, 1, '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2], tempo: 0.4, win: 0.06 })),
      ex('Oszilloskop', 'Dreieck und Frequenzzähler', 'Ein Dreieck mit 2,5 kHz. Der Frequenzzähler in der Werkbank zeigt die genaue Frequenz.', () => ({ parts: [['AC', 2, 4, 1, '3V 2.5kHz', { l: 'G1', vr: 'tri' }], ['R', 2, 2, 0, '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [0], tempo: 0.3, win: 0.003 })),
      ex('Leistung und Kennlinien', 'Leistung messen: Glühlampe', '6 V und 0,1 A: Der Leistungsmesser in der Werkbank zeigt Spannung, Strom, Leistung und die verbrauchte Energie.', () => ({ parts: [PSU(6), ['LAMP', 2, 2, 0, '6V 0.1A', { l: 'H1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [] })),
      ex('Leistung und Kennlinien', 'Kennlinie der Diode', 'Der Kennlinienschreiber zeichnet Strom über Spannung. Die Diode leitet erst oberhalb von etwa 0,6 V.', () => ({ parts: [PSU(5), ['R', 2, 2, 0, '430', { l: 'R1' }], ['D', 6, 2, 1, '1N4007', { l: 'D1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] })),
      ex('Leistung und Kennlinien', 'Kennlinie der LED', 'Eine rote LED braucht etwa 1,9 V, bevor sie leuchtet: deutlich mehr als eine Siliziumdiode.', () => ({ parts: [PSU(5), ['R', 2, 2, 0, '620', { l: 'R1' }], ['LED', 6, 2, 1, 'rot', { l: 'LED1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] })),
      ex('Leistung und Kennlinien', 'Kennlinie der Z-Diode', 'In Sperrrichtung leitet die Z-Diode ab der Z-Spannung (hier 5,1 V). Der Kennlinienschreiber zeigt beide Richtungen.', () => ({ parts: [PSU(12), ['R', 2, 2, 0, '470', { l: 'R1' }], ['ZD', 6, 6, 3, '5.1', { l: 'D1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] })),
      ex('Leistung und Kennlinien', 'Kennlinie des Heißleiters (NTC)', 'Der Widerstand eines NTC ändert sich mit der Temperatur: Tippe den NTC an und stelle die Temperatur ein, dann nimm die Kennlinie auf.', () => ({ parts: [PSU(5), ['R', 2, 2, 0, '100', { l: 'R1' }], ['NTC', 6, 2, 1, '10k', { l: 'RT1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] })),
      ex('Messfehler', 'Messfehler: das Voltmeter belastet', 'Zwei Widerstände mit je 1 MΩ teilen 10 V in 5 V und 5 V. Das Voltmeter hat selbst 10 MΩ und zieht Strom: Es zeigt weniger als 5 V.', () => ({ parts: [PSU(10, null, 4), ['R', 8, 2, 1, '1M', { l: 'R1' }], ['R', 8, 6, 1, '1M', { l: 'R2' }], ['VM', 12, 6, 1, '', { l: 'V1' }], ['GND', 4, 10]], wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8], [8, 6, 12, 6], [12, 10, 8, 10]], scopes: [] })),
      ex('Messfehler', 'Messfehler: Strommesser mit Innenwiderstand', 'Ein einfaches Strommessgerät hat 10 Ω Innenwiderstand (als Widerstand „Ri“ gezeichnet). Der Strom ist kleiner als ohne Messgerät.', () => ({ parts: [PSU(3), ['R', 2, 2, 0, '47', { l: 'R1' }], ['R', 6, 2, 0, '10', { l: 'Ri' }], ['AM', 10, 2, 1, '', { l: 'A1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [10, 6, 10, 8, 2, 8]], scopes: [] })),
      ex('Messfehler', 'Messfehler: Generator mit 50 Ω Innenwiderstand', 'Der Funktionsgenerator hat 50 Ω Ausgangswiderstand. Mit einer 50-Ω-Last bleibt nur die halbe Spannung übrig. Ändere die Last auf 10 kΩ und vergleiche.', () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz', { l: 'G1' }], ['R', 2, 2, 0, '50', { l: 'RL' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [0], tempo: 0.3, win: 0.006 })),
      ex('Messfehler', 'Wheatstone-Brücke', 'Die Brücke mit R4 = 1,2 kΩ ist leicht verstimmt. Das Voltmeter in der Mitte zeigt die Brückenspannung, bei R4 = 1 kΩ wäre sie null.', () => ({ parts: [PSU(5, null, 4), ['R', 8, 2, 1, '1k', { l: 'R1' }], ['R', 8, 6, 1, '1k', { l: 'R3' }], ['R', 14, 2, 1, '1k', { l: 'R2' }], ['R', 14, 6, 1, '1.2k', { l: 'R4' }], ['VM', 8, 6, 0, '', { l: 'V1' }], ['GND', 4, 10]], wires: [[4, 4, 4, 2, 8, 2], [8, 2, 14, 2], [8, 10, 4, 10, 4, 8], [14, 10, 8, 10], [12, 6, 14, 6]], scopes: [] }))
    ];
    api.addExamples(EX); root.MESS_EX = EX;

    /* ---------------- Aufgaben ---------------- */
    const near = (a, b, tol) => isFinite(a) && isFinite(b) && Math.abs(a - b) <= Math.max(Math.abs(b) * tol, 1e-9);
    function fieldLines(t) {
      const A = root.TaskAns.get(t.id), out = [];
      (t.fields || []).forEach(f => {
        const raw = A[f.id], a = root.MessParse(raw, f.unit); let tr = NaN; try { tr = f.truth(); } catch (e) { tr = NaN; }
        const tol = f.tol != null ? f.tol : 0.04;
        if (raw == null || String(raw).trim() === '') { out.push(RES(false, f.label + ': noch keine Zahl eingetragen')); return; }
        if (!isFinite(a)) { out.push(RES(false, f.label + ': „' + raw + '“ ist keine Zahl')); return; }
        if (near(a, tr, tol)) out.push(RES(true, f.label + ': stimmt (Toleranz ' + Math.round(tol * 100) + ' %)'));
        else if (near(a, tr, 0.35)) out.push(RES(false, f.label + ': fast, aber zu ungenau. Miss noch einmal genauer.'));
        else if (isFinite(tr) && tr !== 0 && (near(a * 1000, tr, 0.08) || near(a / 1000, tr, 0.08))) out.push(RES(false, f.label + ': die Zehnerpotenz stimmt nicht (milli, kilo, Mega?)'));
        else out.push(RES(false, f.label + ': der Wert passt nicht zur Schaltung'));
      });
      (t.choices || []).forEach(q => { const v = A[q.id]; out.push(RES(v === q.right, v == null ? q.short + ': keine Antwort gewählt' : (v === q.right ? q.short + ': richtig' : q.short + ': leider falsch, lies die Frage noch einmal'))); });
      return out;
    }
    const HOW = {
      m1: 'Spannungsteiler: U2 = U · R2 / (R1 + R2). Die Teilspannungen ergeben zusammen die Batteriespannung.',
      m2: 'Reihenschaltung: I = U / (R1 + R2). Der Strom ist überall gleich groß.',
      m3: 'Zwei Widerstände parallel: R = R2 · R3 / (R2 + R3). Dazu kommt R1 in Reihe. Der Ohm-Bereich misst nur spannungsfrei.',
      m4: 'Jeder Zweig: I = U / R. Der Gesamtstrom ist die Summe der Zweigströme (Knotenregel).',
      m5: 'P = U · I. Warte, bis die Anzeige ruhig steht. Die Lampe ist ein Glühfaden, ihr Widerstand ändert sich mit der Temperatur.',
      m6: 'LED-Strom: I = (U − UF) / R mit UF etwa 1,9 V bei einer roten LED.',
      m8: 'Periodendauer T = Kästchen waagerecht · Zeit je Kästchen. Frequenz f = 1 / T. Spitze-Spitze = Kästchen senkrecht · Volt je Kästchen.',
      m9: 'Beim Sinus gilt Ueff = Umax / √2 ≈ 0,707 · Umax. Uss = 2 · Umax.',
      m10: 'Eine Halbwelle hat den Mittelwert Umax / π. Von Umax ziehst du etwa 0,7 V Diodenspannung ab.',
      m11: 'τ = R · C. Nach der Zeit τ hat der Kondensator 63 % des Sprungs erreicht. Setze den Cursor auf die Flanke und auf 63 %.',
      m12: 'f = 1 / T. Der Zähler braucht einige Perioden, bis er einen Wert zeigt.',
      m13: 'Eine Siliziumdiode hat bei 10 mA etwa 0,65 bis 0,75 V Durchlassspannung. Kontrolle: I = (5 V − UF) / 430 Ω.',
      m14: 'Die Spannung an der Z-Diode ist etwa ihre Z-Spannung. Strom durch R1: (12 V − UZ) / 470 Ω.',
      m15: '1 MΩ parallel 10 MΩ = 0,91 MΩ. Dann Spannungsteiler: U = 10 V · 0,91 / (1 + 0,91). Messfehler = (Anzeige − Sollwert) / Sollwert.',
      m16: 'V⎓ misst Gleichspannung (Batterie), V∿ Wechselspannung. Die Spannung an R2 ist 9 V · 2 kΩ / 3 kΩ = 6 V.',
      m17: 'Strom gehört in eine Strombuchse (mA oder 10 A). Strom in Reihe: I = 9 V / 3 kΩ = 3 mA.',
      m20: 'Der Tastkopf teilt durch 10. Stelle am Oszilloskop den Faktor ebenfalls auf ×10, dann stimmt die Anzeige. Uss = 2 · Umax.',
      m21: 'Bei Strombegrenzung gilt U = I · R = 30 mA · 68 Ω ≈ 2 V.',
      m22: 'Spannung zwischen den Mittelpunkten: U = 5 V · (R4 / (R2 + R4)) − 5 V · (R3 / (R1 + R3)). Abgeglichen bei R1/R3 = R2/R4.',
      m23: 'Eine rote LED hat bei etwa 5 mA rund 1,8 bis 2 V Durchlassspannung.'
    };
    const WHY = [
      ['Drehschalter', 'V⎓ misst Gleichspannung, V∿ Wechselspannung. Eine Batterie liefert Gleichspannung: Im Bereich V∿ zeigt das Gerät 0 V.'],
      ['Buchse', 'Spannung misst du in der Buchse VΩ, Strom in mA oder 10 A. Die Strombuchsen haben fast keinen Widerstand: Bei Spannung wäre das ein Kurzschluss, bei Strom in VΩ zeigt das Gerät 0.'],
      ['Strommesser', 'Ein Strommesser gehört in Reihe: Der Strom muss durch ihn hindurch fließen. Parallel zum Verbraucher legt er ihn praktisch kurz.'],
      ['Voltmeter zeigt', 'Ein Voltmeter misst parallel zum Bauteil: beide Anschlüsse an die zwei Punkte, zwischen denen du die Spannung wissen willst. In Reihe lässt es fast keinen Strom durch.'],
      ['Spannung steht', 'Am Netzgerät stellst du die Spannung mit dem oberen Regler ein, die Strombegrenzung mit dem Haken und dem unteren Regler.'],
      ['Strombegrenzung', 'Die Strombegrenzung stellst du getrennt von der Spannung ein (Haken setzen, dann den Strom wählen).'],
      ['Kurvenform', 'Der Funktionsgenerator hat drei Kurvenformen: Sinus, Rechteck, Dreieck. Wähle sie mit den Tasten im Gerät.'],
      ['Frequenz stimmt', 'Gib die Frequenz im Gerät ein, zum Beispiel „2k“ für 2 kHz.'],
      ['Amplitude', 'Die Amplitude ist der Spitzenwert in Volt (nicht Spitze-Spitze).'],
      ['Tastkopf', 'Tastkopf-Schalter und Kanal-Faktor müssen übereinstimmen, sonst ist die Anzeige um den Faktor 10 falsch.'],
      ['Kanal-Faktor', 'Tastkopf-Schalter und Kanal-Faktor müssen übereinstimmen, sonst ist die Anzeige um den Faktor 10 falsch.'],
      ['abgeglichen', 'Eine Brücke ist abgeglichen, wenn R1 / R3 = R2 / R4 gilt. Dann ist die Spannung zwischen den Mittelpunkten null.'],
      ['Strommesser misst', 'Der Strommesser muss im Weg des Stroms liegen, nicht neben dem Widerstand. Entferne die Drähte, die ihn neben R2 legen, und setze ihn zwischen R1 und R2.'],
      ['Voltmeter', 'Ein Voltmeter liegt parallel zum Bauteil. Verbinde beide Anschlüsse mit den zwei Anschlüssen von R2.']
    ];
    const fixWhy = (t, L) => { L.forEach(l => { if (l.ok || l.why) return; const m = WHY.find(w => l.text.indexOf(w[0]) >= 0); if (m) l.why = m[1]; else if (HOW[t.id] && /passt nicht|ungenau|Zehnerpotenz/.test(l.text)) l.why = /Zehnerpotenz/.test(l.text) ? 'Prüfe die Einheit neben dem Feld: Milli (m) heißt tausendmal kleiner, Kilo (k) tausendmal größer. 1000 mA sind 1 A.' : HOW[t.id]; }); return L; };
    const mk = t => Object.assign({ lab: 'mess' }, t, { check() { const L = (t.pre ? t.pre() : []).concat(fieldLines(t)); return fixWhy(t, L.length ? L : [RES(false, 'Keine Prüfung')]); } });
    const sol = (id, o) => () => o;     // Platzhalter für kurze Schreibweise

    /* Schaltungen der Aufgaben als Funktionen (mit Zufallsanteil) */
    const divider = (U, r1, r2, extra) => ({ parts: [PSU(U, null, 4), ['R', 8, 2, 1, r1, { l: 'R1' }], ['R', 8, 6, 1, r2, { l: 'R2' }], ['GND', 4, 10]].concat(extra || []), wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8]], scopes: [] });
    const series2 = (U, r1, r2) => ({ parts: [PSU(U), ['R', 2, 2, 0, r1, { l: 'R1' }], ['R', 6, 2, 0, r2, { l: 'R2' }]], wires: [[2, 4, 2, 2], [10, 2, 10, 8, 2, 8]], scopes: [] });
    const par2 = (U, r1, r2) => ({ parts: [PSU(U), ['R', 6, 2, 1, r1, { l: 'R1' }], ['R', 10, 2, 1, r2, { l: 'R2' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2, 6, 2], [6, 2, 10, 2], [6, 6, 6, 8, 2, 8], [10, 6, 10, 8, 6, 8]], scopes: [] });
    const net3 = () => ({ parts: [['R', 2, 2, 0, '220', { l: 'R1' }], ['R', 6, 2, 1, '330', { l: 'R2' }], ['R', 10, 2, 1, '470', { l: 'R3' }]], wires: [[6, 2, 10, 2], [6, 6, 10, 6]], scopes: [] });
    const genLoad = (v, w, rl, sc, win) => ({ parts: [['AC', 2, 4, 1, v, { l: 'G1', vr: w || 'sin' }], ['R', 2, 2, 0, rl || '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: sc || [0], tempo: 0.3, win: win || 0.006 });
    const ledCirc = (U, r, imax) => ({ parts: [PSU(U, imax ? { imax } : {}), ['R', 2, 2, 0, r, { l: 'R1' }], ['LED', 6, 2, 1, 'rot', { l: 'LED1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] });
    const zCirc = (defect) => ({ parts: [PSU(12), ['R', 2, 2, 0, '470', { l: 'R1' }], ['ZD', 6, 6, 3, '5.1', Object.assign({ l: 'D1' }, defect ? { defect } : {})], ['R', 10, 2, 1, '1k', { l: 'RL' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8], [6, 2, 10, 2], [10, 6, 10, 8, 6, 8]], scopes: [] });
    const bridge = (r4) => ({ parts: [PSU(5, null, 4), ['R', 8, 2, 1, '1k', { l: 'R1' }], ['R', 8, 6, 1, '1k', { l: 'R3' }], ['R', 14, 2, 1, '1k', { l: 'R2' }], ['R', 14, 6, 1, r4, { l: 'R4' }], ['VM', 8, 6, 0, '', { l: 'V1' }], ['GND', 4, 10]], wires: [[4, 4, 4, 2, 8, 2], [8, 2, 14, 2], [8, 10, 4, 10, 4, 8], [14, 10, 8, 10], [12, 6, 14, 6]], scopes: [] });

    let cur8 = null, cur9 = null, cur11 = null, cur12 = null;
    const roll8 = () => ({ a: pick([2, 3, 4, 5]), f: pick([400, 500, 800, 1250, 2000, 2500]), w: pick(['sin', 'sq', 'tri']) });
    const roll11 = () => { const R = pick([4.7e3, 10e3, 22e3]), C = pick([22e-9, 47e-9, 100e-9]), tau = R * C; return { R, C, f: Math.round(1 / (14 * tau) / 10) * 10 || 50, tau }; };
    const rTxt = r => r >= 1e3 ? (r / 1e3) + 'k' : String(r), cTxt = c => (c * 1e9) + 'n';
    const T8 = r => genLoad(r.a + 'V ' + fmtF(r.f), r.w, '1k', [0], 3 / r.f);
    const T9 = r => genLoad(r.a + 'V 1kHz', 'sin', '1k', [0], 0.004);
    const T11 = r => ({ parts: [['AC', 2, 4, 1, '5V ' + r.f + 'Hz', { l: 'G1', vr: 'sq' }], ['R', 2, 2, 0, rTxt(r.R), { l: 'R1' }], ['C', 6, 2, 1, cTxt(r.C), { l: 'C1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2], tempo: 0.3, win: 4 / r.f });
    const T12 = r => genLoad((pick([1, 2, 3])) + 'V ' + fmtF(r.f), 'tri', '1k', [0], 3 / r.f);
    const rollF = () => ({ f: pick([1200, 1800, 3300, 7500, 12500, 33000]) });

    const TASKS = [
      mk({ id: 'm1', cat: 'Multimeter', title: 'Spannungen am Teiler messen', level: 1, text: 'Ein Spannungsteiler aus R1 = 1 kΩ und R2 = 2 kΩ liegt an 9 V. Miss mit dem Multimeter (Bereich V⎓) die Spannung an R1 und an R2 und trage die Werte ein.',
        hint: 'Erst den Schalter auf V⎓, rote Buchse VΩ. Dann „Messspitzen setzen“ und nacheinander die zwei Anschlüsse jedes Widerstands antippen: erst rot, dann schwarz.',
        start: () => divider(9, '1k', '2k'), solMake: () => divider(9, '1k', '2k'), solAns: () => ({ u1: '3', u2: '6' }),
        fields: [{ id: 'u1', label: 'Spannung an R1', unit: 'V', truth: () => 3 }, { id: 'u2', label: 'Spannung an R2', unit: 'V', truth: () => 6 }] }),
      mk({ id: 'm2', cat: 'Multimeter', title: 'Strom in der Reihenschaltung', level: 1, text: 'R1 = 1 kΩ und R2 = 2 kΩ liegen in Reihe an 9 V. Miss den Strom mit dem Multimeter im Bereich A (rote Leitung in die mA-Buchse). Trage den Strom in Milliampere ein.',
        hint: 'Strom misst du im Messbereich A mit der Buchse mA. Dann das Bauteil antippen, durch das der Strom fließt. Das Messgerät gehört in Reihe, das macht das Programm für dich.',
        start: () => series2(9, '1k', '2k'), solMake: () => series2(9, '1k', '2k'), solAns: () => ({ i: '3' }),
        fields: [{ id: 'i', label: 'Strom', unit: 'mA', truth: () => 0.003 }] }),
      mk({ id: 'm3', cat: 'Multimeter', title: 'Widerstand eines Netzes messen', level: 2, text: 'Drei Widerstände (R1 = 220 Ω in Reihe zu R2 = 330 Ω parallel R3 = 470 Ω). Miss den Gesamtwiderstand zwischen dem linken Ende von R1 und dem unteren Knoten.',
        hint: 'Der Ohm-Bereich misst nur spannungsfrei. Stelle das Multimeter auf Ω, setze die rote Spitze an das linke Ende von R1 und die schwarze an den unteren Knoten (unten bei R2/R3). Zum Nachrechnen: R2 parallel R3, dann R1 addieren.',
        start: net3, solMake: net3, solAns: () => ({ r: '414' }),
        fields: [{ id: 'r', label: 'Gesamtwiderstand', unit: 'Ω', tol: 0.02, truth: () => 220 + 330 * 470 / 800 }] }),
      mk({ id: 'm4', cat: 'Multimeter', title: 'Knotenregel mit drei Strommessungen', level: 2, text: 'An 12 V liegen R1 = 1 kΩ und R2 = 470 Ω parallel. Miss die Ströme I1 durch R1, I2 durch R2 und den Gesamtstrom (Stromquelle). Trage die Werte in mA ein.',
        hint: 'Strom misst du im Bereich A. Tippe nacheinander R1, R2 und die Batterie an. Der Gesamtstrom ist die Summe der beiden Zweigströme.',
        start: () => par2(12, '1k', '470'), solMake: () => par2(12, '1k', '470'), solAns: () => ({ i1: '12', i2: '25.5', ig: '37.5' }),
        fields: [{ id: 'i1', label: 'Strom durch R1', unit: 'mA', truth: () => 0.012 }, { id: 'i2', label: 'Strom durch R2', unit: 'mA', truth: () => 12 / 470 }, { id: 'ig', label: 'Gesamtstrom', unit: 'mA', truth: () => 0.012 + 12 / 470 }] }),
      mk({ id: 'm5', cat: 'Leistung und Kennlinien', title: 'Leistung der Glühlampe', level: 2, text: 'Eine Lampe (6 V, 0,1 A) hängt an 6 V. Öffne die Werkbank und lies am Leistungsmesser Spannung, Strom und Leistung ab. Trage die Werte ein.',
        hint: 'Werkbank öffnen und den Leistungsmesser einschalten, dann die Lampe H1 auswählen. Die Leistung ist Spannung mal Strom. Warte, bis die Anzeige ruhig steht.',
        start: () => ({ parts: [PSU(6), ['LAMP', 2, 2, 0, '6V 0.1A', { l: 'H1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [] }),
        solMake: () => ({ parts: [PSU(6), ['LAMP', 2, 2, 0, '6V 0.1A', { l: 'H1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [] }),
        solAns: () => { const E = evalNow(0.4), p = part('H1'); return { u: String(+Math.abs(api.vAcross(E, p)).toFixed(3)), i: String(+(Math.abs(partI(E, p)) * 1000).toFixed(2)), p: String(+(Math.abs(api.vAcross(E, p) * partI(E, p)) * 1000).toFixed(1)) }; },
        fields: [{ id: 'u', label: 'Spannung an der Lampe', unit: 'V', truth: () => Math.abs(api.vAcross(evalNow(0.4), part('H1'))) }, { id: 'i', label: 'Strom', unit: 'mA', truth: () => { const E = evalNow(0.4); return Math.abs(partI(E, part('H1'))); } }, { id: 'p', label: 'Leistung', unit: 'mW', truth: () => { const E = evalNow(0.4), p = part('H1'); return Math.abs(api.vAcross(E, p) * partI(E, p)); }, tol: 0.06 }] }),
      mk({ id: 'm6', cat: 'Netzgerät und Generator', title: 'Netzgerät für die LED einstellen', level: 1, text: 'Stelle das Netzgerät auf 5 V und eine Strombegrenzung von 25 mA ein (Werkbank, Netzgerät). Die LED hat einen Vorwiderstand von 330 Ω. Miss danach den LED-Strom in mA.',
        hint: 'In der Werkbank das Netzgerät öffnen: Regler Spannung auf 5 V, Haken bei Strombegrenzung setzen und 25 mA einstellen. Den Strom misst du mit dem Multimeter im Bereich A an der LED.',
        pre: () => { const p = kindPart('BAT'), u = p ? parseFloat(String(p.v).replace(',', '.')) : NaN, im = p ? String(p.imax || '').replace(',', '.').match(/([0-9.]+)\s*(m?)A/i) : null, mA = im ? parseFloat(im[1]) * (im[2] ? 1 : 1000) : NaN; return [RES(near(u, 5, 0.01), near(u, 5, 0.01) ? 'Spannung steht auf 5 V' : 'Spannung ist nicht auf 5 V eingestellt'), RES(near(mA, 25, 0.02), near(mA, 25, 0.02) ? 'Strombegrenzung steht auf 25 mA' : 'Die Strombegrenzung steht nicht auf 25 mA')]; },
        start: () => ledCirc(12, '330'), solMake: () => ledCirc(5, '330', '25mA'), solAns: () => ({ i: '9.4' }),
        fields: [{ id: 'i', label: 'LED-Strom', unit: 'mA', tol: 0.08, truth: () => { const E = evalNow(0.3); return Math.abs(partI(E, part('LED1'))); } }] }),
      mk({ id: 'm7', cat: 'Netzgerät und Generator', title: 'Funktionsgenerator einstellen', level: 1, text: 'Stelle den Funktionsgenerator G1 auf eine Rechteckspannung mit 2 kHz und einer Amplitude (Spitzenwert) von 3 V ein.',
        hint: 'Werkbank öffnen, Funktionsgenerator wählen: Kurvenform Rechteck, Frequenz „2k“ eintragen, Amplitude „3“ eintragen.',
        pre: () => { const g = part('G1'); if (!g) return [RES(false, 'Der Generator G1 fehlt')]; const c = genOf(g); return [RES(g.vr === 'sq', g.vr === 'sq' ? 'Kurvenform Rechteck' : 'Die Kurvenform muss Rechteck sein'), RES(near(c.f, 2000, 0.01), near(c.f, 2000, 0.01) ? 'Frequenz 2 kHz' : 'Die Frequenz stimmt noch nicht (2 kHz)'), RES(near(c.a, 3, 0.01), near(c.a, 3, 0.01) ? 'Amplitude 3 V' : 'Die Amplitude stimmt noch nicht (3 V Spitze)')]; },
        start: () => genLoad('5V 1kHz', 'sin', '1k', [0], 0.004), solMake: () => genLoad('3V 2kHz', 'sq', '1k', [0], 0.004), fields: [] }),
      mk({ id: 'm8', cat: 'Oszilloskop', title: 'Periodendauer und Frequenz ablesen', level: 2, rand: true, text: 'Der Generator G1 liefert ein Signal, dessen Werte du nicht ablesen darfst. Setze am Oszilloskop (Werkbank) einen Messpunkt auf G1 und bestimme die Spitze-Spitze-Spannung, die Periodendauer und die Frequenz.',
        hint: 'Werkbank, Oszilloskop: „Messpunkt setzen“, dann den Generator antippen. Zeit pro Kästchen so wählen, dass etwa zwei Perioden zu sehen sind. Die Messwerte stehen unter dem Bild. Die Frequenz ist 1 geteilt durch die Periodendauer.',
        start: () => T8(cur8 = roll8()), solMake: () => T8(cur8 || (cur8 = roll8())),
        solAns: () => { const c = genOf(part('G1')); return { uss: String(2 * c.a), t: String(+(1e3 / c.f).toFixed(4)), f: String(c.f) }; },
        fields: [{ id: 'uss', label: 'Spitze-Spitze-Spannung', unit: 'V', truth: () => 2 * genOf(part('G1')).a, tol: 0.05 }, { id: 't', label: 'Periodendauer', unit: 'ms', truth: () => 1 / genOf(part('G1')).f, tol: 0.05 }, { id: 'f', label: 'Frequenz', unit: 'Hz', truth: () => genOf(part('G1')).f, tol: 0.05 }] }),
      mk({ id: 'm9', cat: 'Oszilloskop', title: 'Spitzenwert und Effektivwert', level: 2, rand: true, text: 'Der Generator G1 liefert eine Sinusspannung. Miss am Oszilloskop den Spitzenwert (Umax) und den Effektivwert (Ueff) und trage sie ein.',
        hint: 'Messpunkt auf G1 setzen. Umax ist der höchste Wert der Kurve. Beim Sinus gilt: Ueff = Umax geteilt durch Wurzel 2 (also etwa 0,707 mal Umax). Das Oszilloskop zeigt beide Werte unter dem Bild.',
        start: () => T9(cur9 = { a: pick([2, 3, 5, 6]) }), solMake: () => T9(cur9 || (cur9 = { a: 3 })),
        solAns: () => { const a = genOf(part('G1')).a; return { um: String(a), ue: String(+(a / Math.SQRT2).toFixed(3)) }; },
        fields: [{ id: 'um', label: 'Spitzenwert Umax', unit: 'V', truth: () => genOf(part('G1')).a, tol: 0.05 }, { id: 'ue', label: 'Effektivwert Ueff', unit: 'V', truth: () => genOf(part('G1')).a / Math.SQRT2, tol: 0.06 }] }),
      mk({ id: 'm10', cat: 'Oszilloskop', title: 'Gleichrichter: Mittelwert messen', level: 3, text: 'Ein Einweggleichrichter (10 V, 50 Hz, Diode, 1 kΩ) speist R1. Miss die mittlere Spannung an R1 mit dem Multimeter im Bereich V⎓. Sieh dir die Kurve zusätzlich am Oszilloskop an.',
        hint: 'Das Multimeter im Bereich V⎓ mittelt die schnell wechselnde Spannung (Gleichanteil). Messspitzen an beide Anschlüsse von R1. Die Anzeige braucht etwa eine halbe Sekunde, bis sie ruhig steht.',
        start: () => ({ parts: [['AC', 2, 4, 1, '10V 50Hz', { l: 'G1' }], ['D', 2, 2, 0, '1N4007', { l: 'D1' }], ['R', 6, 2, 1, '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2], tempo: 0.4, win: 0.06 }),
        solMake: () => ({ parts: [['AC', 2, 4, 1, '10V 50Hz', { l: 'G1' }], ['D', 2, 2, 0, '1N4007', { l: 'D1' }], ['R', 6, 2, 1, '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2], tempo: 0.4, win: 0.06 }), solAns: () => ({ um: String(+avgOf(part('R1'), 0.12).toFixed(3)) }),
        fields: [{ id: 'um', label: 'Mittelwert an R1', unit: 'V', tol: 0.08, truth: () => avgOf(part('R1'), 0.12) }] }),
      mk({ id: 'm11', cat: 'Oszilloskop', title: 'Zeitkonstante am RC-Glied messen', level: 3, rand: true, text: 'Ein Rechteck lädt über R1 den Kondensator C1. Lies am Oszilloskop mit den Cursorn die Zeit ab, in der die Kondensatorspannung 63 % des Sprungs erreicht. Das ist die Zeitkonstante τ. Trage sie in Millisekunden ein.',
        hint: 'Setze die Messpunkte auf G1 und C1. Stelle die Zeit so ein, dass die Ladekurve gut zu sehen ist. Der Sprung ist 10 V groß (von −5 V auf +5 V), 63 % davon sind 6,3 V über dem Startwert. Cursor 1 auf die Flanke, Cursor 2 bei 63 %. Zur Kontrolle: τ = R mal C.',
        start: () => T11(cur11 = roll11()), solMake: () => T11(cur11 || (cur11 = roll11())),
        solAns: () => { const R = api.sch.parts.find(p => p.l === 'R1'), C = api.sch.parts.find(p => p.l === 'C1'); const si = s => { const m = String(s).match(/([0-9.]+)\s*([pnuµmkM]?)/); return parseFloat(m[1]) * ({ p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, M: 1e6 }[m[2]] || 1); }; return { tau: String(+(si(R.v) * si(C.v) * 1e3).toFixed(4)) }; },
        fields: [{ id: 'tau', label: 'Zeitkonstante τ', unit: 'ms', tol: 0.15, truth: () => { const si = s => { const m = String(s).match(/([0-9.]+)\s*([pnuµmkM]?)/); return parseFloat(m[1]) * ({ p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, M: 1e6 }[m[2]] || 1); }; return si(part('R1').v) * si(part('C1').v); } }] }),
      mk({ id: 'm12', cat: 'Oszilloskop', title: 'Frequenz mit dem Frequenzzähler messen', level: 2, rand: true, text: 'Der Generator G1 liefert ein Dreieck. Öffne in der Werkbank das Oszilloskop und den Frequenzzähler und bestimme die Frequenz in Kilohertz.',
        hint: 'Am Oszilloskop einen Messpunkt auf G1 setzen, dann in der Werkbank den Frequenzzähler einschalten (Kanal K1). Er zeigt die Frequenz nach einigen Perioden an.',
        start: () => T12(cur12 = rollF()), solMake: () => T12(cur12 || (cur12 = rollF())), solAns: () => ({ f: String(+(genOf(part('G1')).f / 1000).toFixed(3)) }),
        fields: [{ id: 'f', label: 'Frequenz', unit: 'kHz', tol: 0.02, truth: () => genOf(part('G1')).f }] }),
      mk({ id: 'm13', cat: 'Leistung und Kennlinien', title: 'Durchlassspannung der Diode', level: 2, text: 'Die Diode D1 bekommt über R1 = 430 Ω etwa 10 mA. Miss die Spannung an der Diode (Durchlassspannung UF) und lies den Strom ab. Trage UF in Volt ein.',
        hint: 'Multimeter V⎓ an beide Anschlüsse von D1. Eine Siliziumdiode hat bei 10 mA etwa 0,65 bis 0,75 V. Zur Kontrolle: Der Strom ist (5 V − UF) geteilt durch 430 Ω.',
        start: () => ({ parts: [PSU(5), ['R', 2, 2, 0, '430', { l: 'R1' }], ['D', 6, 2, 1, '1N4007', { l: 'D1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] }),
        solMake: () => ({ parts: [PSU(5), ['R', 2, 2, 0, '430', { l: 'R1' }], ['D', 6, 2, 1, '1N4007', { l: 'D1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] }),
        solAns: () => ({ uf: String(+api.vAcross(evalNow(0.3), part('D1')).toFixed(3)) }),
        fields: [{ id: 'uf', label: 'Durchlassspannung UF', unit: 'V', tol: 0.04, truth: () => api.vAcross(evalNow(0.3), part('D1')) }] }),
      mk({ id: 'm14', cat: 'Leistung und Kennlinien', title: 'Z-Spannung und Z-Strom messen', level: 2, text: 'Eine Z-Diode (5,1 V) wird über 470 Ω an 12 V betrieben. Miss die Spannung an der Z-Diode und den Strom durch die Z-Diode (mA).',
        hint: 'Die Spannung an der Z-Diode misst du mit V⎓ an ihren zwei Anschlüssen. Den Strom misst du im Bereich A (Z-Diode antippen). Nachrechnen: Der Strom durch R1 ist (12 V − UZ) geteilt durch 470 Ω.',
        start: () => ({ parts: [PSU(12), ['R', 2, 2, 0, '470', { l: 'R1' }], ['ZD', 6, 6, 3, '5.1', { l: 'D1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] }),
        solMake: () => ({ parts: [PSU(12), ['R', 2, 2, 0, '470', { l: 'R1' }], ['ZD', 6, 6, 3, '5.1', { l: 'D1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [] }),
        solAns: () => { const E = evalNow(0.3), p = part('D1'); return { uz: String(+Math.abs(api.vAcross(E, p)).toFixed(3)), iz: String(+(Math.abs(partI(E, p)) * 1000).toFixed(2)) }; },
        fields: [{ id: 'uz', label: 'Spannung an der Z-Diode', unit: 'V', tol: 0.04, truth: () => Math.abs(api.vAcross(evalNow(0.3), part('D1'))) }, { id: 'iz', label: 'Strom durch die Z-Diode', unit: 'mA', tol: 0.06, truth: () => Math.abs(partI(evalNow(0.3), part('D1'))) }] }),
      mk({ id: 'm15', cat: 'Messfehler', title: 'Das Voltmeter belastet den Teiler', level: 3, text: 'Zwei Widerstände mit je 1 MΩ teilen 10 V. Rechnerisch müssten an R2 genau 5 V liegen. Lies die Anzeige des Voltmeters V1 ab und berechne den Messfehler in Prozent (bezogen auf 5 V). Beantworte außerdem die Frage zur Ursache.',
        hint: 'Das Voltmeter hat selbst einen Widerstand (Innenwiderstand 10 MΩ) und liegt parallel zu R2. Dadurch sinkt der Gesamtwiderstand der unteren Hälfte, und die Spannung bricht ein. Messfehler = (Anzeige − Sollwert) geteilt durch Sollwert.',
        start: () => ({ parts: [PSU(10, null, 4), ['R', 8, 2, 1, '1M', { l: 'R1' }], ['R', 8, 6, 1, '1M', { l: 'R2' }], ['VM', 12, 6, 1, '', { l: 'V1' }], ['GND', 4, 10]], wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8], [8, 6, 12, 6], [12, 10, 8, 10]], scopes: [] }),
        solMake: () => ({ parts: [PSU(10, null, 4), ['R', 8, 2, 1, '1M', { l: 'R1' }], ['R', 8, 6, 1, '1M', { l: 'R2' }], ['VM', 12, 6, 1, '', { l: 'V1' }], ['GND', 4, 10]], wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8], [8, 6, 12, 6], [12, 10, 8, 10]], scopes: [] }),
        solAns: () => { const u = Math.abs(api.vAcross(evalNow(0.4), part('V1'))); return { ud: String(+u.toFixed(3)), err: String(+Math.abs((u - 5) / 5 * 100).toFixed(2)), why: 0 }; },
        fields: [{ id: 'ud', label: 'Anzeige des Voltmeters', unit: 'V', tol: 0.02, truth: () => Math.abs(api.vAcross(evalNow(0.4), part('V1'))) }, { id: 'err', label: 'Messfehler (Betrag)', unit: '%', tol: 0.25, truth: () => Math.abs((Math.abs(api.vAcross(evalNow(0.4), part('V1'))) - 5) / 5 * 100) }],
        choices: [{ id: 'why', q: 'Warum zeigt das Voltmeter weniger als 5 V?', short: 'Ursache', right: 0, opts: ['Das Voltmeter hat einen endlichen Innenwiderstand und liegt parallel zu R2: Es zieht einen kleinen Strom.', 'Das Voltmeter ist defekt.', 'Die Batterie liefert weniger als 10 V.', 'Die Widerstände sind nicht genau gleich.'] }] }),
      mk({ id: 'm16', cat: 'Messfehler', title: 'Das Multimeter zeigt 0 V', level: 1, text: 'An R2 liegen 6 V an, aber das Multimeter zeigt 0,000 V. Finde die falsche Einstellung, behebe sie und trage die Spannung an R2 ein.',
        hint: 'Es gibt zwei Spannungsbereiche: V⎓ für Gleichspannung und V∿ für Wechselspannung. Die Batterie liefert Gleichspannung. Probiere V⎓.',
        pre: () => [RES(api.meter && api.meter.dial === 'V=', api.meter && api.meter.dial === 'V=' ? 'Bereich V⎓ eingestellt' : 'Der Drehschalter steht nicht auf V⎓')],
        start: () => { meterSet('V~', 'V'); return divider(9, '1k', '2k'); }, solMake: () => { meterSet('V=', 'V'); return divider(9, '1k', '2k'); }, solAns: () => ({ u: '6' }),
        fields: [{ id: 'u', label: 'Spannung an R2', unit: 'V', truth: () => 6 }] }),
      mk({ id: 'm17', cat: 'Messfehler', title: 'Strom messen, aber 0,000 A', level: 2, text: 'In der Reihenschaltung (9 V, 1 kΩ, 2 kΩ) soll der Strom gemessen werden. Das Multimeter steht auf A, zeigt aber 0,000 A. Behebe den Fehler und trage den Strom in mA ein.',
        hint: 'Beim Strommessen gehört die rote Leitung in eine Strombuchse (mA oder 10 A), nicht in die Buchse VΩ. Bei einem Strom von wenigen mA nimmst du die mA-Buchse.',
        pre: () => [RES(api.meter && api.meter.jack === 'mA', api.meter && api.meter.jack === 'mA' ? 'Buchse mA gewählt' : 'Für diesen Strom gehört die rote Leitung in die mA-Buchse')],
        start: () => { meterSet('A', 'V'); return series2(9, '1k', '2k'); }, solMake: () => { meterSet('A', 'mA'); return series2(9, '1k', '2k'); }, solAns: () => ({ i: '3' }),
        fields: [{ id: 'i', label: 'Strom', unit: 'mA', truth: () => 0.003 }] }),
      mk({ id: 'm18', cat: 'Messfehler', title: 'Strommesser parallel statt in Reihe', level: 2, text: 'Der Strommesser AM liegt parallel zu R2 und schließt ihn kurz: Er zeigt 9 mA statt 3 mA. Baue die Schaltung so um, dass AM den Strom der Reihenschaltung misst (R1 und R2 müssen weiter wirken).',
        hint: 'Ein Strommesser gehört in Reihe in den Stromkreis: Der Strom muss durch ihn hindurch fließen. Lösche die zwei Drähte, die AM neben R2 legen, und setze AM zwischen R1 und R2.',
        pre: () => { const E = evalNow(0.3), am = kindPart('AM'), r2 = part('R2'); if (!am || !r2) return [RES(false, 'AM oder R2 fehlt')]; const i = Math.abs(partI(E, am)), u2 = Math.abs(api.vAcross(E, r2)); return [RES(near(i, 0.003, 0.05), near(i, 0.003, 0.05) ? 'Der Strommesser misst den Strom der Reihenschaltung (3 mA)' : 'Der Strommesser zeigt nicht den Strom der Reihenschaltung'), RES(near(u2, 6, 0.05), near(u2, 6, 0.05) ? 'R2 liegt an 6 V' : 'An R2 liegen nicht 6 V: der Strommesser darf R2 nicht überbrücken')]; },
        start: () => ({ parts: [PSU(9), ['R', 2, 2, 0, '1k', { l: 'R1' }], ['R', 6, 2, 1, '2k', { l: 'R2' }], ['AM', 10, 2, 1, '', { l: 'A1' }]], wires: [[2, 4, 2, 2], [6, 2, 10, 2], [6, 6, 6, 8, 2, 8], [10, 6, 6, 6]], scopes: [] }),
        solMake: () => ({ parts: [PSU(9), ['R', 2, 2, 0, '1k', { l: 'R1' }], ['AM', 6, 2, 0, '', { l: 'A1' }], ['R', 10, 2, 1, '2k', { l: 'R2' }]], wires: [[2, 4, 2, 2], [10, 6, 10, 8, 2, 8]], scopes: [] }), fields: [] }),
      mk({ id: 'm19', cat: 'Messfehler', title: 'Voltmeter in Reihe statt parallel', level: 2, text: 'Das Voltmeter V1 soll die Spannung an R2 messen, liegt aber in Reihe zu R2 und zeigt fast 9 V. Ändere die Schaltung so, dass V1 parallel zu R2 liegt und etwa 6 V anzeigt.',
        hint: 'Ein Voltmeter misst die Spannung zwischen zwei Punkten und liegt deshalb parallel zum Bauteil. Entferne die Verbindung, die V1 in den Stromkreis legt, und verbinde beide Anschlüsse von V1 mit den Anschlüssen von R2.',
        pre: () => { const E = evalNow(0.3), v = kindPart('VM'); if (!v) return [RES(false, 'Das Voltmeter fehlt')]; const u = Math.abs(api.vAcross(E, v)); return [RES(near(u, 6, 0.05), near(u, 6, 0.05) ? 'Das Voltmeter zeigt 6 V' : 'Das Voltmeter zeigt noch nicht die Spannung an R2 (' + api.fmt(u, 'V') + ')')]; },
        start: () => ({ parts: [PSU(9), ['R', 2, 2, 0, '1k', { l: 'R1' }], ['VM', 6, 2, 0, '', { l: 'V1' }], ['R', 10, 2, 1, '2k', { l: 'R2' }]], wires: [[2, 4, 2, 2], [10, 6, 10, 8, 2, 8]], scopes: [] }),
        solMake: () => ({ parts: [PSU(9), ['R', 2, 2, 0, '1k', { l: 'R1' }], ['R', 6, 2, 1, '2k', { l: 'R2' }], ['VM', 10, 2, 1, '', { l: 'V1' }]], wires: [[2, 4, 2, 2], [6, 2, 10, 2], [6, 6, 6, 8, 2, 8], [10, 6, 6, 6]], scopes: [] }), fields: [] }),
      mk({ id: 'm20', cat: 'Messfehler', title: 'Tastkopf ×10 richtig einstellen', level: 3, text: 'Am Oszilloskop ist der Tastkopf auf ×10 geschaltet, damit größere Spannungen gemessen werden können. Stelle den Tastkopf-Schalter und den Kanal-Faktor von K1 beide auf ×10, damit die Anzeige stimmt. Lies dann die Spitze-Spitze-Spannung ab.',
        hint: 'Werkbank, Oszilloskop, Messpunkt auf G1 setzen. Dann „Tastkopf-Schalter ×“ und „Kanal-Faktor ×“ auf 10 stellen. Wenn die beiden nicht übereinstimmen, zeigt das Oszilloskop einen zehnmal zu kleinen oder zu großen Wert an.',
        pre: () => { const o = root.MESS_BENCH && root.MESS_BENCH.osc, c = o && o.ch[0]; return [RES(!!c && c.px === 10, c && c.px === 10 ? 'Tastkopf-Schalter auf ×10' : 'Tastkopf-Schalter von K1 steht nicht auf ×10'), RES(!!c && c.ps === 10, c && c.ps === 10 ? 'Kanal-Faktor auf ×10' : 'Kanal-Faktor von K1 steht nicht auf ×10 (die Anzeige wäre falsch)')]; },
        start: () => { const o = root.MESS_BENCH && root.MESS_BENCH.osc; if (o) { o.ch[0].px = 1; o.ch[0].ps = 1; } return genLoad('4V 1kHz', 'sin', '1k', [0], 0.004); }, solMake: () => { const o = root.MESS_BENCH && root.MESS_BENCH.osc; if (o) { o.ch[0].px = 10; o.ch[0].ps = 10; } return genLoad('4V 1kHz', 'sin', '1k', [0], 0.004); }, solAns: () => ({ uss: '8' }),
        fields: [{ id: 'uss', label: 'Spitze-Spitze-Spannung', unit: 'V', tol: 0.05, truth: () => 2 * genOf(part('G1')).a }] }),
      mk({ id: 'm21', cat: 'Netzgerät und Generator', title: 'CC: Warum bricht die Spannung ein?', level: 2, text: 'Das Netzgerät ist auf 12 V eingestellt, die Strombegrenzung auf 30 mA. An der 68-Ω-Last misst du aber viel weniger. Lies die Spannung an R1 ab und beantworte die Frage.',
        hint: 'Rechne: 12 V an 68 Ω würden 176 mA ziehen. Das Netzgerät erlaubt aber nur 30 mA. Dann gilt die Strombegrenzung (CC), und die Spannung ergibt sich aus U = I mal R.',
        start: () => ({ parts: [PSU(12, { imax: '30mA' }), ['R', 2, 2, 0, '68', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [] }),
        solMake: () => ({ parts: [PSU(12, { imax: '30mA' }), ['R', 2, 2, 0, '68', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 6, 8, 2, 8]], scopes: [] }), solAns: () => ({ u: '2.04', why: 1 }),
        fields: [{ id: 'u', label: 'Spannung an R1', unit: 'V', tol: 0.05, truth: () => Math.abs(api.vAcross(evalNow(0.4), part('R1'))) }],
        choices: [{ id: 'why', q: 'Was ist hier passiert?', short: 'Ursache', right: 1, opts: ['Das Netzgerät ist defekt.', 'Die Strombegrenzung greift (CC): Das Netzgerät hält den Strom bei 30 mA und lässt die Spannung sinken.', 'Der Widerstand hat sich erwärmt.', 'Die Leitungen sind zu dünn.'] }] }),
      mk({ id: 'm22', cat: 'Messfehler', title: 'Wheatstone-Brücke abgleichen', level: 3, text: 'Die Brücke ist verstimmt (R4 = 1,2 kΩ). Miss die Brückenspannung am Voltmeter V1 in Millivolt. Ändere dann R4 so, dass die Brücke abgeglichen ist (Voltmeter zeigt etwa 0 V).',
        hint: 'Die Brücke ist abgeglichen, wenn R1 geteilt durch R3 gleich R2 geteilt durch R4 ist. Alle anderen Widerstände haben 1 kΩ. Welchen Wert muss R4 haben? Tippe R4 an und ändere den Wert.',
        pre: () => { const E = evalNow(0.3), v = part('V1'); if (!v) return [RES(false, 'V1 fehlt')]; const u = Math.abs(api.vAcross(E, v)); return [RES(u < 0.01, u < 0.01 ? 'Die Brücke ist abgeglichen' : 'Die Brücke ist noch nicht abgeglichen (' + api.fmt(u, 'V') + ')')]; },
        start: () => bridge('1.2k'), solMake: () => bridge('1k'), solAns: () => ({ ub: '227' }),
        fields: [{ id: 'ub', label: 'Brückenspannung vor dem Abgleich (Betrag)', unit: 'mV', tol: 0.06, truth: () => 0.2273 }] }),
      mk({ id: 'm23', cat: 'Leistung und Kennlinien', title: 'Durchlassspannung der roten LED', level: 2, text: 'Eine rote LED wird über 620 Ω an 5 V betrieben (etwa 5 mA). Miss mit dem Multimeter die Spannung an der LED. Vergleiche sie mit der Siliziumdiode (etwa 0,7 V) und nimm mit dem Kennlinienschreiber die Kennlinie auf.',
        hint: 'Multimeter V⎓ an die zwei Anschlüsse der LED. Eine rote LED hat eine Durchlassspannung von etwa 1,8 bis 2 V. Der Kennlinienschreiber ist in der Werkbank.',
        start: () => ledCirc(5, '620'), solMake: () => ledCirc(5, '620'), solAns: () => ({ uf: String(+Math.abs(api.vAcross(evalNow(0.3), part('LED1'))).toFixed(3)) }),
        fields: [{ id: 'uf', label: 'Spannung an der LED', unit: 'V', tol: 0.04, truth: () => Math.abs(api.vAcross(evalNow(0.3), part('LED1'))) }] }),
      /* Fehlersuche mit Messgeräten */
      { id: 'mf1', lab: 'mess', cat: 'Fehlersuche', title: 'Fehlersuche: Widerstandskette', level: 2, debug: true, faultLabel: 'R2', sol: 'x',
        solMake: () => chain3(false),
        start: () => ({ parts: [PSU(12, null, 4), ['R', 8, 2, 1, '1k', { l: 'R1' }], ['R', 8, 6, 1, '1k', { l: 'R2', defect: 'open' }], ['R', 8, 10, 1, '1k', { l: 'R3' }], ['GND', 4, 14]], wires: [[4, 4, 4, 2, 8, 2], [8, 14, 4, 14, 4, 8]], scopes: [] }),
        text: 'Drei gleiche Widerstände liegen in Reihe an 12 V. Jeder müsste 4 V bekommen. Miss die Spannungen mit dem Multimeter und finde den defekten Widerstand.',
        hint: 'Bei einer Unterbrechung fällt die ganze Spannung an der defekten Stelle ab, an den anderen liegt dann nichts. Miss an jedem Widerstand einzeln.' },
      { id: 'mf2', lab: 'mess', cat: 'Fehlersuche', title: 'Fehlersuche: die LED bleibt dunkel', level: 2, debug: true, faultLabel: 'R1', sol: 'x', solMake: () => ledCircDefect(false),
        start: () => ledCircDefect(true),
        text: 'Die LED leuchtet nicht, obwohl das Netzgerät 9 V liefert. Miss die Spannungen an Vorwiderstand und LED und melde das defekte Bauteil.',
        hint: 'Wenn der Stromkreis unterbrochen ist, liegt an der unterbrochenen Stelle die ganze Spannung und an den anderen Bauteilen nichts.' },
      { id: 'mf3', lab: 'mess', cat: 'Fehlersuche', title: 'Fehlersuche: Z-Diode-Stabilisierung', level: 3, debug: true, faultLabel: 'D1', sol: 'x', solMake: () => zCirc(),
        start: () => zCirc('open'),
        text: 'Die Last RL sollte 5,1 V bekommen, bekommt aber viel mehr. Miss die Spannungen und melde das defekte Bauteil.',
        hint: 'Vergleiche die Spannung an RL mit der Z-Spannung. Eine unterbrochene Z-Diode begrenzt nichts mehr: Die Spannung am Lastwiderstand steigt auf den Wert des Spannungsteilers aus R1 und RL.' }
    ];
    function chain3(bad) { return { parts: [PSU(12, null, 4), ['R', 8, 2, 1, '1k', { l: 'R1' }], ['R', 8, 6, 1, '1k', Object.assign({ l: 'R2' }, bad ? { defect: 'open' } : {})], ['R', 8, 10, 1, '1k', { l: 'R3' }], ['GND', 4, 14]], wires: [[4, 4, 4, 2, 8, 2], [8, 14, 4, 14, 4, 8]], scopes: [] }; }
    function ledCircDefect(bad) { return { parts: [PSU(9), ['SPST', 2, 2, 0, '', { sw: 1, l: 'S1' }], ['R', 6, 2, 0, '470', Object.assign({ l: 'R1' }, bad ? { defect: 'open' } : {})], ['LED', 10, 2, 1, 'rot', { l: 'LED1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [10, 6, 10, 8, 2, 8]], scopes: [] }; }
    api.addTasks(TASKS);
    root.MESS_TASKS = TASKS;
  };
})(window);
