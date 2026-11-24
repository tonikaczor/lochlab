'use strict';
/* Tonfunk Lab "Funk- und HF-Lab": Aufgaben und Lerntexte (Lab-Kennung 'hf', Präfix lm4.hf.).
   HF_DATA.meta: Name, Kürzel, Version.  HF_DATA.tasks: 54 Aufgaben (Stufe 1-3) in 6 Blöcken zu je 9; jede hat make(R, C) mit seed-fähigem
   Zufallsgenerator R und HF_CORE C und liefert { text, label, unit, value, tol, tips[3], steps[], meta }.
   Der Wert (value) und alle Zahlen im Rechenweg (steps) kommen aus dem Kern (HF_CORE), nie von Hand. Der Test (test_hfdata.js)
   rechnet jede Aufgabe aus meta ein zweites Mal auf anderem Weg nach (über Leistungen statt Pegel, Physik statt Zahlenwertgleichung, Suche statt Formel).
   Tipps: Stufe 1 Denkanstoß, Stufe 2 Formel, Stufe 3 Formel mit eingesetzten Zahlen (ohne das Ergebnis).
   HF_DATA.blocks: Lerntexte je Block (eigene Formulierung).  HF_TASKS: Kurzliste [{id,cat,title,level}] für Karriere/Lernpfad. */
