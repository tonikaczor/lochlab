'use strict';
/* Tonfunk MessLab: Prüfungsschaltungen im Stil von Teil B der Abschlussprüfung (Stromlaufplan lesen, messen, rechnen, Fehler finden).
   Eigene Schaltungen und Aufgaben (keine Originalpläne). Wird am Ende von MESS_DATA (messdata.js) mit MESS_PRUEF(api, H) geladen.
   Die Schaltungen entstehen aus Teilen und Netzen: routeNets legt die Drähte automatisch. */
(function (root) {
  root.MESS_PRUEF = function (api, H) {
    const { mk, ex, PSU, part, kindPart, partI, evalNow, near, RES } = H;
    const CAT = 'Prüfung: Stromlaufplan';
    const build = (rows, nets) => { const P = api.pinPts(rows), pt = ([r, i]) => P[r][i]; return { parts: rows, wires: api.routeNets(rows, nets.map(n => n.map(pt))), scopes: [] }; };
    const Psu = (v, x, l) => ['BAT', x || 2, 4, 1, String(v), { vr: 'psu', l: l || 'U1' }];
    const Rr = (x, y, r, v, l, extra) => ['R', x, y, r, v, Object.assign({ l }, extra || {})];

    /* ---------------- Schaltungen ---------------- */
    const cLed = r1 => build([Psu(12), Rr(6, 2, 0, r1, 'R1'), ['LED', 10, 2, 1, 'rot', { l: 'LED1' }], ['GND', 2, 10], ['GND', 10, 8]],
      [[[0, 0], [1, 0]], [[1, 1], [2, 0]], [[2, 1], [4, 0]], [[0, 1], [3, 0]]]);
    const cPoti = (open) => build([Psu(9), Rr(8, 2, 1, '2.2k', 'R1'), ['POT', 8, 6, 1, '4.7k', { l: 'P1', pos: 0.5 }], Rr(8, 10, 1, '1k', 'R2', open ? { defect: 'open' } : {}), Rr(14, 8, 1, '100k', 'RL'), ['GND', 2, 10], ['GND', 8, 16], ['GND', 14, 14]],
      [[[0, 0], [1, 0]], [[1, 1], [2, 0]], [[2, 1], [3, 0]], [[3, 1], [6, 0]], [[2, 2], [4, 0]], [[4, 1], [7, 0]], [[0, 1], [5, 0]]]);
    const cOpv = (rg, rf) => build([Psu(9), ['BAT', 2, 14, 1, '0.5', { l: 'Ue', vr: 'psu' }], ['OPA', 20, 10, 0, 'LM358', { l: 'A1' }], Rr(18, 4, 0, rf || '47k', 'Rf'), Rr(14, 12, 1, '10k', 'Rg', rg ? { defect: 'open' } : {}), Rr(28, 11, 1, '10k', 'RL'), ['GND', 2, 10], ['GND', 2, 20], ['GND', 14, 18], ['GND', 28, 17], ['GND', 22, 16]],
      [[[0, 0], [2, 3]], [[0, 1], [6, 0]], [[1, 0], [2, 0]], [[1, 1], [7, 0]], [[2, 2], [3, 1], [5, 0]], [[2, 1], [3, 0], [4, 0]], [[4, 1], [8, 0]], [[5, 1], [9, 0]], [[2, 4], [10, 0]]]);
    const cFolger = () => build([Psu(9), Rr(8, 2, 1, '100k', 'R1'), Rr(8, 8, 1, '100k', 'R2'), ['OPA', 16, 10, 0, 'LM358', { l: 'A1' }], Rr(26, 11, 1, '1k', 'RL'), ['GND', 2, 10], ['GND', 8, 14], ['GND', 26, 17], ['GND', 18, 16]],
      [[[0, 0], [1, 0], [3, 3]], [[1, 1], [2, 0], [3, 0]], [[3, 2], [3, 1], [4, 0]], [[0, 1], [5, 0]], [[2, 1], [6, 0]], [[4, 1], [7, 0]], [[3, 4], [8, 0]]]);
    const cTrans = (open) => build([Psu(12), ['BAT', 2, 14, 1, '5', { l: 'U2', vr: 'psu' }], Rr(8, 10, 0, '4.7k', 'Rb', open ? { defect: 'open' } : {}), ['NPN', 12, 10, 0, 'BC547', { l: 'T1' }], Rr(14, 2, 1, '120', 'RL'), ['GND', 2, 10], ['GND', 2, 20], ['GND', 14, 16]],
      [[[0, 0], [4, 0]], [[1, 0], [2, 0]], [[2, 1], [3, 0]], [[4, 1], [3, 1]], [[3, 2], [7, 0]], [[0, 1], [5, 0]], [[1, 1], [6, 0]]]);
    const cZener = () => build([Psu(12), Rr(6, 2, 0, '330', 'R1'), ['ZD', 12, 8, 3, '5.1', { l: 'D1' }], Rr(16, 2, 1, '1k', 'RL'), ['GND', 2, 10], ['GND', 12, 12], ['GND', 16, 10]],
      [[[0, 0], [1, 0]], [[1, 1], [2, 1], [3, 0]], [[2, 0], [5, 0]], [[3, 1], [6, 0]], [[0, 1], [4, 0]]]);
    const cReg = () => build([Psu(12), ['REG', 6, 2, 0, '7805', { l: 'U3' }], Rr(14, 6, 1, '100', 'RL'), ['GND', 2, 10], ['GND', 8, 8], ['GND', 14, 12]],
      [[[0, 0], [1, 0]], [[1, 2], [2, 0]], [[1, 1], [4, 0]], [[2, 1], [5, 0]], [[0, 1], [3, 0]]]);
    const cKlemm = () => build([Psu(12), ['BAT', 2, 14, 1, '5', { l: 'U2', vr: 'psu' }], Rr(6, 2, 0, '1k', 'R1'), ['SCHOTTKY', 12, 6, 1, '1N5819', { l: 'D1' }], ['GND', 2, 10], ['GND', 2, 20]],
      [[[0, 0], [2, 0]], [[2, 1], [3, 0]], [[3, 1], [1, 0]], [[0, 1], [4, 0]], [[1, 1], [5, 0]]]);
    const cBatt = () => build([Psu(4.5, 2, 'B1'), Rr(6, 2, 0, '2.2', 'Ri'), Rr(12, 6, 1, '10', 'RL'), ['GND', 2, 10], ['GND', 12, 12]],
      [[[0, 0], [1, 0]], [[1, 1], [2, 0]], [[0, 1], [3, 0]], [[2, 1], [4, 0]]]);

    /* ---------------- Messhilfen ---------------- */
    const ev = () => evalNow(0.35);
    const uAcross = (E, l) => Math.abs(api.vAcross(E, part(l)));
    const iThrough = (E, l) => Math.abs(partI(E, part(l)));
    const tpin = (E, i) => api.pinV(E, part('T1'), i);   // Transistor: 0 Kollektor, 1 Basis, 2 Emitter
    const rMeas = v => Math.round(v * 1000) / 1000;
    const sw = o => () => o;

    const EX = [
      ex(CAT, 'Prüfung: LED am Netzgerät', 'Rote LED mit Vorwiderstand an 12 V. Miss Spannung und Strom und prüfe sie am Datenblatt (Durchlassspannung etwa 2 V, höchster Dauerstrom 30 mA).', () => cLed('470')),
      ex(CAT, 'Prüfung: Spannungsteiler mit Poti', 'Das Poti stellt die Spannung am Schleifer ein. Drehe den Regler und miss den Einstellbereich.', () => cPoti(false)),
      ex(CAT, 'Prüfung: Nichtinvertierender Verstärker', 'Der LM358 verstärkt 0,5 V mit Rf = 47 kΩ und Rg = 10 kΩ. Miss die Ausgangsspannung.', () => cOpv(false)),
      ex(CAT, 'Prüfung: Spannungsfolger entkoppelt Teiler', 'Ein hochohmiger Teiler speist über den Spannungsfolger eine 1-kΩ-Last.', () => cFolger()),
      ex(CAT, 'Prüfung: Transistor schaltet Last', 'Ein 5-V-Signal schaltet über Rb den Transistor, der die 120-Ω-Last an 12 V schaltet.', () => cTrans(false)),
      ex(CAT, 'Prüfung: Z-Diode stabilisiert', 'Die 5,1-V-Z-Diode hält die Spannung an der Last. Miss Ströme und Verlustleistung.', () => cZener()),
      ex(CAT, 'Prüfung: Spannungsregler 7805', 'Der 7805 liefert 5 V aus 12 V. Die Differenz mal Strom wird im Regler zu Wärme.', () => cReg()),
      ex(CAT, 'Prüfung: Schottky-Diode schützt den Eingang', 'Die Diode klemmt die Eingangsspannung auf etwa 5 V plus Durchlassspannung.', () => cKlemm()),
      ex(CAT, 'Prüfung: Batterie mit Innenwiderstand', 'Eine Batterie mit Ri = 2,2 Ω speist eine 10-Ω-Last: Die Spannung bricht ein.', () => cBatt())
    ];

    /* ---------------- Aufgaben ---------------- */
    const TASKS = [
      mk({ id: 'mp1', cat: 'Prüfung: Stromlaufplan', title: 'LED am Netzgerät: Strom und Vorwiderstand', level: 2,
        text: 'Im Stromlaufplan liegt eine rote LED über R1 = 470 Ω an 12 V. Datenblatt der LED: Durchlassspannung etwa 2 V, höchster Dauerstrom 30 mA. 1. Miss die Spannung an der LED (2 Pkt.). 2. Miss den Strom in mA (2 Pkt.). 3. Berechne die Verlustleistung von R1 in mW (2 Pkt.). 4. Welcher Vorwiderstand ergibt rund 15 mA (2 Pkt.)? Beurteile außerdem, ob der Betrieb zulässig ist.',
        hint: 'Multimeter V⎓ an die LED, Strom über das Multimeter im Bereich A oder aus U / R. Verlustleistung P = U · I mit der Spannung an R1. Neuer Widerstand: R = (U − UF) / I.',
        start: () => cLed('470'), solMake: () => cLed('470'),
        solAns: () => { const E = ev(), u = uAcross(E, 'LED1'), i = iThrough(E, 'R1'); return { uled: String(rMeas(u)), i: String(rMeas(i * 1000)), pr: String(rMeas(i * i * 470 * 1000)), rneu: String(Math.round((12 - u) / 0.015)), ok: 0 }; },
        fields: [{ id: 'uled', label: 'Spannung an der LED', unit: 'V', tol: 0.05, truth: () => uAcross(ev(), 'LED1') }, { id: 'i', label: 'LED-Strom', unit: 'mA', tol: 0.05, truth: () => iThrough(ev(), 'R1') },
          { id: 'pr', label: 'Verlustleistung von R1', unit: 'mW', tol: 0.08, truth: () => { const i = iThrough(ev(), 'R1'); return i * i * 470; } }, { id: 'rneu', label: 'Vorwiderstand für 15 mA', unit: 'Ω', tol: 0.08, truth: () => (12 - uAcross(ev(), 'LED1')) / 0.015 }],
        choices: [{ id: 'ok', q: 'Ist der Betrieb der LED so zulässig?', short: 'Zulässigkeit', right: 0, opts: ['Ja, der Strom liegt unter dem höchsten Dauerstrom von 30 mA.', 'Nein, der Strom ist größer als 30 mA.', 'Das lässt sich ohne Kennlinie nicht sagen.'] }] }),
      mk({ id: 'mp2', cat: 'Prüfung: Stromlaufplan', title: 'Spannungsteiler mit Poti: Einstellbereich', level: 2,
        text: 'R1 = 2,2 kΩ, das Poti P1 = 4,7 kΩ und R2 = 1 kΩ liegen in Reihe an 9 V. Am Schleifer des Potis hängt die Last RL = 100 kΩ. Stelle den Regler (unter dem Bauteil) in beide Endstellungen und miss die Spannung an RL. Trage die größte und die kleinste Spannung und den Einstellbereich ein.',
        hint: 'Spannung an RL mit dem Multimeter messen. Regler ganz nach links und ganz nach rechts. Der Einstellbereich ist die Differenz aus größter und kleinster Spannung.',
        start: () => cPoti(false), solMake: () => cPoti(false),
        solAns: () => { const r = rangeOf(); return { umax: String(rMeas(r[1])), umin: String(rMeas(r[0])), ber: String(rMeas(r[1] - r[0])) }; },
        fields: [{ id: 'umax', label: 'Größte Spannung', unit: 'V', tol: 0.05, truth: () => rangeOf()[1] }, { id: 'umin', label: 'Kleinste Spannung', unit: 'V', tol: 0.06, truth: () => rangeOf()[0] }, { id: 'ber', label: 'Einstellbereich', unit: 'V', tol: 0.06, truth: () => { const r = rangeOf(); return r[1] - r[0]; } }] }),
      mk({ id: 'mp3', cat: 'Prüfung: Stromlaufplan', title: 'Nichtinvertierender Verstärker mit dem LM358', level: 3,
        text: 'Der Operationsverstärker A1 (LM358, Einzelversorgung 9 V) verstärkt die Eingangsspannung Ue = 0,5 V mit Rf = 47 kΩ und Rg = 10 kΩ. 1. Miss die Ausgangsspannung (3 Pkt.). 2. Berechne die Spannungsverstärkung aus deinen Messwerten (3 Pkt.). 3. Welchen Wert muss Rf haben, damit die Verstärkung 10 beträgt (Rg bleibt, 4 Pkt.)?',
        hint: 'Spannung am Ausgang von A1 gegen Masse messen. Verstärkung V = Ua / Ue, theoretisch V = 1 + Rf / Rg. Für V = 10: Rf = (V − 1) · Rg.',
        start: () => cOpv(false), solMake: () => cOpv(false),
        solAns: () => { const ua = opvOut(); return { ua: String(rMeas(ua)), v: String(rMeas(ua / 0.5)), rf10: '90', typ: 0 }; },
        fields: [{ id: 'ua', label: 'Ausgangsspannung', unit: 'V', tol: 0.04, truth: () => opvOut() }, { id: 'v', label: 'Spannungsverstärkung (ohne Einheit)', unit: '', tol: 0.05, truth: () => opvOut() / 0.5 }, { id: 'rf10', label: 'Rf für V = 10', unit: 'kΩ', tol: 0.05, truth: () => 90000 }],
        choices: [{ id: 'typ', q: 'Welche Grundschaltung ist das?', short: 'Schaltung', right: 0, opts: ['Nichtinvertierender Verstärker', 'Invertierender Verstärker', 'Komparator', 'Differenzverstärker'] }] }),
      mk({ id: 'mp4', cat: 'Prüfung: Stromlaufplan', title: 'Spannungsfolger entkoppelt einen hochohmigen Teiler', level: 3,
        text: 'Ein Spannungsteiler aus zweimal 100 kΩ an 9 V speist über den Spannungsfolger A1 die Last RL = 1 kΩ. 1. Miss die Spannung an RL (2 Pkt.). 2. Miss den Strom durch RL in mA (2 Pkt.). 3. Berechne, welche Spannung an RL läge, wenn RL direkt am Teilerabgriff hinge (3 Pkt.).',
        hint: 'Der Folger hat einen sehr hohen Eingangswiderstand. Ohne Folger liegt RL parallel zu R2: R2 || RL = 100 kΩ · 1 kΩ / 101 kΩ. Dann Spannungsteiler mit R1 und diesem Parallelwert.',
        start: () => cFolger(), solMake: () => cFolger(),
        solAns: () => { const E = ev(); return { ua: String(rMeas(uAcross(E, 'RL'))), il: String(rMeas(iThrough(E, 'RL') * 1000)), ud: String(rMeas(directTeiler())), warum: 0 }; },
        fields: [{ id: 'ua', label: 'Spannung an RL', unit: 'V', tol: 0.04, truth: () => uAcross(ev(), 'RL') }, { id: 'il', label: 'Laststrom', unit: 'mA', tol: 0.05, truth: () => iThrough(ev(), 'RL') }, { id: 'ud', label: 'Spannung bei direkter Last', unit: 'V', tol: 0.08, truth: () => directTeiler() }],
        choices: [{ id: 'warum', q: 'Wozu dient der Spannungsfolger hier?', short: 'Zweck', right: 0, opts: ['Er entkoppelt: Der Teiler wird nicht belastet, die Last bekommt die volle Teilerspannung.', 'Er verstärkt die Spannung um den Faktor 2.', 'Er kehrt die Spannung um.'] }] }),
      mk({ id: 'mp5', cat: 'Prüfung: Stromlaufplan', title: 'Transistor als Schalter: Basisstrom und Sättigung', level: 3,
        text: 'Ein 5-V-Signal schaltet über Rb = 4,7 kΩ den Transistor T1. Er schaltet die Last RL = 120 Ω an 12 V. 1. Miss den Basisstrom in µA (2 Pkt.). 2. Miss den Laststrom in mA (2 Pkt.). 3. Miss die Spannung UCE (2 Pkt.). 4. Berechne die Stromverstärkung B = IC / IB (2 Pkt.). Beurteile, ob der Transistor gesättigt ist.',
        hint: 'Der Basisstrom fließt durch Rb: IB = (5 V − UBE) / Rb. UCE misst du zwischen Kollektor und Emitter. In der Sättigung ist UCE klein (unter 0,3 V) und B ist kleiner als die Datenblatt-Verstärkung.',
        start: () => cTrans(false), solMake: () => cTrans(false),
        solAns: () => { const E = ev(), ib = iThrough(E, 'Rb'), ic = iThrough(E, 'RL'); return { ib: String(rMeas(ib * 1e6)), ic: String(rMeas(ic * 1000)), uce: String(rMeas(tpin(E, 0) - tpin(E, 2))), b: String(rMeas(ic / ib)), sat: 0 }; },
        fields: [{ id: 'ib', label: 'Basisstrom', unit: 'µA', tol: 0.06, truth: () => iThrough(ev(), 'Rb') }, { id: 'ic', label: 'Laststrom', unit: 'mA', tol: 0.05, truth: () => iThrough(ev(), 'RL') }, { id: 'uce', label: 'Spannung UCE', unit: 'V', tol: 0.3, truth: () => { const E = ev(); return tpin(E, 0) - tpin(E, 2); } }, { id: 'b', label: 'Stromverstärkung B (ohne Einheit)', unit: '', tol: 0.08, truth: () => { const E = ev(); return iThrough(E, 'RL') / iThrough(E, 'Rb'); } }],
        choices: [{ id: 'sat', q: 'Ist der Transistor gesättigt?', short: 'Sättigung', right: 0, opts: ['Ja: UCE ist sehr klein, der Transistor ist voll durchgeschaltet.', 'Nein: UCE liegt bei etwa der halben Versorgungsspannung.', 'Nein: der Transistor sperrt.'] }] }),
      mk({ id: 'mp6', cat: 'Prüfung: Stromlaufplan', title: 'Z-Diode: Ströme und Verlustleistung', level: 2,
        text: 'Die Z-Diode D1 (5,1 V) stabilisiert die Spannung an RL = 1 kΩ aus 12 V über R1 = 330 Ω. 1. Miss die Spannung an der Z-Diode (2 Pkt.). 2. Miss den Strom durch R1 und den Strom durch die Z-Diode (je 2 Pkt.). 3. Berechne die Verlustleistung der Z-Diode in mW (2 Pkt.).',
        hint: 'Der Strom durch R1 teilt sich auf RL und D1 auf: IZ = IR1 − IL. Verlustleistung P = UZ · IZ.',
        start: () => cZener(), solMake: () => cZener(),
        solAns: () => { const E = ev(), uz = uAcross(E, 'D1'), iz = iThrough(E, 'D1'); return { uz: String(rMeas(uz)), ir: String(rMeas(iThrough(E, 'R1') * 1000)), iz: String(rMeas(iz * 1000)), pz: String(rMeas(uz * iz * 1000)) }; },
        fields: [{ id: 'uz', label: 'Spannung an D1', unit: 'V', tol: 0.04, truth: () => uAcross(ev(), 'D1') }, { id: 'ir', label: 'Strom durch R1', unit: 'mA', tol: 0.05, truth: () => iThrough(ev(), 'R1') }, { id: 'iz', label: 'Strom durch D1', unit: 'mA', tol: 0.08, truth: () => iThrough(ev(), 'D1') }, { id: 'pz', label: 'Verlustleistung von D1', unit: 'mW', tol: 0.1, truth: () => { const E = ev(); return uAcross(E, 'D1') * iThrough(E, 'D1'); } }] }),
      mk({ id: 'mp7', cat: 'Prüfung: Stromlaufplan', title: 'Spannungsregler 7805: Verlustleistung und Erwärmung', level: 2,
        text: 'Der Festspannungsregler U3 (7805) versorgt eine Last von 100 Ω aus 12 V. 1. Miss die Ausgangsspannung (2 Pkt.) und den Laststrom (2 Pkt.). 2. Berechne die Verlustleistung im Regler in mW (3 Pkt.). 3. Um wie viel Kelvin erwärmt sich das Gehäuse ohne Kühlkörper (Wärmewiderstand 50 K/W, 3 Pkt.)?',
        hint: 'Verlustleistung PV = (Eingangsspannung − Ausgangsspannung) · Strom. Erwärmung ΔT = PV · Rth.',
        start: () => cReg(), solMake: () => cReg(),
        solAns: () => { const E = ev(), ua = Math.abs(api.pinV(E, part('U3'), 2)), il = iThrough(E, 'RL'), pv = (12 - ua) * il; return { ua: String(rMeas(ua)), il: String(rMeas(il * 1000)), pv: String(rMeas(pv * 1000)), dt: String(rMeas(pv * 50)) }; },
        fields: [{ id: 'ua', label: 'Ausgangsspannung', unit: 'V', tol: 0.03, truth: () => Math.abs(api.pinV(ev(), part('U3'), 2)) }, { id: 'il', label: 'Laststrom', unit: 'mA', tol: 0.04, truth: () => iThrough(ev(), 'RL') }, { id: 'pv', label: 'Verlustleistung im Regler', unit: 'mW', tol: 0.08, truth: () => { const E = ev(); return (12 - Math.abs(api.pinV(E, part('U3'), 2))) * iThrough(E, 'RL'); } }, { id: 'dt', label: 'Erwärmung ohne Kühlkörper', unit: 'K', tol: 0.1, truth: () => { const E = ev(); return (12 - Math.abs(api.pinV(E, part('U3'), 2))) * iThrough(E, 'RL') * 50; } }] }),
      mk({ id: 'mp8', cat: 'Prüfung: Stromlaufplan', title: 'Schottky-Diode schützt einen Eingang', level: 2,
        text: 'Ein 12-V-Signal erreicht einen Eingang, der höchstens 5,5 V verträgt. R1 = 1 kΩ begrenzt den Strom, die Schottky-Diode D1 klemmt auf die 5-V-Versorgung. 1. Miss die Spannung am Knoten hinter R1 (2 Pkt.). 2. Miss den Diodenstrom in mA (2 Pkt.). 3. Wie groß ist die Durchlassspannung der Diode (3 Pkt.)? Beurteile den Schutz.',
        hint: 'Der Knoten liegt etwa eine Diodenspannung über der 5-V-Schiene. Strom durch D1 = (12 V − Knotenspannung) / R1. Durchlassspannung = Knoten − 5 V.',
        start: () => cKlemm(), solMake: () => cKlemm(),
        solAns: () => { const E = ev(), u = Math.abs(api.pinV(E, part('R1'), 1)); return { ukn: String(rMeas(u)), id: String(rMeas(iThrough(E, 'D1') * 1000)), uf: String(rMeas(u - 5)), schutz: 0 }; },
        fields: [{ id: 'ukn', label: 'Spannung am Knoten', unit: 'V', tol: 0.03, truth: () => Math.abs(api.pinV(ev(), part('R1'), 1)) }, { id: 'id', label: 'Diodenstrom', unit: 'mA', tol: 0.06, truth: () => iThrough(ev(), 'D1') }, { id: 'uf', label: 'Durchlassspannung der Diode', unit: 'V', tol: 0.2, truth: () => Math.abs(api.pinV(ev(), part('R1'), 1)) - 5 }],
        choices: [{ id: 'schutz', q: 'Ist der Eingang geschützt?', short: 'Schutz', right: 0, opts: ['Ja: die Spannung bleibt unter 5,5 V.', 'Nein: der Knoten liegt über 5,5 V.', 'Das hängt vom Eingang ab, nicht von der Diode.'] }] }),
      mk({ id: 'mp9', cat: 'Prüfung: Stromlaufplan', title: 'Innenwiderstand einer Batterie bestimmen', level: 3,
        text: 'Eine Batterie hat 4,5 V Leerlaufspannung. Ihr Innenwiderstand ist als R1 = 2,2 Ω in Reihe dargestellt. Die Last RL = 10 Ω ist angeschlossen. 1. Miss die Spannung an RL (2 Pkt.). 2. Miss den Strom in mA (2 Pkt.). 3. Berechne den Innenwiderstand aus Leerlaufspannung, Lastspannung und Strom: Ri = (U0 − UL) / I (4 Pkt.).',
        hint: 'U0 = 4,5 V (ohne Last). Der Spannungsfall am Innenwiderstand ist U0 − UL. Teile ihn durch den Strom.',
        start: () => cBatt(), solMake: () => cBatt(),
        solAns: () => { const E = ev(), ul = uAcross(E, 'RL'), i = iThrough(E, 'RL'); return { ul: String(rMeas(ul)), i: String(rMeas(i * 1000)), ri: String(rMeas((4.5 - ul) / i)) }; },
        fields: [{ id: 'ul', label: 'Spannung an RL', unit: 'V', tol: 0.03, truth: () => uAcross(ev(), 'RL') }, { id: 'i', label: 'Laststrom', unit: 'mA', tol: 0.04, truth: () => iThrough(ev(), 'RL') }, { id: 'ri', label: 'Innenwiderstand', unit: 'Ω', tol: 0.1, truth: () => { const E = ev(); return (4.5 - uAcross(E, 'RL')) / iThrough(E, 'RL'); } }] }),
      /* Fehlersuche an Prüfungsschaltungen */
      { id: 'mpf1', lab: 'mess', cat: 'Fehlersuche', title: 'Fehlersuche: Transistorstufe schaltet nicht', level: 3, debug: true, faultLabel: 'Rb', sol: 'x', solMake: () => cTrans(false), start: () => cTrans(true),
        text: 'Am Eingang liegen 5 V, aber die Last RL bekommt keinen Strom. Miss die Spannungen an Rb, an der Basis und am Kollektor und melde das defekte Bauteil.',
        hint: 'Wenn kein Basisstrom fließt, fällt an Rb keine Spannung ab, und die Basis liegt auf 0 V. Eine Unterbrechung in Rb erklärt das.' },
      { id: 'mpf2', lab: 'mess', cat: 'Fehlersuche', title: 'Fehlersuche: Verstärker verstärkt nicht', level: 3, debug: true, faultLabel: 'Rg', sol: 'x', solMake: () => cOpv(false), start: () => cOpv(true),
        text: 'Der Verstärker soll 0,5 V auf etwa 2,85 V verstärken, am Ausgang stehen aber nur 0,5 V. Miss die Spannungen und melde das defekte Bauteil.',
        hint: 'Ohne Rg gibt es keinen Spannungsteiler im Gegenkopplungszweig: V = 1 + Rf / ∞ = 1. Der Ausgang folgt dem Eingang.' },
      { id: 'mpf3', lab: 'mess', cat: 'Fehlersuche', title: 'Fehlersuche: Poti stellt zu hoch ein', level: 3, debug: true, faultLabel: 'R2', sol: 'x', solMake: () => cPoti(false), start: () => cPoti(true),
        text: 'Der Einstellbereich des Potis stimmt nicht mehr: Die Spannung am Schleifer geht nie unter etwa 8 V. Miss die Spannungen am Teiler und melde das defekte Bauteil.',
        hint: 'Unten im Teiler fehlt der Weg nach Masse. Ein unterbrochener R2 lässt die Spannung am Schleifer auf den hohen Wert steigen.' }
    ];
    function rangeOf() {   // Spannung an RL in beiden Endstellungen des Potis
      const p = part('P1'); if (!p) return [NaN, NaN]; const keep = p.pos, out = [];
      [0, 1].forEach(pos => { p.pos = pos; out.push(uAcross(ev(), 'RL')); }); p.pos = keep;
      return [Math.min(out[0], out[1]), Math.max(out[0], out[1])];
    }
    function opvOut() { return Math.abs(api.pinV(ev(), part('A1'), 2)); }
    function directTeiler() { const rp = 100e3 * 1e3 / (100e3 + 1e3); return 9 * rp / (100e3 + rp); }
    return { ex: EX, tasks: TASKS };
  };
})(window);