(function (root) {
  const C = root.HF_CORE || (typeof require === 'function' ? require('./hfcore.js') : null);
  const pick = C.pick, ri = C.ri;
  const F = (v, s) => C.fmt(v, s || 4);          /* Ergebnisse und Zwischenwerte */
  const N = v => C.fmt(v, 7);                    /* gegebene Werte: ungekürzt */
  /* Pegel und dB-Werte im Rechenweg: auf 2 Nachkommastellen, damit Zwischenwerte und Ergebnis zusammenpassen (−122,97 statt −123) */
  const Fd = v => { const s = C.fmtDe(v, 2); return s.indexOf(',') >= 0 ? s.replace(/0+$/, '').replace(/,$/, '') : s; };
  const Pn = v => (v < 0 ? '(' + Fd(v) + ')' : Fd(v));   /* negative Zahl in Klammern */
  const CATS = ['Pegel und Dezibel', 'Leitung und Anpassung', 'Antenne und Funkstrecke', 'Modulation', 'Empfänger und Rauschen', 'Messen in der HF-Technik'];
  const tasks = [];
  /* Ein Wert nahe 0 wäre als Aufgabe unbrauchbar (jede Eingabe nahe 0 passt): dann mit den nächsten Zufallszahlen neu würfeln */
  const add = (cat, title, level, kind, make) => tasks.push({ id: 'hf' + (tasks.length + 1), cat, title, level, kind, make: (R, Cc) => { let q; for (let i = 0; i < 40; i++) { q = make(R, Cc); if (Math.abs(q.value) > 2 * q.tol) return q; } return q; } });
  /* gemeinsamer Rahmen: Toleranz aus Einheit */
  const out = (o, extra) => { const unit = o.unit || ''; return Object.assign({ unit, tol: C.tolFor(o.value, unit, o.tolo) }, o, extra || {}); };
  const C_TXT = `Rechne mit c = ${N(300000)} km/s.`;
  const FSPL_TXT = 'Benutze a = 32,44 + 20 · lg(d in km) + 20 · lg(f in MHz).';
  const BANDS = [2700, 12500, 25000, 125000, 200000, 1000000];

  /* ============================================================ 1  Pegel und Dezibel */
  add(CATS[0], 'Leistungsverstärkung in dB', 1, 'pow_db', (R) => {
    const p1 = pick(R, [0.5, 1, 2, 4, 5, 10]), k = pick(R, [2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 200, 400]), p2 = p1 * k, v = C.dbP(p2 / p1);
    return out({ text: `Ein HF-Verstärker bekommt am Eingang die Leistung P₁ = ${N(p1)} mW. Am Ausgang gibt er P₂ = ${N(p2)} mW ab. Wie groß ist seine Leistungsverstärkung in dB?`, label: 'Verstärkung', unit: 'dB', value: v,
      tips: ['Dezibel beschreiben ein Verhältnis. Bilde zuerst das Verhältnis von Ausgangsleistung zu Eingangsleistung.', 'g = 10 · lg(P₂ / P₁). Bei Leistungen gilt der Faktor 10.', `g = 10 · lg(${N(p2)} mW / ${N(p1)} mW).`],
      steps: ['g = 10 · lg(P₂ / P₁)', `P₂ / P₁ = ${N(p2)} mW / ${N(p1)} mW = ${F(p2 / p1)}`, `g = 10 · lg(${F(p2 / p1)}) = ${Fd(v)} dB`], meta: { p1, p2 } });
  });
  add(CATS[0], 'Dämpfung aus zwei Spannungen', 1, 'volt_db', (R) => {
    const u1 = pick(R, [100, 200, 500, 800, 1000]), k = pick(R, [2, 4, 5, 8, 10, 20, 50]), u2 = u1 / k, v = C.dbU(u2 / u1);
    return out({ text: `Ein Dämpfungsglied liegt zwischen zwei gleichen Widerständen von 50 Ω. Am Eingang misst du U₁ = ${N(u1)} mV, am Ausgang U₂ = ${N(u2)} mV. Wie groß ist die Pegeländerung in dB? Eine Dämpfung gibst du als negative Zahl an.`, label: 'Pegeländerung', unit: 'dB', value: v,
      tips: ['Bei Spannungen an gleichen Widerständen zählt der Faktor 20, weil die Leistung mit dem Quadrat der Spannung wächst.', 'a = 20 · lg(U₂ / U₁). Ist U₂ kleiner als U₁, wird das Ergebnis negativ.', `a = 20 · lg(${N(u2)} mV / ${N(u1)} mV).`],
      steps: ['a = 20 · lg(U₂ / U₁)', `U₂ / U₁ = ${N(u2)} mV / ${N(u1)} mV = ${F(u2 / u1)}`, `a = 20 · lg(${F(u2 / u1)}) = ${Fd(v)} dB`], meta: { u1, u2 } });
  });
  add(CATS[0], 'Leistung als Pegel in dBm', 1, 'w_to_dbm', (R) => {
    const p = pick(R, [0.0005, 0.002, 0.005, 0.02, 0.05, 0.2, 0.5, 2, 4, 5, 20, 25, 50]), v = C.dbmFromW(p);
    return out({ text: `Ein Sender gibt die Leistung P = ${C.fmtW(p, 7)} ab. Welchem Leistungspegel in dBm entspricht das? Der Pegel in dBm bezieht sich auf 1 mW.`, label: 'Leistungspegel', unit: 'dBm', value: v,
      tips: ['Rechne die Leistung zuerst in Milliwatt um. Dann vergleichst du sie mit 1 mW.', 'L = 10 · lg(P / 1 mW).', `L = 10 · lg(${N(p * 1000)} mW / 1 mW).`],
      steps: ['L = 10 · lg(P / 1 mW)', `P = ${C.fmtW(p, 7)} = ${N(p * 1000)} mW`, `L = 10 · lg(${N(p * 1000)}) = ${Fd(v)} dBm`], meta: { p } });
  });
  add(CATS[0], 'Pegel in dBm als Leistung', 2, 'dbm_to_mw', (R) => {
    const l = pick(R, [-17, -13, -7, -6, -3, 3, 6, 7, 13, 17, 23, 27]), v = C.wFromDbm(l) * 1000;
    return out({ text: `Ein Signalgenerator ist auf den Ausgangspegel L = ${N(l)} dBm eingestellt. Welche Leistung in mW gibt er an einen angepassten Verbraucher ab?`, label: 'Leistung', unit: 'mW', value: v,
      tips: ['Du musst den Logarithmus rückgängig machen. 0 dBm sind genau 1 mW, 10 dB mehr sind die zehnfache Leistung.', 'P = 1 mW · 10^(L / 10).', `P = 1 mW · 10^(${N(l)} / 10).`],
      steps: ['P = 1 mW · 10^(L / 10)', `L / 10 = ${F(l / 10)}`, `P = 1 mW · 10^${Pn(l / 10)} = ${F(v)} mW`], meta: { l } });
  });
  add(CATS[0], 'Spannung als Pegel in dBµV', 2, 'uv_to_dbuv', (R) => {
    const u = pick(R, [2e-6, 5e-6, 2e-5, 5e-5, 2e-4, 5e-4, 2e-3, 5e-3, 2e-2, 5e-2]), v = C.dbuvFromV(u);
    return out({ text: `Am Eingang eines Empfängers liegt die Spannung U = ${C.fmtV(u, 7)}. Wie groß ist der Spannungspegel in dBµV? Der Pegel in dBµV bezieht sich auf 1 µV.`, label: 'Spannungspegel', unit: 'dBµV', value: v,
      tips: ['Rechne die Spannung zuerst in Mikrovolt um. Bei Spannungen gilt der Faktor 20.', 'L_U = 20 · lg(U / 1 µV).', `L_U = 20 · lg(${N(u * 1e6)} µV / 1 µV).`],
      steps: ['L_U = 20 · lg(U / 1 µV)', `U = ${C.fmtV(u, 7)} = ${N(u * 1e6)} µV`, `L_U = 20 · lg(${N(u * 1e6)}) = ${Fd(v)} dBµV`], meta: { u } });
  });
  add(CATS[0], 'Umrechnen zwischen dBm und dBµV an 50 Ω', 2, 'dbm_dbuv', (R) => {
    const dir = pick(R, ['dbm', 'dbuv']);
    if (dir === 'dbm') {
      const l = ri(R, 6, 80), v = C.dbuvToDbm50(l);
      return out({ text: `Ein Messempfänger mit 50 Ω Eingangswiderstand zeigt den Spannungspegel L_U = ${N(l)} dBµV. Welcher Leistungspegel in dBm ist das? Rechne mit dem gerundeten Abstand von 107 dB zwischen dBµV und dBm an 50 Ω.`, label: 'Leistungspegel', unit: 'dBm', value: v,
        tips: ['An 50 Ω gehört zu jeder Leistung eine feste Spannung. Darum unterscheiden sich die beiden Pegel nur um eine feste Zahl.', 'L_P in dBm = L_U in dBµV − 107 dB (gilt nur an 50 Ω).', `L_P = ${N(l)} dBµV − 107 dB.`],
        steps: ['An 50 Ω gilt: L_P = L_U − 107 dB', `L_P = ${N(l)} − 107 = ${Fd(v)} dBm`], meta: { dir, l } });
    }
    const l = ri(R, -100, -27), v = C.dbmToDbuv50(l);
    return out({ text: `An einem 50-Ω-Eingang liegt der Leistungspegel L_P = ${N(l)} dBm. Welcher Spannungspegel in dBµV ist das? Rechne mit dem gerundeten Abstand von 107 dB zwischen dBm und dBµV an 50 Ω.`, label: 'Spannungspegel', unit: 'dBµV', value: v,
      tips: ['An 50 Ω gehört zu jeder Leistung eine feste Spannung. Darum unterscheiden sich die beiden Pegel nur um eine feste Zahl.', 'L_U in dBµV = L_P in dBm + 107 dB (gilt nur an 50 Ω).', `L_U = ${N(l)} dBm + 107 dB.`],
      steps: ['An 50 Ω gilt: L_U = L_P + 107 dB', `L_U = ${Pn(l)} + 107 = ${Fd(v)} dBµV`], meta: { dir, l } });
  });
  add(CATS[0], 'Pegelplan einer Sendekette', 2, 'level_plan', (R) => {
    const l0 = pick(R, [0, 3, 5, 7, 10]), a1 = pick(R, [1.5, 2, 2.5, 3, 4]), g = pick(R, [20, 23, 26, 30, 33]), a2 = pick(R, [3, 6, 10]), ch = C.levelChain(l0, [-a1, g, -a2]), v = ch[3];
    return out({ text: `Ein Steuersender liefert den Pegel L₀ = ${N(l0)} dBm. Es folgen ein Kabel mit ${N(a1)} dB Dämpfung, ein Verstärker mit ${N(g)} dB Verstärkung und ein Dämpfungsglied mit ${N(a2)} dB. Welcher Pegel in dBm kommt am Ende der Kette an?`, label: 'Pegel am Ende', unit: 'dBm', value: v,
      tips: ['Im Pegelplan zählst du nur zusammen: Verstärkung dazu, Dämpfung abziehen.', 'L = L₀ − a_Kabel + g_Verstärker − a_Dämpfungsglied.', `L = ${N(l0)} dBm − ${N(a1)} dB + ${N(g)} dB − ${N(a2)} dB.`],
      steps: [`Nach dem Kabel: ${N(l0)} dBm − ${N(a1)} dB = ${Fd(ch[1])} dBm`, `Nach dem Verstärker: ${Fd(ch[1])} dBm + ${N(g)} dB = ${Fd(ch[2])} dBm`, `Nach dem Dämpfungsglied: ${Fd(ch[2])} dBm − ${N(a2)} dB = ${Fd(v)} dBm`], meta: { l0, a1, g, a2 } });
  });
  add(CATS[0], 'Zwei gleiche Leistungen zusammenführen', 2, 'add_equal', (R) => {
    const l0 = ri(R, -30, 20), l = l0 >= 1 && l0 <= 5 ? l0 + 10 : l0, v = C.sumDbm([l, l]);   /* nicht nahe 3 dBm: dort wäre der Fehler "Pegel verdoppelt" zufällig richtig */
    return out({ text: `Zwei Sender mit verschiedenen Frequenzen liefern jeweils den Pegel L = ${N(l)} dBm. Ein als verlustfrei angenommener Leistungssummierer führt beide Signale auf eine Leitung. Wie groß ist der Gesamtpegel in dBm? Die beiden Leistungen addieren sich.`, label: 'Gesamtpegel', unit: 'dBm', value: v,
      tips: ['Pegel in dBm darfst du nicht einfach zusammenzählen. Addiert werden die Leistungen. Zwei gleiche Leistungen ergeben die doppelte Leistung.', 'Doppelte Leistung: L_ges = L + 10 · lg(2) = L + 3,01 dB.', `L_ges = ${N(l)} dBm + 10 · lg(2).`],
      steps: ['Doppelte Leistung bedeutet 10 · lg(2) = 3,01 dB mehr', `L_ges = ${Pn(l)} + 3,01 = ${Fd(v)} dBm`], meta: { l } });
  });
  add(CATS[0], 'Signal-Rausch-Abstand', 3, 'snr', (R) => {
    const s = ri(R, -70, -40), n = pick(R, [0.5, 1, 2, 5, 10, 20, 50]), ln = C.dbmFromW(n * 1e-12), v = C.snrDb(s, ln);
    return out({ text: `Am Ausgang eines Empfangsfilters misst du den Signalpegel S = ${N(s)} dBm. Die Rauschleistung an derselben Stelle beträgt N = ${N(n)} pW. Wie groß ist der Signal-Rausch-Abstand in dB?`, label: 'Signal-Rausch-Abstand', unit: 'dB', value: v,
      tips: ['Bringe beide Größen in dieselbe Form. Rechne die Rauschleistung in dBm um, dann ist der Abstand eine einfache Differenz.', 'L_N = 10 · lg(N / 1 mW) und SNR = S − L_N. 1 pW sind 10⁻⁹ mW, also −90 dBm.', `L_N = 10 · lg(${N(n)} · 10⁻⁹) und SNR = ${N(s)} dBm − L_N.`],
      steps: [`Rauschpegel: L_N = 10 · lg(${N(n)} pW / 1 mW) = ${Fd(ln)} dBm`, 'SNR = S − L_N', `SNR = ${Pn(s)} − ${Pn(ln)} = ${Fd(v)} dB`], meta: { s, n: n * 1e-12 } });
  });

  /* ============================================================ 2  Leitung und Anpassung */
  add(CATS[1], 'Wellenlänge in Luft', 1, 'lambda_air', (R) => {
    const f = pick(R, [27, 50, 100, 145, 150, 433, 446, 868, 900, 2400]), v = C.wavelength(f * 1e6);
    return out({ text: `Ein Funkgerät sendet auf f = ${N(f)} MHz. Wie groß ist die Wellenlänge in Luft? ${C_TXT}`, label: 'Wellenlänge', unit: 'm', value: v,
      tips: [`Je höher die Frequenz, desto kürzer die Welle. In einer Sekunde legt die Welle ${N(300000)} km zurück.`,'λ = c / f. Schnell gerechnet: λ in m = 300 / (f in MHz).', `λ = 300 / ${N(f)} in m.`],
      steps: ['λ = c / f', `λ = ${N(C.C0)} m/s / ${N(f * 1e6)} Hz = ${F(v)} m`], meta: { f: f * 1e6 } });
  });
  add(CATS[1], 'Länge einer λ/4-Leitung', 2, 'quarter', (R) => {
    const f = pick(R, [100, 145, 150, 433, 868]), vk = pick(R, [0.66, 0.7, 0.8, 0.82, 0.85]), l0 = C.wavelength(f * 1e6), lk = C.wavelength(f * 1e6, vk), v = C.quarterWave(f * 1e6, vk) * 100;
    return out({ text: `Aus einem Koaxialkabel mit dem Verkürzungsfaktor VK = ${N(vk)} soll eine λ/4-Leitung für f = ${N(f)} MHz geschnitten werden. Wie lang muss das Kabelstück sein? ${C_TXT}`, label: 'Länge', unit: 'cm', value: v,
      tips: ['Im Kabel läuft die Welle langsamer als in Luft. Darum ist die Wellenlänge im Kabel kürzer, und zwar um den Verkürzungsfaktor.', 'λ_Kabel = VK · c / f und l = λ_Kabel / 4.', `l = ${N(vk)} · (300 / ${N(f)}) m / 4.`],
      steps: [`Wellenlänge in Luft: λ = c / f = ${F(l0)} m`, `Wellenlänge im Kabel: λ_K = VK · λ = ${N(vk)} · ${F(l0)} m = ${F(lk)} m`, `l = λ_K / 4 = ${F(lk / 4)} m = ${F(v)} cm`], meta: { f: f * 1e6, vk } });
  });
  add(CATS[1], 'Wellenwiderstand aus den Leitungsbelägen', 2, 'z0_lc', (R) => {
    /* nur Paare, die es bei Koaxialkabeln gibt: rund 50 Ω und rund 75 Ω */
    const [l, c] = pick(R, [[250, 100], [242, 97], [253, 101], [257, 102], [247, 100], [370, 66], [380, 67], [375, 67], [382, 68]]), v = C.z0FromLC(l * 1e-9, c * 1e-12);
    return out({ text: `Ein Koaxialkabel hat den Induktivitätsbelag L' = ${N(l)} nH/m und den Kapazitätsbelag C' = ${N(c)} pF/m. Die Verluste werden vernachlässigt. Wie groß ist der Wellenwiderstand?`, label: 'Wellenwiderstand', unit: 'Ω', value: v,
      tips: ['Der Wellenwiderstand hängt nur vom Verhältnis der beiden Beläge ab, nicht von der Länge des Kabels.', "Z_W = √(L' / C'). Achte auf die Vorsätze: 1 nH = 10⁻⁹ H, 1 pF = 10⁻¹² F.", `Z_W = √(${N(l)} · 10⁻⁹ H/m / (${N(c)} · 10⁻¹² F/m)).`],
      steps: ["Z_W = √(L' / C')", `L' / C' = ${N(l)} · 10⁻⁹ H/m / (${N(c)} · 10⁻¹² F/m) = ${F(l / c * 1000)} Ω²`, `Z_W = √(${F(l / c * 1000)} Ω²) = ${F(v)} Ω`], meta: { l: l * 1e-9, c: c * 1e-12 } });
  });
  add(CATS[1], 'Reflexionsfaktor am Leitungsende', 1, 'gamma', (R) => {
    const z0 = pick(R, [50, 75]), zl = pick(R, [10, 12.5, 25, 30, 100, 150, 200, 300]), g = C.gamma(zl, z0), v = Math.abs(g);
    return out({ text: `Eine Leitung mit dem Wellenwiderstand Z_W = ${N(z0)} Ω ist mit einem rein ohmschen Widerstand R_A = ${N(zl)} Ω abgeschlossen. Wie groß ist der Betrag des Reflexionsfaktors r?`, label: 'Betrag von r', unit: '', value: v,
      tips: ['Passt der Abschluss nicht zum Wellenwiderstand, läuft ein Teil der Welle zurück. Je größer der Unterschied, desto größer r.', 'r = (R_A − Z_W) / (R_A + Z_W). Gefragt ist der Betrag, also ohne Vorzeichen.', `r = (${N(zl)} Ω − ${N(z0)} Ω) / (${N(zl)} Ω + ${N(z0)} Ω).`],
      steps: ['r = (R_A − Z_W) / (R_A + Z_W)', `r = (${N(zl)} − ${N(z0)}) Ω / (${N(zl)} + ${N(z0)}) Ω = ${F(g)}`, `Betrag: |r| = ${F(v)}`], meta: { z0, zl }, tolo: { abs: 0.01 } });
  });
  add(CATS[1], 'Stehwellenverhältnis aus dem Reflexionsfaktor', 2, 'swr', (R) => {
    const r = pick(R, [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6]), v = C.swrFromGamma(r);
    return out({ text: `Auf einer Leitung misst du den Reflexionsfaktor |r| = ${N(r)}. Wie groß ist das Stehwellenverhältnis s (SWR)?`, label: 'Stehwellenverhältnis s', unit: '', value: v,
      tips: ['Hinlaufende und rücklaufende Welle überlagern sich. An manchen Stellen addieren sie sich (1 + r), an anderen ziehen sie sich ab (1 − r).', 's = U_max / U_min = (1 + |r|) / (1 − |r|).', `s = (1 + ${N(r)}) / (1 − ${N(r)}).`],
      steps: ['s = (1 + |r|) / (1 − |r|)', `s = ${F(1 + r)} / ${F(1 - r)} = ${F(v)}`], meta: { r }, tolo: { abs: 0.02 } });
  });
  add(CATS[1], 'Reflektierte Leistung aus dem Stehwellenverhältnis', 3, 'refl_pct', (R) => {
    const s = pick(R, [1.2, 1.3, 1.5, 1.8, 2, 2.5, 3, 4, 5]), r = C.gammaFromSwr(s), v = C.reflFrac(r) * 100;
    return out({ text: `Ein Stehwellenmessgerät zeigt an der Antennenleitung s = ${N(s)}. Wie viel Prozent der hinlaufenden Leistung werden an der Antenne reflektiert?`, label: 'Reflektierter Anteil', unit: '%', value: v,
      tips: ['Rechne in zwei Schritten: erst vom Stehwellenverhältnis zum Reflexionsfaktor, dann zur Leistung. Die Leistung hängt am Quadrat der Spannung.', '|r| = (s − 1) / (s + 1) und P_rück / P_hin = r².', `|r| = (${N(s)} − 1) / (${N(s)} + 1), dann r² · 100 %.`],
      steps: ['|r| = (s − 1) / (s + 1)', `|r| = ${F(s - 1)} / ${F(s + 1)} = ${F(r)}`, `P_rück / P_hin = r² = ${F(r * r)} = ${F(v)} %`], meta: { s } });
  });
  add(CATS[1], 'Rückflussdämpfung einer Antenne', 3, 'return_loss', (R) => {
    const z0 = 50, zl = pick(R, [25, 30, 40, 60, 75, 100, 150, 200]), g = C.gamma(zl, z0), v = C.returnLoss(g);
    return out({ text: `Eine Antenne hat bei der Betriebsfrequenz den rein ohmschen Eingangswiderstand R_A = ${N(zl)} Ω. Die Antenne hängt an einem 50-Ω-Kabel. Wie groß ist die Rückflussdämpfung in dB? Gib sie als positive Zahl an.`, label: 'Rückflussdämpfung', unit: 'dB', value: v,
      tips: ['Die Rückflussdämpfung sagt, um wie viel dB die rücklaufende Welle schwächer ist als die hinlaufende. Du brauchst zuerst den Reflexionsfaktor.', 'r = (R_A − Z_W) / (R_A + Z_W) und a_r = −20 · lg(|r|).', `|r| = |${N(zl)} − 50| / (${N(zl)} + 50), dann a_r = −20 · lg(|r|).`],
      steps: [`|r| = |${N(zl)} − ${N(z0)}| Ω / (${N(zl)} + ${N(z0)}) Ω = ${F(Math.abs(g))}`, 'a_r = −20 · lg(|r|)', `a_r = −20 · lg(${F(Math.abs(g))}) = ${Fd(v)} dB`], meta: { z0, zl } });
  });
  add(CATS[1], 'Kabeldämpfung aus Länge und Datenblatt', 1, 'cable_loss', (R) => {
    const a100 = pick(R, [4.5, 6.1, 8.5, 11, 13.5, 17, 22]), len = pick(R, [8, 12, 15, 25, 30, 40, 60]), v = C.cableLoss(a100, len);
    return out({ text: `Ein Koaxialkabel hat laut Datenblatt bei der Betriebsfrequenz eine Dämpfung von ${N(a100)} dB je 100 m. Die Leitung zur Antenne ist ${N(len)} m lang. Wie groß ist die Kabeldämpfung in dB?`, label: 'Kabeldämpfung', unit: 'dB', value: v,
      tips: ['Die Dämpfung in dB wächst gleichmäßig mit der Länge. Doppelte Länge bedeutet doppelt so viele dB.', 'a = (Dämpfung je 100 m) · Länge / 100 m.', `a = ${N(a100)} dB · ${N(len)} m / 100 m.`],
      steps: ['a = a₁₀₀ · l / 100 m', `a = ${N(a100)} dB · ${N(len)} m / 100 m = ${Fd(v)} dB`], meta: { a100, len } });
  });
  add(CATS[1], 'Leistung an der Antenne', 2, 'p_antenna', (R) => {
    const p = pick(R, [5, 10, 25, 50, 100]), a100 = pick(R, [5, 8, 10, 12.5, 16, 20]), len = pick(R, [10, 15, 20, 25, 40, 50]), a = C.cableLoss(a100, len), v = C.powerAfterLoss(p, a);
    return out({ text: `Ein Sender gibt P = ${N(p)} W ab. Das Kabel zur Antenne dämpft ${N(a100)} dB je 100 m und ist ${N(len)} m lang. Die Antenne ist angepasst. Welche Leistung in W kommt an der Antenne an?`, label: 'Leistung an der Antenne', unit: 'W', value: v,
      tips: ['Bestimme zuerst die Dämpfung des Kabels in dB. Danach machst du aus den dB wieder einen Faktor für die Leistung.', 'a = a₁₀₀ · l / 100 m und P_Antenne = P · 10^(−a / 10).', `a = ${N(a100)} dB · ${N(len)} / 100, dann P_Antenne = ${N(p)} W · 10^(−a / 10).`],
      steps: [`Kabeldämpfung: a = ${N(a100)} dB · ${N(len)} m / 100 m = ${Fd(a)} dB`, `Faktor: 10^(−${Fd(a)} / 10) = ${F(Math.pow(10, -a / 10))}`, `P_Antenne = ${N(p)} W · ${F(Math.pow(10, -a / 10))} = ${F(v)} W`], meta: { p, a100, len } });
  });

  /* ============================================================ 3  Antenne und Funkstrecke */
  add(CATS[2], 'Länge eines Halbwellendipols', 1, 'dipole', (R) => {
    const f = pick(R, [28.5, 50, 100, 145, 435, 868]), k = pick(R, [0.95, 0.96, 0.97]), lam = C.wavelength(f * 1e6), v = C.dipoleLen(f * 1e6, k) * 100;
    return out({ text: `Für f = ${N(f)} MHz soll ein Halbwellendipol gebaut werden. Wegen des Endeffekts wird der Dipol mit dem Faktor k = ${N(k)} gekürzt. Wie lang muss der Dipol insgesamt sein? ${C_TXT}`, label: 'Dipollänge', unit: 'cm', value: v,
      tips: ['Ein Halbwellendipol ist etwa eine halbe Wellenlänge lang. Wegen der Drahtdicke und der Enden fällt er etwas kürzer aus.', 'l = k · λ / 2 mit λ = c / f.', `l = ${N(k)} · (300 / ${N(f)}) m / 2.`],
      steps: [`λ = c / f = ${N(C.C0)} m/s / ${N(f * 1e6)} Hz = ${F(lam)} m`, `l = k · λ / 2 = ${N(k)} · ${F(lam)} m / 2 = ${F(v / 100)} m`, `l = ${F(v)} cm`], meta: { f: f * 1e6, k } });
  });
  add(CATS[2], 'Antennengewinn: dBd und dBi', 1, 'dbd_dbi', (R) => {
    const dir = pick(R, ['dbi', 'dbd']);
    if (dir === 'dbi') {
      const g = pick(R, [1.5, 3, 5, 6.5, 8, 10, 12, 14]), v = C.dbiFromDbd(g);
      return out({ text: `Im Datenblatt einer Richtantenne steht der Gewinn G = ${N(g)} dBd (bezogen auf den Halbwellendipol). Wie groß ist der Gewinn in dBi (bezogen auf den Kugelstrahler)? Der Halbwellendipol selbst hat 2,15 dBi.`, label: 'Gewinn', unit: 'dBi', value: v,
        tips: ['Der Kugelstrahler strahlt in alle Richtungen gleich. Der Dipol bündelt schon ein wenig. Darum ist die Zahl in dBi immer größer als in dBd.', 'G in dBi = G in dBd + 2,15 dB.', `G = ${N(g)} dBd + 2,15 dB.`],
        steps: ['G in dBi = G in dBd + 2,15 dB', `G = ${N(g)} + 2,15 = ${Fd(v)} dBi`], meta: { dir, g } });
    }
    const g = pick(R, [3, 5, 8, 9.5, 11, 14, 17]), v = C.dbdFromDbi(g);
    return out({ text: `Eine Antenne hat laut Hersteller den Gewinn G = ${N(g)} dBi (bezogen auf den Kugelstrahler). Wie groß ist der Gewinn in dBd (bezogen auf den Halbwellendipol)? Der Halbwellendipol selbst hat 2,15 dBi.`, label: 'Gewinn', unit: 'dBd', value: v,
      tips: ['Der Dipol ist schon etwas besser als der Kugelstrahler. Gegen den Dipol gemessen ist der Gewinn deshalb kleiner.', 'G in dBd = G in dBi − 2,15 dB.', `G = ${N(g)} dBi − 2,15 dB.`],
      steps: ['G in dBd = G in dBi − 2,15 dB', `G = ${N(g)} − 2,15 = ${Fd(v)} dBd`], meta: { dir, g } });
  });
  add(CATS[2], 'Strahlungsleistung EIRP', 2, 'eirp', (R) => {
    const p = pick(R, [10, 14, 20, 27, 30, 33, 37]), a = pick(R, [0.5, 1, 1.5, 2, 3]), g = pick(R, [2.15, 5, 8, 11, 14]), v = C.eirpDbm(p, a, g);
    return out({ text: `Ein Sender liefert P_S = ${N(p)} dBm. Das Antennenkabel dämpft ${N(a)} dB, die Antenne hat ${N(g)} dBi Gewinn. Wie groß ist die äquivalente isotrope Strahlungsleistung (EIRP) in dBm?`, label: 'EIRP', unit: 'dBm', value: v,
      tips: ['Die EIRP sagt, welche Leistung ein Kugelstrahler bräuchte, um in der Hauptrichtung gleich stark zu strahlen.', 'EIRP = P_S − a_Kabel + G_Antenne (alles in dB gerechnet).', `EIRP = ${N(p)} dBm − ${N(a)} dB + ${N(g)} dBi.`],
      steps: ['EIRP = P_S − a_Kabel + G', `EIRP = ${N(p)} − ${N(a)} + ${N(g)} = ${Fd(v)} dBm`], meta: { p, a, g } });
  });
  add(CATS[2], 'Freiraumdämpfung', 2, 'fspl', (R) => {
    const d = pick(R, [0.5, 1, 2, 5, 10, 20, 40]), f = pick(R, [145, 433, 868, 2400, 5800]), v = C.fspl(d, f);
    return out({ text: `Zwischen zwei Antennen mit freier Sicht liegen d = ${N(d)} km. Die Frequenz ist f = ${N(f)} MHz. Wie groß ist die Freiraumdämpfung in dB? ${FSPL_TXT}`, label: 'Freiraumdämpfung', unit: 'dB', value: v,
      tips: ['Die Welle verteilt sich auf eine immer größere Kugelfläche. Darum wächst die Dämpfung mit der Entfernung und mit der Frequenz.', 'a = 32,44 + 20 · lg(d in km) + 20 · lg(f in MHz).', `a = 32,44 + 20 · lg(${N(d)}) + 20 · lg(${N(f)}).`],
      steps: [`20 · lg(${N(d)}) = ${Fd(20 * C.lg(d))} dB`, `20 · lg(${N(f)}) = ${Fd(20 * C.lg(f))} dB`, `a = 32,44 + ${Pn(20 * C.lg(d))} + ${Fd(20 * C.lg(f))} = ${Fd(v)} dB`], meta: { d, f } });
  });
  add(CATS[2], 'Empfangspegel am Ende der Strecke', 2, 'rx_level', (R) => {
    const e = pick(R, [20, 27, 30, 36, 40]), a0 = ri(R, 90, 130), g = pick(R, [0, 2, 5, 8, 12]), lr = pick(R, [0.5, 1, 2]), v = C.rxLevel(e, a0, g, lr);
    return out({ text: `Eine Funkstrecke hat diese Werte: EIRP des Senders ${N(e)} dBm, Streckendämpfung ${N(a0)} dB, Gewinn der Empfangsantenne ${N(g)} dBi, Dämpfung des Empfängerkabels ${N(lr)} dB. Welcher Pegel in dBm liegt am Empfängereingang an?`, label: 'Empfangspegel', unit: 'dBm', value: v,
      tips: ['Gehe die Strecke vom Sender zum Empfänger durch. Jeder Gewinn kommt dazu, jede Dämpfung geht ab.', 'P_E = EIRP − a_Strecke + G_E − a_Kabel.', `P_E = ${N(e)} dBm − ${N(a0)} dB + ${N(g)} dBi − ${N(lr)} dB.`],
      steps: ['P_E = EIRP − a_Strecke + G_E − a_Kabel', `P_E = ${N(e)} − ${N(a0)} + ${N(g)} − ${N(lr)} = ${Fd(v)} dBm`], meta: { e, a0, g, lr } });
  });
  add(CATS[2], 'Streckenreserve', 1, 'margin', (R) => {
    const p = ri(R, -95, -70), s = ri(R, -112, -98), v = C.linkMargin(p, s);
    return out({ text: `Am Empfängereingang kommen P_E = ${N(p)} dBm an. Der Empfänger braucht mindestens ${N(s)} dBm (Empfindlichkeit). Wie groß ist die Streckenreserve in dB?`, label: 'Streckenreserve', unit: 'dB', value: v,
      tips: ['Die Reserve ist der Abstand zwischen dem, was ankommt, und dem, was der Empfänger mindestens braucht.', 'Reserve = P_E − P_min. Achte auf die Vorzeichen: minus mal minus ergibt plus.', `Reserve = ${N(p)} dBm − (${N(s)} dBm).`],
      steps: ['Reserve = P_E − P_min', `Reserve = ${Pn(p)} − ${Pn(s)} = ${Fd(v)} dB`], meta: { p, s } });
  });
  add(CATS[2], 'Pegel bei größerer Entfernung', 2, 'dist_change', (R) => {
    const l = ri(R, -80, -50), d1 = pick(R, [0.5, 1, 2, 3, 5]), k = pick(R, [2, 4, 10]), d2 = d1 * k, ch = C.distChange(k), v = l + ch;
    return out({ text: `In d₁ = ${N(d1)} km Entfernung vom Sender misst du bei freier Sicht den Empfangspegel ${N(l)} dBm. Welchen Pegel in dBm erwartest du in d₂ = ${N(d2)} km Entfernung, wenn sonst alles gleich bleibt (Freiraumausbreitung)?`, label: 'Empfangspegel', unit: 'dBm', value: v,
      tips: ['Im Freiraum nimmt die Leistung mit dem Quadrat der Entfernung ab: doppelte Entfernung, ein Viertel der Leistung. Jede Verdopplung der Entfernung kostet rund 6 dB.', 'ΔL = −20 · lg(d₂ / d₁), dann L₂ = L₁ + ΔL.', `ΔL = −20 · lg(${N(d2)} km / ${N(d1)} km), dann L₂ = ${N(l)} dBm + ΔL.`],
      steps: [`d₂ / d₁ = ${N(d2)} km / ${N(d1)} km = ${F(k)}`, `ΔL = −20 · lg(${F(k)}) = ${Fd(ch)} dB`, `L₂ = ${Pn(l)} + ${Pn(ch)} = ${Fd(v)} dBm`], meta: { l, d1, d2 } });
  });
  add(CATS[2], 'Größte Entfernung für eine Funkstrecke', 3, 'max_dist', (R) => {
    const [f, as] = pick(R, [[145, [90, 95, 100, 105]], [433, [100, 105, 110, 115]], [868, [100, 105, 110, 115, 120]], [2400, [100, 105, 110, 115, 120]]]), a = pick(R, as), v = C.maxDistKm(a, f), lf = 20 * C.lg(f);
    return out({ text: `Eine Funkstrecke bei f = ${N(f)} MHz verträgt höchstens a_max = ${N(a)} dB Streckendämpfung. Wie weit dürfen die Antennen bei freier Sicht höchstens auseinander stehen? ${FSPL_TXT}`, label: 'Größte Entfernung', unit: 'km', value: v,
      tips: ['Stelle die Formel der Freiraumdämpfung nach dem Entfernungsteil um. Am Ende machst du den Logarithmus rückgängig.', '20 · lg(d) = a_max − 32,44 − 20 · lg(f), dann d = 10^(Ergebnis / 20).', `20 · lg(d) = ${N(a)} − 32,44 − 20 · lg(${N(f)}).`],
      steps: [`20 · lg(${N(f)}) = ${Fd(lf)} dB`, `20 · lg(d) = ${N(a)} − 32,44 − ${Fd(lf)} = ${Fd(a - C.K_FSPL - lf)} dB`, `d = 10^(${Fd(a - C.K_FSPL - lf)} / 20) = ${F(v)} km`], meta: { f, a } });
  });
  add(CATS[2], 'Komplette Funkstrecke mit Reserve', 3, 'full_link', (R) => {
    const p = pick(R, [10, 14, 20, 27]), gt = pick(R, [2, 5, 8]), gr = pick(R, [2, 5, 8]), d = pick(R, [1, 2, 5, 10]), f = pick(R, [433, 868, 2450]), s = pick(R, [-100, -105, -110]);
    const a = C.fspl(d, f), rx = C.rxLevel(C.eirpDbm(p, 0, gt), a, gr, 0), v = C.linkMargin(rx, s);
    return out({ text: `Funkstrecke bei f = ${N(f)} MHz über d = ${N(d)} km mit freier Sicht: Sendeleistung ${N(p)} dBm, Antennengewinn am Sender ${N(gt)} dBi, am Empfänger ${N(gr)} dBi. Kabelverluste werden vernachlässigt. Der Empfänger braucht mindestens ${N(s)} dBm. Wie groß ist die Streckenreserve in dB? ${FSPL_TXT} Eine fehlende Reserve gibst du als negative Zahl an.`, label: 'Streckenreserve', unit: 'dB', value: v,
      tips: ['Rechne in drei Schritten: Freiraumdämpfung, Empfangspegel, Abstand zur Empfindlichkeit.', 'a = 32,44 + 20 · lg(d) + 20 · lg(f), P_E = P_S + G_S + G_E − a, Reserve = P_E − P_min.', `a = 32,44 + 20 · lg(${N(d)}) + 20 · lg(${N(f)}), P_E = ${N(p)} + ${N(gt)} + ${N(gr)} − a, Reserve = P_E − (${N(s)}).`],
      steps: [`a = 32,44 + 20 · lg(${N(d)}) + 20 · lg(${N(f)}) = ${Fd(a)} dB`, `P_E = ${N(p)} + ${N(gt)} + ${N(gr)} − ${Fd(a)} = ${Fd(rx)} dBm`, `Reserve = ${Pn(rx)} − ${Pn(s)} = ${Fd(v)} dB`], meta: { p, gt, gr, d, f, s } });
  });

  /* ============================================================ 4  Modulation */
  add(CATS[3], 'Modulationsgrad aus dem Modulationstrapez', 1, 'am_trapez', (R) => {
    /* der Schirm ist 8 Skalenteile hoch */
    const a = pick(R, [4, 5, 6, 7, 8]), b = pick(R, [0.5, 1, 1.5, 2, 2.5, 3]), v = C.amDepth(a, b) * 100, st = x => (x === 1 ? 'Skalenteil' : 'Skalenteile');
    return out({ text: `Auf dem Oszilloskop steht das Modulationstrapez eines AM-Senders. Die lange Seite ist a = ${N(a)} ${st(a)} hoch, die kurze Seite b = ${N(b)} ${st(b)}. Wie groß ist der Modulationsgrad in Prozent?`, label: 'Modulationsgrad', unit: '%', value: v,
      tips: ['Die lange Seite zeigt die größte, die kurze Seite die kleinste Höhe der Hüllkurve. Bei 100 % wäre die kurze Seite null (ein Dreieck).', 'm = (a − b) / (a + b).', `m = (${N(a)} − ${N(b)}) / (${N(a)} + ${N(b)}).`],
      steps: ['m = (a − b) / (a + b)', `m = ${F(a - b)} / ${F(a + b)} = ${F(v / 100)}`, `m = ${F(v)} %`], meta: { a, b } });
  });
  add(CATS[3], 'Höchste Tonfrequenz bei AM', 1, 'am_fmax', (R) => {
    const B = pick(R, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20]), v = B / C.amBandwidth(1);
    return out({ text: `Ein AM-Sender mit beiden Seitenbändern darf höchstens B = ${N(B)} kHz Bandbreite belegen. Bis zu welcher höchsten Modulationsfrequenz darf das Tonsignal reichen?`, label: 'Höchste Modulationsfrequenz', unit: 'kHz', value: v,
      tips: ['Bei AM entsteht links und rechts vom Träger je ein Seitenband. Jedes ist so breit wie die höchste Tonfrequenz.', 'B = 2 · f_m,max, also f_m,max = B / 2.', `f_m,max = ${N(B)} kHz / 2.`],
      steps: ['B = 2 · f_m,max, umgestellt: f_m,max = B / 2', `f_m,max = ${N(B)} kHz / 2 = ${F(v)} kHz`], meta: { B } });
  });
  add(CATS[3], 'Leistung in den Seitenbändern', 3, 'am_sb_power', (R) => {
    const pc = pick(R, [10, 25, 50, 100, 250, 400]), m = pick(R, [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1]), v = C.amSidebandPower(pc, m);
    return out({ text: `Ein AM-Sender hat die Trägerleistung P_T = ${N(pc)} W. Er wird mit einem Sinuston und dem Modulationsgrad m = ${N(m)} moduliert. Welche Leistung steckt in beiden Seitenbändern zusammen?`, label: 'Seitenbandleistung', unit: 'W', value: v,
      tips: ['Jede Seitenlinie hat die Amplitude m/2 des Trägers. Die Leistung hängt am Quadrat der Amplitude, und es gibt zwei Seitenbänder.', 'P_SB = P_T · m² / 2 (beide Seitenbänder zusammen).', `P_SB = ${N(pc)} W · ${N(m)}² / 2.`],
      steps: ['P_SB = P_T · m² / 2', `m² = ${F(m * m)}`, `P_SB = ${N(pc)} W · ${F(m * m)} / 2 = ${F(v)} W`], meta: { pc, m } });
  });
  add(CATS[3], 'Modulationsindex beim FM-Sprechfunk', 1, 'fm_index', (R) => {
    const df = pick(R, [1.5, 2.5, 3, 4, 5]), fm = pick(R, [0.3, 0.5, 1, 1.25, 2, 2.5, 3]), v = C.fmIndex(df, fm);
    return out({ text: `Ein FM-Sprechfunkgerät (Schmalband-FM) hat den Frequenzhub Δf = ${N(df)} kHz. Es wird mit einem Ton von f_m = ${N(fm)} kHz moduliert. Wie groß ist der Modulationsindex?`, label: 'Modulationsindex', unit: '', value: v,
      tips: ['Der Modulationsindex vergleicht, wie weit die Frequenz ausschlägt, mit der Frequenz des Tons.', 'η = Δf / f_m (auch β genannt).', `η = ${N(df)} kHz / ${N(fm)} kHz.`],
      steps: ['η = Δf / f_m', `η = ${N(df)} kHz / ${N(fm)} kHz = ${F(v)}`], meta: { df, fm }, tolo: { abs: 0.01 } });
  });
  add(CATS[3], 'Bandbreite eines FM-Funkkanals', 2, 'carson', (R) => {
    const df = pick(R, [1.5, 2.5, 4, 5]), fm = pick(R, [2.55, 2.7, 3, 3.4]), v = C.carson(df, fm);
    return out({ text: `Ein FM-Sprechfunkgerät für das ${df >= 4 ? '25-kHz-Kanalraster' : '12,5-kHz-Kanalraster'} arbeitet mit dem Frequenzhub Δf = ${N(df)} kHz. Die höchste Modulationsfrequenz ist ${N(fm)} kHz. Welche Bandbreite braucht das Signal nach der Carson-Regel?`, label: 'Bandbreite', unit: 'kHz', value: v,
      tips: ['FM braucht mehr Platz als nur den Hub. Auch die Tonfrequenz zählt mit, und zwar auf beiden Seiten des Trägers.', 'B = 2 · (Δf + f_m,max).', `B = 2 · (${N(df)} kHz + ${N(fm)} kHz).`],
      steps: ['B = 2 · (Δf + f_m,max)', `B = 2 · ${F(df + fm)} kHz = ${F(v)} kHz`], meta: { df, fm } });
  });
  const SCHEMES = [[2, 'BPSK'], [4, 'QPSK'], [8, '8-PSK'], [16, '16-QAM'], [32, '32-QAM'], [64, '64-QAM'], [256, '256-QAM'], [1024, '1024-QAM'], [128, '128-QAM'], [512, '512-QAM'], [4096, '4096-QAM']];
  add(CATS[3], 'Bit je Symbol', 1, 'bits_sym', (R) => {
    if (pick(R, ['k', 'k', 'M']) === 'M') {   /* umgekehrte Richtung: aus der Bitzahl die Zahl der Zustände */
      const k = ri(R, 2, 10), M = Math.pow(2, k);
      return out({ text: `Ein digitales Modulationsverfahren soll mit jedem Symbol ${k} Bit übertragen. Wie viele verschiedene Symbole (Zustände) muss es dafür mindestens unterscheiden?`, label: 'Zahl der Zustände', unit: '', value: M,
        tips: ['Mit jedem zusätzlichen Bit verdoppelt sich die Zahl der möglichen Zustände. Ein Bit hat 2 Zustände, zwei Bit haben 4.', 'M = 2^k. Du nimmst die 2 also k-mal mit sich selbst mal.', `Rechne M = 2^${k} aus: Nimm die 2 genau ${k}-mal mit sich selbst mal.`],
        steps: ['M = 2^k', `M = 2^${k} = ${F(M)} Zustände`], meta: { M, dir: 'M' }, tolo: { abs: 0.01, rel: 0 } });
    }
    const [M, name] = pick(R, SCHEMES), v = C.bitsPerSymbol(M);
    return out({ text: `Das Modulationsverfahren ${name} kennt ${M} verschiedene Symbole (Zustände). Wie viele Bit überträgt ein Symbol?`, label: 'Bit je Symbol', unit: 'bit', value: v,
      tips: ['Mit jedem zusätzlichen Bit verdoppelt sich die Zahl der möglichen Zustände. Frage dich: Wie oft musst du 2 mit sich selbst malnehmen?', 'k = log₂(M), also 2^k = M.', `Suche die Zahl k, für die 2^k = ${M} gilt.`],
      steps: ['k = log₂(M)', `2^${F(v)} = ${M}, also k = ${F(v)} bit`], meta: { M, dir: 'k' }, tolo: { abs: 0.01, rel: 0 } });
  });
  add(CATS[3], 'Bitrate aus der Symbolrate', 2, 'bitrate', (R) => {
    const rs = pick(R, [9.6, 24, 48, 125, 250, 500, 1000]), [M, name] = pick(R, [SCHEMES[1], SCHEMES[2], SCHEMES[3], SCHEMES[5]]), k = C.bitsPerSymbol(M), v = C.bitRate(rs, M);
    return out({ text: `Eine Datenfunkstrecke sendet mit der Symbolrate ${N(rs)} kBd (1 kBd sind 1000 Symbole je Sekunde) und dem Verfahren ${name} mit ${M} Zuständen. Wie groß ist die Bitrate in kbit/s?`, label: 'Bitrate', unit: 'kbit/s', value: v,
      tips: ['Jedes Symbol trägt mehrere Bit. Finde zuerst heraus, wie viele Bit in einem Symbol stecken.', 'k = log₂(M) und Bitrate = Symbolrate · k.', `k = log₂(${M}), Bitrate = ${N(rs)} kBd · k.`],
      steps: [`k = log₂(${M}) = ${F(k)} bit je Symbol`, 'Bitrate = Symbolrate · k', `Bitrate = ${N(rs)} kBd · ${F(k)} = ${F(v)} kbit/s`], meta: { rs, M } });
  });
  add(CATS[3], 'Bandbreite mit Roll-off-Faktor', 3, 'bw_rolloff', (R) => {
    const rb = pick(R, [64, 128, 256, 512, 1024, 2048]), [M, name] = pick(R, [SCHEMES[1], SCHEMES[2], SCHEMES[3]]), al = pick(R, [0.2, 0.25, 0.35, 0.5]), k = C.bitsPerSymbol(M), rs = C.symRate(rb, M), v = C.bwRolloff(rs, al);
    return out({ text: `Über eine Funkstrecke sollen ${N(rb)} kbit/s mit ${name} (${F(k)} Bit je Symbol) übertragen werden. Das Sendefilter hat den Roll-off-Faktor α = ${N(al)}. Welche Bandbreite belegt das Signal? Benutze B = Symbolrate · (1 + α).`, label: 'Bandbreite', unit: 'kHz', value: v,
      tips: ['Die Bandbreite hängt an der Symbolrate, nicht an der Bitrate. Rechne zuerst aus, wie viele Symbole je Sekunde nötig sind.', 'Symbolrate = Bitrate / k und B = Symbolrate · (1 + α).', `Symbolrate = ${N(rb)} kbit/s / ${F(k)}, dann B = Symbolrate · (1 + ${N(al)}).`],
      steps: [`Symbolrate = ${N(rb)} kbit/s / ${F(k)} = ${F(rs)} kBd`, 'B = Symbolrate · (1 + α)', `B = ${F(rs)} kHz · ${F(1 + al)} = ${F(v)} kHz`], meta: { rb, M, al } });
  });
  add(CATS[3], 'Modulationsindex bei FSK', 2, 'fsk', (R) => {
    /* nur Paare, die es in der Praxis gibt: h liegt zwischen 0,5 und 5 */
    const [f0, f1, rbs] = pick(R, [[1200, 2200, [300, 600, 1200]], [1300, 2100, [600, 1200]], [1070, 1270, [100, 300]], [2025, 2225, [50, 75, 100, 300]], [1275, 1445, [50, 75, 100]], [1615, 1785, [50, 100]]]), rb = pick(R, rbs), sh = C.fskShift(f0, f1), v = C.fskIndex(sh, rb);
    return out({ text: `Ein FSK-Modem sendet eine 0 als Ton mit f₀ = ${N(f0)} Hz und eine 1 als Ton mit f₁ = ${N(f1)} Hz. Die Bitrate ist ${N(rb)} bit/s. Wie groß ist der Modulationsindex h (Frequenzabstand geteilt durch Bitrate)?`, label: 'Modulationsindex h', unit: '', value: v,
      tips: ['Bei FSK springt die Frequenz zwischen zwei Werten. Der Abstand der beiden Frequenzen heißt Frequenzabstand oder Shift.', 'Shift = f₁ − f₀ und h = Shift / Bitrate.', `h = (${N(f1)} Hz − ${N(f0)} Hz) / ${N(rb)} bit/s.`],
      steps: [`Shift = f₁ − f₀ = ${N(f1)} Hz − ${N(f0)} Hz = ${F(sh)} Hz`, 'h = Shift / Bitrate', `h = ${F(sh)} Hz / ${N(rb)} bit/s = ${F(v)}`], meta: { f0, f1, rb }, tolo: { abs: 0.01 } });
  });

  /* ============================================================ 5  Empfänger und Rauschen */
  add(CATS[4], 'Thermisches Rauschen in der Bandbreite', 1, 'noise_thermal', (R) => {
    const b = pick(R, [500, 2700, 12500, 25000, 200000, 1000000, 5000000, 20000000]), v = C.noiseDbm(b);
    return out({ text: `Ein Empfänger hat die Bandbreite B = ${C.fmtHz(b, 7)}. Wie groß ist die thermische Rauschleistung in dieser Bandbreite in dBm? Rechne bei Raumtemperatur mit −174 dBm je Hz.`, label: 'Rauschleistung', unit: 'dBm', value: v,
      tips: ['Jedes Hertz Bandbreite bringt gleich viel Rauschen mit. Mehr Bandbreite bedeutet mehr Rauschen: zehnfache Bandbreite, 10 dB mehr.', 'P_N = −174 dBm + 10 · lg(B in Hz).', `P_N = −174 dBm + 10 · lg(${N(b)}).`],
      steps: ['P_N = −174 dBm + 10 · lg(B / 1 Hz)', `10 · lg(${N(b)}) = ${Fd(10 * C.lg(b))} dB`, `P_N = −174 + ${Fd(10 * C.lg(b))} = ${Fd(v)} dBm`], meta: { b } });
  });
  add(CATS[4], 'Rauschboden mit Rauschmaß', 2, 'noise_floor', (R) => {
    const b = pick(R, BANDS), nf = pick(R, [3, 5, 6, 8, 10]), kt = C.noiseDbm(b), v = C.noiseFloor(b, nf);
    return out({ text: `Ein Empfänger hat die Bandbreite B = ${C.fmtHz(b, 7)} und das Rauschmaß F = ${N(nf)} dB. Wie groß ist sein Rauschboden in dBm? Rechne mit −174 dBm je Hz.`, label: 'Rauschboden', unit: 'dBm', value: v,
      tips: ['Der Empfänger rauscht selbst. Das Rauschmaß sagt, um wie viel dB er schlechter ist als ein gedachter Empfänger ohne Eigenrauschen.', 'P_N = −174 dBm + 10 · lg(B in Hz) + F.', `P_N = −174 dBm + 10 · lg(${N(b)}) + ${N(nf)} dB.`],
      steps: [`Thermisches Rauschen: −174 + 10 · lg(${N(b)}) = ${Fd(kt)} dBm`, `Rauschboden: ${Pn(kt)} + ${N(nf)} = ${Fd(v)} dBm`], meta: { b, nf } });
  });
  add(CATS[4], 'Empfindlichkeit eines Empfängers', 3, 'sens', (R) => {
    const b = pick(R, BANDS), nf = pick(R, [4, 6, 7, 9]), snr = pick(R, [6, 10, 12, 20]), fl = C.noiseFloor(b, nf), v = C.sensitivity(b, nf, snr);
    return out({ text: `Ein Empfänger hat die Bandbreite B = ${C.fmtHz(b, 7)} und das Rauschmaß F = ${N(nf)} dB. Der Demodulator braucht mindestens ${N(snr)} dB Signal-Rausch-Abstand. Wie groß ist die Empfindlichkeit (der kleinste brauchbare Eingangspegel) in dBm? Rechne mit −174 dBm je Hz.`, label: 'Empfindlichkeit', unit: 'dBm', value: v,
      tips: ['Das Signal muss um den geforderten Abstand über dem Rauschboden liegen. Bestimme also zuerst den Rauschboden.', 'P_min = −174 dBm + 10 · lg(B in Hz) + F + SNR.', `P_min = −174 + 10 · lg(${N(b)}) + ${N(nf)} + ${N(snr)}.`],
      steps: [`Rauschboden: −174 + 10 · lg(${N(b)}) + ${N(nf)} = ${Fd(fl)} dBm`, 'P_min = Rauschboden + SNR', `P_min = ${Pn(fl)} + ${N(snr)} = ${Fd(v)} dBm`], meta: { b, nf, snr } });
  });
  add(CATS[4], 'Gesamtverstärkung der Empfangskette', 1, 'chain_gain', (R) => {
    const a = pick(R, [1, 2, 3]), g1 = pick(R, [15, 18, 20, 22]), c = pick(R, [6, 7, 8]), g2 = pick(R, [30, 40, 50, 60]), v = C.chainGain([-a, g1, -c, g2]);
    return out({ text: `Eine Empfangskette besteht aus einem Vorfilter mit ${N(a)} dB Dämpfung, einem Vorverstärker mit ${N(g1)} dB Verstärkung, einem Mischer mit ${N(c)} dB Mischdämpfung und einem ZF-Verstärker mit ${N(g2)} dB Verstärkung. Wie groß ist die Gesamtverstärkung in dB?`, label: 'Gesamtverstärkung', unit: 'dB', value: v,
      tips: ['In dB gerechnet werden hintereinander geschaltete Stufen einfach zusammengezählt. Dämpfungen zählen negativ.', 'g_ges = −a_Filter + g_Vorverstärker − a_Mischer + g_ZF.', `g_ges = −${N(a)} + ${N(g1)} − ${N(c)} + ${N(g2)} in dB.`],
      steps: ['g_ges = −a_Filter + g_Vorverstärker − a_Mischer + g_ZF', `g_ges = −${N(a)} + ${N(g1)} − ${N(c)} + ${N(g2)} = ${Fd(v)} dB`], meta: { a, g1, c, g2 } });
  });
  add(CATS[4], 'Spiegelfrequenz eines Überlagerungsempfängers', 2, 'image', (R) => {
    const frx = pick(R, [89.3, 92.4, 95.8, 98.2, 101.7, 104.6]), fif = pick(R, [10.7, 21.4]), side = pick(R, ['oben', 'unten']), lo = C.loFreq(frx, fif, side), v = C.imageFreq(frx, fif, side), sg = side === 'oben' ? '+' : '−';
    return out({ text: `Ein Überlagerungsempfänger ist auf f_E = ${N(frx)} MHz abgestimmt. Die Zwischenfrequenz ist f_ZF = ${N(fif)} MHz. Der Oszillator schwingt ${side === 'oben' ? 'oberhalb' : 'unterhalb'} der Empfangsfrequenz (f_O = f_E ${sg} f_ZF). Auf welcher Frequenz liegt die Spiegelfrequenz?`, label: 'Spiegelfrequenz', unit: 'MHz', value: v,
      tips: ['Der Mischer bildet den Abstand zum Oszillator. Eine zweite Frequenz hat denselben Abstand, nur auf der anderen Seite des Oszillators.', `f_Spiegel = f_E ${sg} 2 · f_ZF (der Oszillator liegt genau in der Mitte).`, `f_Spiegel = ${N(frx)} MHz ${sg} 2 · ${N(fif)} MHz.`],
      steps: [`Oszillator: f_O = ${N(frx)} MHz ${sg} ${N(fif)} MHz = ${F(lo, 6)} MHz`, `f_Spiegel = f_O ${sg} f_ZF = f_E ${sg} 2 · f_ZF`, `f_Spiegel = ${N(frx)} MHz ${sg} ${F(2 * fif, 6)} MHz = ${F(v, 6)} MHz`], meta: { frx, fif, side }, tolo: { abs: 0.05, rel: 0 } });
  });
  add(CATS[4], 'Mischprodukte', 1, 'mixer', (R) => {
    const f1 = pick(R, [27, 50, 100, 144, 430]), f2 = C.rd(f1 + pick(R, [10.7, 21.4, 45]), 3), which = pick(R, ['Summe', 'Differenz']), v = which === 'Summe' ? C.mixSum(f1, f2) : C.mixDiff(f1, f2);
    return out({ text: `An einem Mischer liegen das Eingangssignal f₁ = ${N(f1)} MHz und das Oszillatorsignal f₂ = ${N(f2)} MHz. Am Ausgang entstehen die Summenfrequenz und die Differenzfrequenz. Wie groß ist die ${which === 'Summe' ? 'Summenfrequenz' : 'Differenzfrequenz'}?`, label: which === 'Summe' ? 'Summenfrequenz' : 'Differenzfrequenz', unit: 'MHz', value: v,
      tips: ['Ein Mischer multipliziert zwei Schwingungen. Dabei entstehen zwei neue Frequenzen: eine über und eine unter den beiden.', which === 'Summe' ? 'f_Summe = f₁ + f₂.' : 'f_Differenz = f₂ − f₁ (die größere minus die kleinere Frequenz).', which === 'Summe' ? `f_Summe = ${N(f1)} MHz + ${N(f2)} MHz.` : `f_Differenz = ${N(f2)} MHz − ${N(f1)} MHz.`],
      steps: which === 'Summe' ? ['f_Summe = f₁ + f₂', `f_Summe = ${N(f1)} MHz + ${N(f2)} MHz = ${F(v, 6)} MHz`] : ['f_Differenz = f₂ − f₁', `f_Differenz = ${N(f2)} MHz − ${N(f1)} MHz = ${F(v, 6)} MHz`], meta: { f1, f2, which }, tolo: { abs: 0.05, rel: 0 } });
  });
  add(CATS[4], 'Zwischenfrequenz passend wählen', 2, 'if_min', (R) => {
    const d = pick(R, [20, 30, 42, 60, 90, 140]), v = C.ifMin(d);
    return out({ text: `Das Vorfilter eines Empfängers unterdrückt alle Signale ausreichend, die mindestens ${N(d)} MHz neben der Empfangsfrequenz liegen. Wie groß muss die Zwischenfrequenz mindestens sein, damit die Spiegelfrequenz in diesem gesperrten Bereich liegt?`, label: 'Kleinste Zwischenfrequenz', unit: 'MHz', value: v,
      tips: ['Überlege, wie weit die Spiegelfrequenz von der Empfangsfrequenz entfernt ist. Der Oszillator liegt genau dazwischen.', 'Abstand der Spiegelfrequenz = 2 · f_ZF, also f_ZF = Abstand / 2.', `f_ZF = ${N(d)} MHz / 2.`],
      steps: ['Die Spiegelfrequenz liegt 2 · f_ZF neben der Empfangsfrequenz', `2 · f_ZF = ${N(d)} MHz, also f_ZF = ${N(d)} MHz / 2 = ${F(v)} MHz`], meta: { d } });
  });
  add(CATS[4], 'Dynamikbereich eines Empfängers', 3, 'dyn', (R) => {
    const lm = pick(R, [-20, -15, -10, -5, 0]), b = pick(R, [2700, 12500, 25000, 200000]), nf = pick(R, [5, 8, 10]), fl = C.noiseFloor(b, nf), v = C.dynRange(lm, fl);
    return out({ text: `Ein Empfänger verarbeitet Eingangspegel bis höchstens ${N(lm)} dBm ohne Verzerrung. Seine Bandbreite ist B = ${C.fmtHz(b, 7)}, sein Rauschmaß F = ${N(nf)} dB. Wie groß ist der Dynamikbereich zwischen Rauschboden und größtem Pegel in dB? Rechne mit −174 dBm je Hz.`, label: 'Dynamikbereich', unit: 'dB', value: v,
      tips: ['Der Dynamikbereich ist der Abstand zwischen dem leisesten und dem lautesten Signal, das der Empfänger verarbeiten kann. Unten begrenzt das Rauschen.', 'Rauschboden = −174 dBm + 10 · lg(B in Hz) + F, Dynamik = L_max − Rauschboden.', `Rauschboden = −174 + 10 · lg(${N(b)}) + ${N(nf)}, Dynamik = ${N(lm)} dBm − Rauschboden.`],
      steps: [`Rauschboden: −174 + 10 · lg(${N(b)}) + ${N(nf)} = ${Fd(fl)} dBm`, 'Dynamik = L_max − Rauschboden', `Dynamik = ${Pn(lm)} − ${Pn(fl)} = ${Fd(v)} dB`], meta: { lm, b, nf } });
  });
  add(CATS[4], 'Dämpfungsglied zum Schutz des Eingangs', 2, 'att_protect', (R) => {
    const p = pick(R, [1, 2, 5, 10, 25, 50]), lm = pick(R, [20, 27, 30]), lp = C.dbmFromW(p), v = C.attNeeded(lp, lm);
    return out({ text: `Du willst einen Sender mit P = ${N(p)} W an einem Spektrumanalysator messen. Laut Datenblatt liegt die Zerstörgrenze des Eingangs bei ${N(lm)} dBm: Mehr darf nie anliegen, sonst geht der Eingang kaputt. Das Dämpfungsglied selbst hält die Sendeleistung aus. Wie viel dB muss ein vorgeschaltetes Dämpfungsglied mindestens haben, damit der Pegel am Eingang genau auf dieser Grenze liegt? Gib den gerechneten Mindestwert an, nicht den nächsten Normwert.`, label: 'Mindestdämpfung', unit: 'dB', value: v,
      tips: ['Rechne die Sendeleistung zuerst in dBm um. Das Dämpfungsglied muss den Unterschied zum erlaubten Pegel wegnehmen.', 'L_S = 10 · lg(P / 1 mW) und a_min = L_S − L_max.', `L_S = 10 · lg(${N(p * 1000)} mW / 1 mW), a_min = L_S − ${N(lm)} dBm.`],
      steps: [`L_S = 10 · lg(${N(p * 1000)} mW / 1 mW) = ${Fd(lp)} dBm`, 'a_min = L_S − L_max', `a_min = ${Fd(lp)} − ${N(lm)} = ${Fd(v)} dB`], meta: { p, lm } });
  });

  /* ============================================================ 6  Messen in der HF-Technik */
  add(CATS[5], 'Anzeige mit externem Dämpfungsglied', 1, 'sa_att', (R) => {
    const rdg = ri(R, -30, 5), att = pick(R, [10, 20, 30, 40]), v = C.saTrue(rdg, att);
    return out({ text: `Vor dem Eingang eines Spektrumanalysators sitzt ein externes Dämpfungsglied mit ${N(att)} dB. Der Analysator zeigt ${N(rdg)} dBm an und berücksichtigt das Dämpfungsglied nicht. Wie groß ist der wahre Pegel der Quelle in dBm?`, label: 'Pegel der Quelle', unit: 'dBm', value: v,
      tips: ['Das Dämpfungsglied hat den Pegel verkleinert, bevor der Analysator misst. Die Quelle ist also stärker als die Anzeige.', 'L_Quelle = Anzeige + a_extern.', `L_Quelle = ${N(rdg)} dBm + ${N(att)} dB.`],
      steps: ['L_Quelle = Anzeige + a_extern', `L_Quelle = ${Pn(rdg)} + ${N(att)} = ${Fd(v)} dBm`], meta: { rdg, att } });
  });
  add(CATS[5], 'Auflösebandbreite und Rauschboden', 2, 'rbw', (R) => {
    const L = [1e3, 3e3, 1e4, 3e4, 1e5, 3e5, 1e6], b1 = pick(R, L), b2 = pick(R, L.filter(x => x !== b1)), nf = pick(R, [20, 22, 25, 28, 30, 35]), l1 = Math.round(C.noiseFloor(b1, nf)), ch = C.rbwChange(b1, b2), v = l1 + ch;
    return out({ text: `Ein Spektrumanalysator zeigt bei der Auflösebandbreite RBW = ${C.fmtHz(b1, 7)} einen Rauschboden von ${N(l1)} dBm. Du stellst die RBW auf ${C.fmtHz(b2, 7)} um. Welchen Rauschboden in dBm zeigt er jetzt?`, label: 'Neuer Rauschboden', unit: 'dBm', value: v,
      tips: ['Durch ein schmaleres Filter kommt weniger Rauschleistung. Die Rauschleistung ändert sich im selben Verhältnis wie die Bandbreite.', 'ΔL = 10 · lg(RBW₂ / RBW₁), dann L₂ = L₁ + ΔL.', `ΔL = 10 · lg(${N(b2)} Hz / ${N(b1)} Hz), dann L₂ = ${N(l1)} dBm + ΔL.`],
      steps: [`RBW₂ / RBW₁ = ${N(b2)} Hz / ${N(b1)} Hz = ${F(b2 / b1)}`, `ΔL = 10 · lg(${F(b2 / b1)}) = ${Fd(ch)} dB`, `L₂ = ${Pn(l1)} + ${Pn(ch)} = ${Fd(v)} dBm`], meta: { l1, b1, b2, nf } });
  });
  add(CATS[5], 'Leistung aus der Spannung an 50 Ω', 1, 'p_from_u', (R) => {
    const u = pick(R, [0.5, 1, 2, 3, 5, 7, 10, 20, 30, 50]), v = C.powerFromU(u, 50);
    return out({ text: `An einem 50-Ω-Abschlusswiderstand misst du mit einem HF-Tastkopf die Effektivspannung U = ${N(u)} V. Welche Leistung nimmt der Widerstand auf?`, label: 'Leistung', unit: 'W', value: v,
      tips: ['In der HF-Technik misst man oft die Spannung an einem bekannten Widerstand und rechnet daraus die Leistung.', 'P = U² / R.', `P = (${N(u)} V)² / 50 Ω.`],
      steps: ['P = U² / R', `P = ${F(u * u)} V² / 50 Ω = ${F(v)} W`], meta: { u } });
  });
  add(CATS[5], 'Stehwellenverhältnis aus Vorlauf und Rücklauf', 3, 'swr_from_p', (R) => {
    const pf = pick(R, [5, 10, 20, 50, 100]), q = pick(R, [0.01, 0.02, 0.04, 0.09, 0.16, 0.25]), pr = C.rd(pf * q, 6), r = Math.sqrt(pr / pf), v = C.swrFromPowers(pf, pr);
    return out({ text: `Ein Richtkoppler zeigt in der Antennenleitung die Vorlaufleistung P_V = ${N(pf)} W und die Rücklaufleistung P_R = ${N(pr)} W. Wie groß ist das Stehwellenverhältnis s?`, label: 'Stehwellenverhältnis s', unit: '', value: v,
      tips: ['Der Reflexionsfaktor gilt für Spannungen. Aus dem Verhältnis der Leistungen musst du deshalb zuerst die Wurzel ziehen.', '|r| = √(P_R / P_V) und s = (1 + |r|) / (1 − |r|).', `|r| = √(${N(pr)} W / ${N(pf)} W), dann s = (1 + |r|) / (1 − |r|).`],
      steps: [`|r| = √(P_R / P_V) = √(${N(pr)} W / ${N(pf)} W) = ${F(r)}`, 's = (1 + |r|) / (1 − |r|)', `s = ${F(1 + r)} / ${F(1 - r)} = ${F(v)}`], meta: { pf, pr }, tolo: { abs: 0.02 } });
  });
  add(CATS[5], 'Rückflussdämpfung in Stehwellenverhältnis umrechnen', 3, 'rl_to_swr', (R) => {
    const a = pick(R, [6, 8, 9.5, 10, 12, 14, 15, 18, 20, 26]), r = C.gammaFromRL(a), v = C.swrFromRL(a);
    return out({ text: `Ein Netzwerkanalysator misst an einer Antenne die Rückflussdämpfung ${N(a)} dB. Welchem Stehwellenverhältnis s entspricht das?`, label: 'Stehwellenverhältnis s', unit: '', value: v,
      tips: ['Mache aus den dB zuerst wieder einen Reflexionsfaktor. Das ist ein Spannungsverhältnis, also gilt der Faktor 20.', '|r| = 10^(−a_r / 20) und s = (1 + |r|) / (1 − |r|).', `|r| = 10^(−${N(a)} / 20), dann s = (1 + |r|) / (1 − |r|).`],
      steps: [`|r| = 10^(−${N(a)} / 20) = ${F(r)}`, 's = (1 + |r|) / (1 − |r|)', `s = ${F(1 + r)} / ${F(1 - r)} = ${F(v)}`], meta: { a }, tolo: { abs: 0.02 } });
  });
  add(CATS[5], 'Größte Spannung am Abschlusswiderstand', 2, 'dummy_u', (R) => {
    const p = pick(R, [0.5, 1, 2, 5, 10, 25, 50, 100]), v = C.uFromPower(p, 50);
    return out({ text: `Ein 50-Ω-Abschlusswiderstand (Dummy Load) ist für höchstens P = ${N(p)} W Dauerleistung gebaut. Welche Effektivspannung darf höchstens an ihm anliegen?`, label: 'Effektivspannung', unit: 'V', value: v,
      tips: ['Stelle die Leistungsformel nach der Spannung um.', 'P = U² / R, also U = √(P · R).', `U = √(${N(p)} W · 50 Ω).`],
      steps: ['U = √(P · R)', `P · R = ${N(p)} W · 50 Ω = ${F(p * 50)} V²`, `U = √(${F(p * 50)} V²) = ${F(v)} V`], meta: { p } });
  });
  add(CATS[5], 'Scheitelspannung auf der Leitung', 2, 'peak_v', (R) => {
    const p = pick(R, [5, 10, 25, 50, 100, 400, 750]), ue = C.uFromPower(p, 50), v = C.peakFromPower(p, 50);
    return out({ text: `Ein Sender gibt an eine angepasste 50-Ω-Leitung die Leistung P = ${N(p)} W ab (unmodulierter Träger). Wie groß ist der Scheitelwert der Spannung auf der Leitung?`, label: 'Scheitelwert û', unit: 'V', value: v,
      tips: ['Aus Leistung und Widerstand bekommst du den Effektivwert. Bei einer Sinusschwingung ist der Scheitelwert um den Faktor √2 größer.', 'U = √(P · R) und û = √2 · U, zusammen û = √(2 · P · R).', `û = √(2 · ${N(p)} W · 50 Ω).`],
      steps: [`Effektivwert: U = √(${N(p)} W · 50 Ω) = ${F(ue)} V`, 'Scheitelwert: û = √2 · U', `û = ${F(Math.SQRT2, 5)} · ${F(ue)} V = ${F(v)} V`], meta: { p } });
  });
  add(CATS[5], 'Frequenz einer Harmonischen', 1, 'harm', (R) => {
    const f = pick(R, [27, 50, 70, 145, 433, 446]), n = pick(R, [2, 3, 4, 5]), v = C.harmonic(f, n);
    return out({ text: `Ein Sender arbeitet auf f = ${N(f)} MHz. Bei der Messung der Nebenaussendungen suchst du die ${n}. Harmonische (die Grundschwingung zählt als 1. Harmonische). Auf welcher Frequenz liegt sie?`, label: `Frequenz der ${n}. Harmonischen`, unit: 'MHz', value: v,
      tips: ['Harmonische sind ganzzahlige Vielfache der Grundfrequenz. Solche Oberschwingungen entstehen, wenn ein Verstärker die Schwingung verzerrt.', 'f_n = n · f.', `f = ${n} · ${N(f)} MHz.`],
      steps: ['f_n = n · f', `f = ${n} · ${N(f)} MHz = ${F(v, 6)} MHz`], meta: { f, n }, tolo: { abs: 0.05, rel: 0 } });
  });
  add(CATS[5], 'Güte aus der Bandbreite', 2, 'q_bw', (R) => {
    const [f0, bs] = pick(R, [[455, [4, 6, 9, 12]], [10700, [15, 30, 150, 280]], [21400, [15, 30]], [70000, [500, 1000, 2000]], [433920, [600, 1200, 2500]]]), b = pick(R, bs), fu = f0 - b / 2, fo = f0 + b / 2, bw = C.bw3dB(fu, fo), v = C.qFromBw(f0, bw);
    return out({ text: `Die Durchlasskurve eines Filters hat ihr Maximum bei f₀ = ${N(f0)} kHz. Die −3-dB-Punkte liegen bei f_u = ${N(fu)} kHz und f_o = ${N(fo)} kHz. Wie groß ist die Güte Q?`, label: 'Güte Q', unit: '', value: v,
      tips: ['Die Bandbreite ist der Abstand der beiden −3-dB-Punkte. Ein schmales Filter bei hoher Frequenz hat eine hohe Güte.', 'B = f_o − f_u und Q = f₀ / B.', `B = ${N(fo)} kHz − ${N(fu)} kHz, dann Q = ${N(f0)} kHz / B.`],
      steps: [`B = f_o − f_u = ${N(fo)} kHz − ${N(fu)} kHz = ${F(bw)} kHz`, 'Q = f₀ / B', `Q = ${N(f0)} kHz / ${F(bw)} kHz = ${F(v)}`], meta: { f0, fu, fo } });
  });

  /* ============================================================ Lerntexte */
  const BLOCKS = [
    { id: 'peg', tab: 'peg', cat: CATS[0], icon: '📏', title: 'Pegel und Dezibel',
      intro: 'In der Funktechnik liegen zwischen Sender und Empfänger riesige Unterschiede: einige Watt auf der einen Seite, Bruchteile von einem Milliardstel Watt auf der anderen. Mit Dezibel werden daraus handliche Zahlen, und aus Malnehmen wird Zusammenzählen. Schiebe unten die Regler und sieh, welcher Faktor hinter einer dB-Zahl steckt.',
      more: [
        ['Formeln', 'Leistungsverhältnis: a = 10 · lg(P₂ / P₁). Spannungsverhältnis an gleichen Widerständen: a = 20 · lg(U₂ / U₁). Leistungspegel: L = 10 · lg(P / 1 mW) in dBm. Spannungspegel: L_U = 20 · lg(U / 1 µV) in dBµV. An 50 Ω gilt gerundet: dBµV = dBm + 107. Im Pegelplan zählst du nur zusammen: Verstärkung dazu, Dämpfung ab.'],
        ['Merkzahlen', '3 dB sind die doppelte Leistung, 10 dB die zehnfache, 20 dB die hundertfache. Bei Spannungen sind 6 dB das Doppelte und 20 dB das Zehnfache. 0 dBm sind 1 mW, 30 dBm sind 1 W.'],
        ['Beispiel', 'Ein Steuersender liefert 10 dBm. Das Kabel dämpft 2 dB, der Verstärker bringt 30 dB. Am Ausgang stehen 10 − 2 + 30 = 38 dBm. Das sind 1 mW · 10^3,8 = 6,31 W.'],
        ['Typische Fehler', 'Faktor 10 und Faktor 20 verwechselt: 10 gilt für Leistungen, 20 für Spannungen. Pegel in dBm zusammengezählt: Zwei Sender mit je 10 dBm ergeben 13 dBm, nicht 20 dBm. dB und dBm vermischt: dB ist ein Verhältnis, dBm ist eine feste Leistung.']
      ] },
    { id: 'ltg', tab: 'ltg', cat: CATS[1], icon: '➰', title: 'Leitung und Anpassung',
      intro: 'Eine HF-Leitung ist mehr als ein Draht: Auf ihr läuft eine Welle. Passt der Abschluss nicht zum Wellenwiderstand, wird ein Teil der Welle reflektiert, und es bildet sich eine stehende Welle. Ändere unten den Abschlusswiderstand und beobachte Bäuche und Knoten.',
      more: [
        ['Formeln', "Wellenlänge: λ = c / f, im Kabel λ_K = VK · c / f. Wellenwiderstand: Z_W = √(L' / C'). Reflexionsfaktor: r = (R_A − Z_W) / (R_A + Z_W). Stehwellenverhältnis: s = (1 + |r|) / (1 − |r|). Reflektierte Leistung: r² der hinlaufenden Leistung. Rückflussdämpfung: a_r = −20 · lg(|r|). Kabeldämpfung: Dämpfung je 100 m mal Länge durch 100 m."],
        ['Anpassung', 'Bei R_A = Z_W ist r = 0 und s = 1: Die ganze Leistung geht in die Last. Bei Kurzschluss oder offenem Ende ist |r| = 1: Alles läuft zurück. Eine verlustlose λ/4-Leitung verwandelt einen Kurzschluss am Ende in einen Leerlauf am Anfang. In Datenblättern und Fachbüchern steht für den Reflexionsfaktor oft der griechische Buchstabe Γ (Gamma) oder ρ (Rho) statt r.'],
        ['Beispiel', 'Eine Antenne mit 75 Ω hängt an einem 50-Ω-Kabel. r = (75 − 50) / (75 + 50) = 0,2. s = 1,2 / 0,8 = 1,5. Reflektiert werden 0,2² = 4 % der Leistung. Die Rückflussdämpfung ist −20 · lg(0,2) = 13,98 dB.'],
        ['Typische Fehler', 'Verkürzungsfaktor vergessen: Im Kabel ist die Welle kürzer als in Luft. Reflexionsfaktor als Leistungsanteil gelesen: r gilt für Spannungen, für die Leistung zählt r². Kabeldämpfung in dB mit der Leistung malgenommen: Erst die dB in einen Faktor umrechnen.']
      ] },
    { id: 'ant', tab: 'ant', cat: CATS[2], icon: '📡', title: 'Antenne und Funkstrecke',
      intro: 'Ob eine Funkverbindung klappt, entscheidet eine einfache Bilanz: Sendeleistung plus Gewinne minus Verluste muss am Empfänger noch über der Empfindlichkeit liegen. Baue unten deine Strecke zusammen und sieh im Pegelplan, wo die dB bleiben.',
      more: [
        ['Formeln', 'Halbwellendipol: l = k · λ / 2. Antennengewinn: dBi = dBd + 2,15. EIRP = P_S − a_Kabel + G_S. Freiraumdämpfung: a = 32,44 + 20 · lg(d in km) + 20 · lg(f in MHz). Empfangspegel: P_E = EIRP − a + G_E − a_Kabel. Reserve = P_E − Empfindlichkeit.'],
        ['Merkzahlen', 'Doppelte Entfernung kostet 6 dB, zehnfache Entfernung 20 dB. Doppelte Frequenz kostet bei gleichen Antennengewinnen ebenfalls 6 dB. Eine Reserve von 10 bis 20 dB fängt Schwund, Regen und Hindernisse ab.'],
        ['Beispiel', 'Strecke mit 868 MHz über 2 km: a = 32,44 + 6,02 + 58,77 = 97,23 dB. Mit 14 dBm Sendeleistung und zwei Antennen mit je 2 dBi kommen 14 + 2 + 2 − 97,23 = −79,23 dBm an. Braucht der Empfänger −105 dBm, bleibt eine Reserve von 25,77 dB.'],
        ['Typische Fehler', 'Entfernung in m statt in km eingesetzt, Frequenz in Hz statt in MHz. dBd und dBi gemischt. Vergessen, dass die Formel nur für freie Sicht gilt: Gebäude und Gelände kosten zusätzlich.']
      ] },
    { id: 'mod', tab: 'mod', cat: CATS[3], icon: '〰️', title: 'Modulation',
      intro: 'Eine Nachricht reist auf einem Träger. Bei AM ändert sie die Amplitude, bei FM die Frequenz. Digitale Verfahren schalten zwischen festen Zuständen um: ASK tastet den Träger, FSK springt zwischen zwei Frequenzen. Wähle unten ein Verfahren und vergleiche Zeitverlauf und Spektrum.',
      more: [
        ['Formeln', 'AM: m = (U_max − U_min) / (U_max + U_min), Bandbreite B = 2 · f_m,max, Seitenbandleistung P_SB = P_T · m² / 2. FM: Modulationsindex η = Δf / f_m, Bandbreite nach Carson B = 2 · (Δf + f_m,max). Digital: k = log₂(M) Bit je Symbol, Bitrate = Symbolrate · k, B = Symbolrate · (1 + α). FSK: h = Frequenzabstand / Bitrate.'],
        ['Was das Spektrum zeigt', 'AM mit einem Ton hat drei Linien: den Träger und je eine Seitenlinie im Abstand der Tonfrequenz. FM hat viele Seitenlinien, je größer der Modulationsindex, desto mehr. Bei digitalen Verfahren bestimmt die Symbolrate die Breite.'],
        ['Beispiel', 'FM-Sprechfunk mit Δf = 2,5 kHz und Tönen bis 3 kHz: B = 2 · (2,5 + 3) = 11 kHz. Das passt in einen Kanal mit 12,5 kHz Raster. Eine Strecke mit 16-QAM überträgt 4 Bit je Symbol: Bei 250 kBd sind das 1000 kbit/s.'],
        ['Typische Fehler', 'Bei AM die Bandbreite gleich der Tonfrequenz gesetzt: Es sind zwei Seitenbänder. Bei FM nur den Hub gerechnet und die Tonfrequenz vergessen. Symbolrate und Bitrate verwechselt: Für die Bandbreite zählt die Symbolrate. Modulationsgrad über 100 %: Die Hüllkurve wird verzerrt.']
      ] },
    { id: 'rx', tab: 'rx', cat: CATS[4], icon: '📻', title: 'Empfänger und Rauschen',
      intro: 'Jeder Empfänger hört zuerst sein eigenes Rauschen. Wie leise ein Signal sein darf, bestimmen drei Größen: Bandbreite, Rauschmaß und der Abstand, den der Demodulator braucht. Stelle unten deinen Empfänger ein und sieh, ob das Signal aus dem Rauschen ragt.',
      more: [
        ['Formeln', 'Thermisches Rauschen: P_N = −174 dBm + 10 · lg(B in Hz). Die −174 dBm je Hz gelten bei 290 K (rund 17 °C) und sind gerundet, genau sind es −173,98 dBm je Hz. Rauschboden = P_N + Rauschmaß F. Das Rauschmaß F steht hier immer in dB. Die Rauschzahl ist dasselbe als Faktor, also ohne dB. Empfindlichkeit = Rauschboden + nötiger Signal-Rausch-Abstand. Dynamikbereich = größter Pegel − Rauschboden. Überlagerungsempfänger: f_ZF = |f_E − f_O|, Spiegelfrequenz f_E ± 2 · f_ZF (Plus, wenn der Oszillator oberhalb liegt).'],
        ['Der Überlagerungsempfänger', 'Ein Mischer setzt jede Empfangsfrequenz auf dieselbe Zwischenfrequenz um. Dort sitzt ein festes, schmales Filter. Am Mischer entstehen immer Summe und Differenz der beiden Frequenzen. Weil auch die Spiegelfrequenz auf die Zwischenfrequenz fällt, muss ein Vorfilter sie vorher sperren. Eine hohe Zwischenfrequenz schiebt die Spiegelfrequenz weit weg.'],
        ['Beispiel', 'Bandbreite 12,5 kHz: −174 + 10 · lg(12500) = −174 + 40,97 = −133,03 dBm. Mit dem Rauschmaß 6 dB liegt der Rauschboden bei −127,03 dBm. Braucht der Demodulator 10 dB Abstand, ist die Empfindlichkeit −117,03 dBm.'],
        ['Typische Fehler', 'Bandbreite in kHz statt in Hz in den Logarithmus gesetzt. Rauschmaß abgezogen statt dazugezählt: Ein schlechterer Empfänger hat einen höheren Rauschboden. Bei der Spiegelfrequenz nur einmal die Zwischenfrequenz gerechnet statt zweimal.']
      ] },
    { id: 'mes', tab: 'mes', cat: CATS[5], icon: '🔬', title: 'Messen in der HF-Technik',
      intro: 'HF-Messgeräte haben empfindliche 50-Ω-Eingänge und zeigen Pegel in dBm. Wer sicher messen will, rechnet vorher: Wie viel Leistung kommt an, welches Dämpfungsglied schützt den Eingang, was bedeutet die Anzeige? Unten siehst du die Durchlasskurve eines Filters und liest Bandbreite und Güte ab.',
      more: [
        ['Formeln', 'Wahrer Pegel = Anzeige + externes Dämpfungsglied. Rauschboden am Analysator: ΔL = 10 · lg(RBW₂ / RBW₁). Leistung an 50 Ω: P = U² / R. Scheitelwert: û = √(2 · P · R). Richtkoppler: |r| = √(P_R / P_V), s = (1 + |r|) / (1 − |r|). Harmonische: f_n = n · f. Güte: Q = f₀ / B mit B = f_o − f_u.'],
        ['Sicher messen', 'Prüfe vor jeder Messung den größten erlaubten Eingangspegel des Geräts. Ein Sender gehört nie direkt an den Analysator. Ein Dämpfungsglied oder ein Richtkoppler nimmt den Pegel weg. Auch das Dämpfungsglied muss die Dauerleistung des Senders aushalten.'],
        ['Spitzenleistung PEP', 'Der Scheitelwert û = √(2 · P · R) gilt für den unmodulierten Träger. Mit Modulation zählt die Hüllkurvenspitzenleistung (PEP): die Leistung im höchsten Punkt der Hüllkurve. Bei AM mit m = 1 verdoppelt sich dort die Spannung, also ist PEP = 4 · P_T. Bei SSB bestimmst du die PEP aus der Spitze der Hüllkurve, nicht aus dem Mittelwert.'],
        ['Beispiel', 'Der Analysator zeigt −12 dBm hinter einem 30-dB-Dämpfungsglied: Der Sender liefert −12 + 30 = 18 dBm. Ein Sender mit 10 W erzeugt an 50 Ω die Effektivspannung √(10 · 50) = 22,36 V und den Scheitelwert 31,62 V.'],
        ['Typische Fehler', 'Externes Dämpfungsglied bei der Anzeige vergessen. Schmalere RBW mit weniger Signal verwechselt: Ein Träger bleibt gleich hoch, nur das Rauschen sinkt. Effektivwert und Scheitelwert verwechselt. Bei der Güte die halbe Bandbreite eingesetzt.']
      ] }
  ];

  const meta = { lab: 'hf', name: 'Funk- und HF-Lab', stufe: 'ausbildung', version: 'v63.189', zielgruppe: 'Elektroniker für Geräte und Systeme, Informationselektroniker, Technikerschule', bloecke: BLOCKS.length };
  const TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  const api = { meta, tasks, CATS, blocks: BLOCKS };
  root.HF_DATA = api; root.HF_TASKS = TASKS;
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign(api, { TASKS });
})(typeof window !== 'undefined' ? window : globalThis);
