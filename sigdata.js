'use strict';
/* Tonfunk Lab "Signale und Systeme": Aufgaben und Lerntexte (Lab-Kennung 'sig', Präfix lm4.sig.).
   SIG_DATA.meta: Name, Kürzel, Stufe ('studium').  SIG_DATA.tasks: 63 Aufgaben (Stufe 1-3) in 6 Blöcken; jede hat make(R, C) mit seed-fähigem
   Zufallsgenerator R und SIG_CORE C und liefert { text, label, unit, value, tol, tips[3], steps[], meta }.
   Der Wert (value) und alle Zahlen im Rechenweg (steps) kommen aus dem Kern (SIG_CORE), nie von Hand. Der Test (quelle/sig/test_sigdata.js)
   rechnet jede Aufgabe aus meta ein zweites Mal auf anderem Weg nach (Integration, DFT-Definition, Bisektion, Simulation, ...).
   Tipps: Stufe 1 Denkanstoß, Stufe 2 Formel, Stufe 3 Formel mit eingesetzten Zahlen (ohne das Ergebnis).
   SIG_DATA.blocks: Lerntexte je Block (eigene Formulierung).  SIG_TASKS: Kurzliste [{id,cat,title,level}] für Karriere/Lernpfad. */
(function (root) {
  const C = root.SIG_CORE || (typeof require === 'function' ? require('./sigcore.js') : null);
  const pick = C.pick, ri = C.ri;
  const F = (v, s) => C.fmt(v, s || 4), Hz = f => C.fmtHz(f);
  const CATS = ['Kenngrößen', 'Spektrum und DFT', 'Abtastung', 'Filter', 'Faltung', 'Modulation'];
  const tasks = [];
  /* Ein Wert 0 wäre als Aufgabe unbrauchbar (jede Eingabe nahe 0 passt): dann mit den nächsten Zufallszahlen neu würfeln */
  const add = (cat, title, level, kind, make) => tasks.push({ id: 'sig' + (tasks.length + 1), cat, title, level, kind, make: (R, Cc) => { let q; for (let i = 0; i < 40; i++) { q = make(R, Cc); if (Math.abs(q.value) > 1e-9) return q; } return q; } });
  /* gemeinsamer Rahmen: Toleranz aus Einheit; Beschriftung */
  const out = (o, extra) => { const unit = o.unit || ''; return Object.assign({ unit, tol: C.tolFor(o.value, unit, o.tolo) }, o, extra || {}); };
  const seq = (R, n, lo, hi) => Array.from({ length: n }, () => ri(R, lo, hi));
  const lst = a => '[' + a.map(v => F(v)).join('; ') + ']';
  const Pn = v => (v < 0 ? '(' + F(v) + ')' : F(v));   /* negative Zahl in Klammern */
  const SQ2 = F(Math.SQRT2, 5), SQ3 = F(Math.sqrt(3), 5);

  /* ============================================================ 1  Kenngrößen */
  add('Kenngrößen', 'Effektivwert eines Sinus', 1, 'rms_sin', (R) => {
    const a = pick(R, [2, 5, 8, 10, 12, 15, 24, 50]), v = C.statWave('sin', a).rms;
    return out({ text: `Eine reine Sinusspannung ohne Gleichanteil hat den Scheitelwert û = ${F(a)} V. Wie groß ist ihr Effektivwert?`, label: 'Effektivwert', unit: 'V', value: v,
      tips: ['Der Effektivwert ist die Gleichspannung, die an einem Widerstand dieselbe Leistung umsetzt wie das Signal. Beim Sinus ist er immer ein fester Bruchteil des Scheitelwerts.',
        'U_eff = û / √2  (der Faktor ist etwa 0,707).', `U_eff = ${F(a)} V / √2.`],
      steps: ['U_eff = û / √2', `U_eff = ${F(a)} V / ${SQ2} = ${F(v)} V`], meta: { a } });
  });
  add('Kenngrößen', 'Effektivwert mit Gleichanteil', 2, 'rms_dc_sin', (R) => {
    const dc = pick(R, [1, 2, 3, 4, 5]), a = pick(R, [2, 4, 6, 8, 10]), v = C.rmsMulti(dc, [a]);
    return out({ text: `Eine Spannung besteht aus einem Gleichanteil U₀ = ${F(dc)} V und einem überlagerten Sinus mit û = ${F(a)} V. Wie groß ist der Effektivwert der Gesamtspannung?`, label: 'Effektivwert', unit: 'V', value: v,
      tips: ['Gleichanteil und Wechselanteil bringen jeweils eigene Leistung. Diese Leistungen (also die Quadrate) darf man addieren, die Spannungen selbst nicht.',
        'U_eff² = U₀² + (û/√2)²  und dann die Wurzel ziehen.', `U_eff = √( (${F(dc)} V)² + (${F(a)} V / √2)² ).`],
      steps: ['U_eff² = U₀² + û²/2', `U_eff² = ${F(dc * dc)} V² + ${F(a * a / 2)} V² = ${F(v * v)} V²`, `U_eff = √${F(v * v)} V² = ${F(v)} V`], meta: { dc, a } });
  });
  add('Kenngrößen', 'Mittelwert eines Rechteckimpulses', 1, 'mean_pulse', (R) => {
    const U = pick(R, [2, 4, 5, 8, 10, 12]), D = pick(R, [0.2, 0.25, 0.3, 0.4, 0.6, 0.75]), v = C.statPulse(U, D).mean;
    return out({ text: `Eine Rechteckspannung springt zwischen 0 V und ${F(U)} V. Sie ist in ${F(D * 100)} % der Periodendauer eingeschaltet (Tastgrad D = ${F(D)}). Wie groß ist der arithmetische Mittelwert?`, label: 'Mittelwert', unit: 'V', value: v,
      tips: ['Der Mittelwert ist die Fläche unter der Kurve geteilt durch die Periodendauer.', 'Ū = Û · D  (D = Einschaltdauer / Periodendauer).', `Ū = ${F(U)} V · ${F(D)}.`],
      steps: ['Ū = Û · D', `Ū = ${F(U)} V · ${F(D)} = ${F(v)} V`], meta: { U, D } });
  });
  add('Kenngrößen', 'Effektivwert eines Rechteckimpulses', 2, 'rms_pulse', (R) => {
    const U = pick(R, [2, 4, 5, 8, 10, 12]), D = pick(R, [0.2, 0.25, 0.3, 0.4, 0.6, 0.75]), v = C.statPulse(U, D).rms;
    return out({ text: `Eine Rechteckspannung springt zwischen 0 V und ${F(U)} V und ist während des Anteils D = ${F(D)} der Periodendauer eingeschaltet (Tastgrad). Wie groß ist der Effektivwert?`, label: 'Effektivwert', unit: 'V', value: v,
      tips: ['Quadriere das Signal: Es ist während der Einschaltzeit Û², sonst 0. Davon der Mittelwert, dann die Wurzel.', 'U_eff = √(Û² · D) = Û · √D.', `U_eff = ${F(U)} V · √${F(D)}.`],
      steps: ['U_eff² = Û² · D', `U_eff² = ${F(U * U)} V² · ${F(D)} = ${F(U * U * D)} V²`, `U_eff = ${F(v)} V`], meta: { U, D } });
  });
  add('Kenngrößen', 'Effektivwert einer Dreieckspannung', 1, 'rms_tri', (R) => {
    const a = pick(R, [3, 5, 6, 9, 12, 15]), v = C.statWave('tri', a).rms;
    return out({ text: `Eine symmetrische Dreieckspannung ohne Gleichanteil schwankt zwischen −${F(a)} V und +${F(a)} V. Wie groß ist der Effektivwert?`, label: 'Effektivwert', unit: 'V', value: v,
      tips: ['Beim Dreieck steigt die Spannung gleichmäßig an. Das Mittel der Quadrate einer Geraden führt auf einen Drittelfaktor.', 'U_eff = û / √3.', `U_eff = ${F(a)} V / √3.`],
      steps: ['U_eff = û / √3', `U_eff = ${F(a)} V / ${SQ3} = ${F(v)} V`], meta: { a } });
  });
  add('Kenngrößen', 'Crest-Faktor eines Rechteckimpulses', 2, 'crest_pulse', (R) => {
    const D = pick(R, [0.04, 0.1, 0.16, 0.25, 0.36, 0.5]), v = C.statPulse(1, D).crest;
    return out({ text: `Ein Impulssignal (0 V bis Û) hat den Tastgrad D = ${F(D)} (Einschaltdauer geteilt durch Periodendauer). Wie groß ist sein Crest-Faktor (Scheitelwert geteilt durch Effektivwert)?`, label: 'Crest-Faktor', unit: '', value: v,
      tips: ['Der Scheitelwert ist Û. Der Effektivwert eines solchen Impulses hängt nur vom Tastgrad ab (Mittelwert des Quadrats, dann Wurzel).', 'CF = Û / U_eff = Û / (Û · √D) = 1/√D.', `CF = 1/√${F(D)}.`],
      steps: ['CF = Û / U_eff = 1/√D', `CF = 1/√${F(D)} = ${F(v)}`], meta: { D }, tolo: { abs: 0.01 } });
  });
  add('Kenngrößen', 'Gleichrichtwert eines Sinus', 2, 'abs_sin', (R) => {
    const a = pick(R, [2, 5, 10, 12, 20, 24]), v = C.statWave('sin', a).abs;
    return out({ text: `Ein Sinus mit û = ${F(a)} V wird ideal vollweggleichgerichtet. Wie groß ist der Gleichrichtwert |ū| (Mittelwert des Betrags)?`, label: 'Gleichrichtwert', unit: 'V', value: v,
      tips: ['Der Betrag macht aus dem Sinus eine Folge positiver Halbwellen. Gefragt ist deren Mittelwert.', '|ū| = 2û/π  (etwa 0,637 · û).', `|ū| = 2 · ${F(a)} V / π.`],
      steps: ['|ū| = (2/π) · û', `|ū| = 2 · ${F(a)} V / ${F(Math.PI, 5)} = ${F(v)} V`], meta: { a } });
  });
  add('Kenngrößen', 'Scheitelwert aus Messung und Crest-Faktor', 2, 'peak_from_rms', (R) => {
    const w = pick(R, ['sin', 'tri', 'rect']), name = { sin: 'Sinusspannung', tri: 'Dreieckspannung', rect: 'symmetrische Rechteckspannung' }[w], U = pick(R, [2, 3, 5, 6, 10, 12]);
    const cf = C.statWave(w, 1).crest, v = U * cf;
    return out({ text: `Ein True-RMS-Multimeter zeigt für eine ${name} (ohne Gleichanteil) U_eff = ${F(U)} V. Wie groß ist der Scheitelwert û?`, label: 'Scheitelwert', unit: 'V', value: v,
      tips: ['Der Crest-Faktor verbindet Scheitel- und Effektivwert. Er hängt nur von der Kurvenform ab. Überlege, welchen Wert deine Kurvenform hat (Sinus √2, Dreieck √3, Rechteck 1).', 'û = CF · U_eff.', `û = ${F(cf, 5)} · ${F(U)} V.`],
      steps: ['û = CF · U_eff', `CF (${{ sin: 'Sinus = √2', tri: 'Dreieck = √3', rect: 'Rechteck = 1' }[w]}) = ${F(cf, 5)}`, `û = ${F(cf, 5)} · ${F(U)} V = ${F(v)} V`], meta: { w, U } });
  });
  add('Kenngrößen', 'Leistung bei Grundschwingung und Oberschwingung', 3, 'power_two_sines', (R) => {
    const a1 = pick(R, [4, 6, 8, 10]), a2 = pick(R, [1, 2, 3]), Rl = pick(R, [10, 22, 47, 100]), ue = C.rmsMulti(0, [a1, a2]), v = ue * ue / Rl;
    return out({ text: `An einem Widerstand R = ${F(Rl)} Ω liegt die Spannung u(t) = ${F(a1)} V · sin(2π · 50 Hz · t) + ${F(a2)} V · sin(2π · 150 Hz · t). Welche Wirkleistung wird im Widerstand umgesetzt?`, label: 'Wirkleistung', unit: 'W', value: v,
      tips: ['Verschiedene Frequenzen beeinflussen sich in der mittleren Leistung nicht: Die Leistungen der Anteile addieren sich einfach.', 'P = (û₁²/2 + û₂²/2) / R.', `P = (${F(a1)}²/2 + ${F(a2)}²/2) V² / ${F(Rl)} Ω.`],
      steps: ['U_eff² = û₁²/2 + û₂²/2 (Parseval, verschiedene Frequenzen)', `U_eff² = ${F(a1 * a1 / 2)} V² + ${F(a2 * a2 / 2)} V² = ${F(ue * ue)} V²`, `P = U_eff² / R = ${F(ue * ue)} V² / ${F(Rl)} Ω = ${F(v)} W`], meta: { a1, a2, R: Rl } });
  });

  /* ============================================================ 2  Spektrum und DFT */
  add('Spektrum und DFT', 'Frequenzauflösung der DFT', 1, 'df', (R) => {
    const fs = pick(R, [1000, 2000, 8000, 10000, 16000, 44100, 48000]), N = pick(R, [256, 512, 1024, 2048, 4096]), v = fs / N;
    return out({ text: `Ein Signal wird mit f_s = ${Hz(fs)} abgetastet. In die DFT gehen N = ${N} Abtastwerte ein. Wie groß ist der Abstand zweier benachbarter Spektrallinien (Frequenzauflösung Δf)?`, label: 'Frequenzauflösung', unit: 'Hz', value: v,
      tips: ['Die DFT teilt den Bereich von 0 bis zur Abtastfrequenz in N gleiche Frequenzfächer (Bins) auf.', 'Δf = f_s / N = 1 / T_Messung.', `Δf = ${F(fs)} Hz / ${N}.`],
      steps: ['Δf = f_s / N', `Δf = ${F(fs)} Hz / ${N} = ${F(v)} Hz`], meta: { fs, N } });
  });
  add('Spektrum und DFT', 'Wie viele Abtastwerte für die gewünschte Auflösung?', 1, 'n_for_df', (R) => {
    const fs = pick(R, [2000, 5000, 8000, 10000, 20000]), df = pick(R, [0.5, 1, 2, 5, 10]), v = fs / df;
    return out({ text: `Mit f_s = ${Hz(fs)} soll eine Frequenzauflösung von Δf = ${F(df)} Hz erreicht werden. Wie viele Abtastwerte N sind mindestens nötig (ohne Rücksicht auf Zweierpotenzen)?`, label: 'Anzahl Abtastwerte', unit: '', value: v,
      tips: ['Ein feineres Frequenzraster braucht eine längere Beobachtungszeit.', 'N = f_s / Δf (die Messdauer ist T = 1/Δf).', `N = ${F(fs)} Hz / ${F(df)} Hz.`],
      steps: ['Δf = f_s / N  →  N = f_s / Δf', `N = ${F(fs)} Hz / ${F(df)} Hz = ${F(v)}`, `Messdauer T = 1/Δf = ${C.fmtS(1 / df)}`], meta: { fs, df }, tolo: { abs: 0.5, rel: 0 } });
  });
  add('Spektrum und DFT', 'In welchem Bin liegt die Linie?', 1, 'bin_index', (R) => {
    const fs = pick(R, [1024, 2048, 4096, 8192]), N = pick(R, [256, 512, 1024]), df = fs / N, k = ri(R, 5, N / 4 - 1), f = k * df;
    const kFound = C.peaks(C.ampSpec(C.synth({ comps: [{ w: 'sin', a: 1, f }] }, fs, N), 'rect').a, fs, N, 0.5, 1)[0].k;   /* Index aus dem Spektrum des Kerns */
    return out({ text: `Abtastfrequenz f_s = ${Hz(fs)}, DFT-Länge N = ${N}. Ein Sinus mit f = ${Hz(f)} liegt genau auf einem Frequenzraster. Welchen Index k hat dieses Bin? (Bin 0 ist der Gleichanteil.)`, label: 'Bin-Index k', unit: '', value: kFound,
      tips: ['Bin k gehört zur Frequenz k · Δf. Du brauchst also erst die Auflösung Δf.', 'k = f / Δf = f · N / f_s.', `k = ${F(f)} Hz / (${F(fs)} Hz / ${N}).`],
      steps: [`Δf = f_s / N = ${F(fs)} Hz / ${N} = ${F(df)} Hz`, `k = f / Δf = ${F(f)} Hz / ${F(df)} Hz = ${F(f / df)}`], meta: { fs, N, f }, tolo: { abs: 0.01, rel: 0 } });
  });
  add('Spektrum und DFT', 'Amplitude aus dem DFT-Betrag', 2, 'amp_from_X', (R) => {
    const A = pick(R, [0.5, 1, 1.5, 2, 2.5, 3, 4]), N = pick(R, [128, 256, 512, 1024]), k = ri(R, 5, 40);
    const x = C.synth({ comps: [{ w: 'sin', a: A, f: k }] }, N, N), S = C.fftReal(x), X = Math.hypot(S.re[k], S.im[k]), v = C.ampSpec(x, 'rect').a[k];
    return out({ text: `Eine Sinusspannung liegt genau auf Bin k = ${k} einer DFT mit N = ${N} Punkten (Rechteckfenster, keine Skalierung). Die DFT liefert den Betrag |X[${k}]| = ${F(X, 6)} V. Welche Amplitude A hat die Sinusspannung?`, label: 'Amplitude A', unit: 'V', value: v,
      tips: ['Die DFT summiert N Werte auf. Ein Sinus der Amplitude A trägt zu seiner Linie N·A/2 bei, weil sich die Amplitude je zur Hälfte auf die positive und die negative Frequenz verteilt.', 'A = 2 · |X[k]| / N.', `A = 2 · ${F(X, 6)} / ${N}.`],
      steps: ['|X[k]| = N · A / 2  →  A = 2 · |X[k]| / N', `A = 2 · ${F(X, 6)} / ${N} = ${F(v)} V`], meta: { A, N, k, X } });
  });
  add('Spektrum und DFT', 'Oberschwingung eines Rechtecks', 2, 'harm_rect', (R) => {
    const a = pick(R, [1, 2, 3, 5, 10]), n = pick(R, [3, 5, 7]), v = C.harm('rect', a, n);
    return out({ text: `Eine symmetrische Rechteckspannung (±${F(a)} V, Tastgrad 50 %) wird in Sinusschwingungen zerlegt. Welche Amplitude hat die ${n}. Harmonische?`, label: `Amplitude der ${n}. Harmonischen`, unit: 'V', value: v,
      tips: ['Ein symmetrisches Rechteck enthält nur ungerade Harmonische, ihre Amplituden fallen mit 1/n.', 'Â_n = 4 · û / (n · π).', `Â_${n} = 4 · ${F(a)} V / (${n} · π).`],
      steps: ['Â_n = 4û / (n π)', `Â_${n} = 4 · ${F(a)} V / (${n} · ${F(Math.PI, 5)}) = ${F(v)} V`], meta: { a, n } });
  });
  add('Spektrum und DFT', 'Oberschwingung eines Dreiecks', 3, 'harm_tri', (R) => {
    const a = pick(R, [1, 2, 4, 5, 10]), n = pick(R, [3, 5]), v = C.harm('tri', a, n);
    return out({ text: `Eine symmetrische Dreieckspannung hat den Scheitelwert ${F(a)} V. Welche Amplitude hat ihre ${n}. Harmonische?`, label: `Amplitude der ${n}. Harmonischen`, unit: 'V', value: v,
      tips: ['Das Dreieck hat keine Sprünge, seine Oberschwingungen fallen deshalb schneller ab als beim Rechteck, nämlich mit 1/n².', 'Â_n = 8 · û / (n² · π²) für ungerades n.', `Â_${n} = 8 · ${F(a)} V / (${n}² · π²).`],
      steps: ['Â_n = 8û / (n² π²)  (n ungerade)', `Â_${n} = 8 · ${F(a)} V / (${n * n} · ${F(Math.PI * Math.PI, 5)}) = ${F(v)} V`], meta: { a, n } });
  });
  add('Spektrum und DFT', 'Leckverlust beim Rechteckfenster', 3, 'scallop_rect', (R) => {
    const N = pick(R, [64, 128, 256]), dl = pick(R, [0.25, 0.5]), v = C.scallopDB('rect', N, dl);
    return out({ text: `Eine Sinuslinie (weit weg von 0 Hz und f_s/2) liegt ${F(dl)} Bin neben dem DFT-Raster (Rechteckfenster, N = ${N}). Um wie viel dB zeigt die nächstgelegene Spektrallinie weniger an als die wahre Amplitude? (Gib den Verlust als positive Zahl an.)`, label: 'Verlust', unit: 'dB', value: v,
      tips: ['Liegt die Frequenz zwischen zwei Bins, verteilt sich die Energie auf mehrere Linien (Leckeffekt). Die Anzeige im Nachbarbin ist um den Dirichlet-Kern verkleinert.', 'Anzeige/Wahrheit = |sin(π·δ)| / (N · sin(π·δ/N)); Verlust in dB = −20·log₁₀(dieses Verhältnis).', `Verhältnis = |sin(π · ${F(dl)})| / (${N} · sin(π · ${F(dl)} / ${N})).`],
      steps: ['Verhältnis r = |sin(π δ)| / (N · sin(π δ / N))', `r = ${F(Math.sin(Math.PI * dl))} / (${N} · ${F(Math.sin(Math.PI * dl / N), 6)}) = ${F(C.dirichlet(N, dl), 5)}`, `Verlust = −20 · log₁₀(r) = ${F(v)} dB`], meta: { N, dl }, tolo: { rel: 0, abs: 0.03 } });
  });
  add('Spektrum und DFT', 'Hann-Fenster und Amplitudenkorrektur', 2, 'hann_amp', (R) => {
    const A = pick(R, [1, 2, 3, 5]), N = pick(R, [256, 512, 1024]), k = ri(R, 8, 50);
    const x = C.synth({ comps: [{ w: 'sin', a: A, f: k }] }, N, N), w = C.win('hann', N), re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[i] * w[i]; C.fft(re, im);
    const X = Math.hypot(re[k], im[k]), v = C.ampSpec(x, 'hann').a[k];
    return out({ text: `Eine Sinusspannung liegt genau auf Bin k = ${k} (N = ${N}). Vor der DFT wird ein Hann-Fenster angewendet. Der Betrag im Bin ist |X[${k}]| = ${F(X, 6)} V. Welche Amplitude A hat die Sinusspannung? (Der Mittelwert des Hann-Fensters ist 0,5.)`, label: 'Amplitude A', unit: 'V', value: v,
      tips: ['Das Fenster dämpft das Signal im Mittel auf die Hälfte. Diese Dämpfung musst du rückgängig machen.', 'A = 2 · |X[k]| / (N · cg) mit cg = Fenstermittelwert = 0,5.', `A = 2 · ${F(X, 6)} / (${N} · 0,5).`],
      steps: ['Ohne Fenster wäre |X| = N·A/2. Mit Hann-Fenster (cg = 0,5): |X| = N·A·cg/2', `A = 2 · |X| / (N · cg) = 2 · ${F(X, 6)} / (${N} · ${F(C.cgOf(w), 3)}) = ${F(v)} V`], meta: { A, N, k, X } });
  });
  add('Spektrum und DFT', 'DFT von Hand für N = 4', 2, 'dft4', (R) => {
    let x; do { x = seq(R, 4, -3, 5); } while (Math.hypot(x[0] - x[2], x[3] - x[1]) === 0);
    const D = C.dft(Float64Array.from(x)), v = Math.hypot(D.re[1], D.im[1]);
    return out({ text: `Die Folge x[n] = ${lst(x)} (n = 0…3) wird mit der DFT (N = 4) transformiert. Wie groß ist der Betrag |X[1]|?`, label: '|X[1]|', unit: '', value: v,
      tips: ['Setze die Definition X[k] = Σ x[n]·e^(−j·2π·k·n/N) für k = 1 und N = 4 an. Die Drehfaktoren sind 1, −j, −1, +j.', 'X[1] = x[0] − j·x[1] − x[2] + j·x[3] = (x[0] − x[2]) + j·(x[3] − x[1]).', `X[1] = (${F(x[0])} − ${F(x[2])}) + j·(${F(x[3])} − ${F(x[1])}); dann Betrag.`],
      steps: ['X[1] = x[0]·1 + x[1]·(−j) + x[2]·(−1) + x[3]·(+j)', `X[1] = ${F(D.re[1])} + j·${F(D.im[1])}`, `|X[1]| = √(${F(D.re[1])}² + ${F(D.im[1])}²) = ${F(v)}`], meta: { x }, tolo: { abs: 0.01 } });
  });
  add('Spektrum und DFT', 'Pegelabstand zweier Spektrallinien', 2, 'level_diff', (R) => {
    const A1 = pick(R, [1, 2, 5, 10]), r = pick(R, [2, 4, 5, 10, 20, 50, 100]), A2 = A1 / r, v = C.db20(A1 / A2);
    return out({ text: `Im Spektrum liegt eine Linie bei ${F(A1)} V und eine zweite bei ${F(A2)} V Amplitude. Um wie viel dB liegt die zweite Linie unter der ersten?`, label: 'Pegelabstand', unit: 'dB', value: v,
      tips: ['Amplituden (Spannungen) werden mit 20·log₁₀ in dB umgerechnet, Leistungen mit 10·log₁₀.', 'ΔL = 20 · log₁₀(A₁ / A₂).', `ΔL = 20 · log₁₀(${F(A1)} / ${F(A2)}).`],
      steps: ['ΔL = 20 · log₁₀(A₁/A₂)', `ΔL = 20 · log₁₀(${F(A1 / A2)}) = ${F(v)} dB`], meta: { A1, A2 }, tolo: { rel: 0, abs: 0.1 } });
  });

  /* ============================================================ 3  Abtastung */
  add('Abtastung', 'Nyquist-Frequenz', 1, 'nyq', (R) => {
    const fs = pick(R, [8, 10, 16, 22.05, 32, 44.1, 48, 96]), v = C.nyquist(fs);
    return out({ text: `Ein Wandler tastet mit f_s = ${F(fs)} kHz ab. Unterhalb welcher Frequenz müssen alle Signalanteile liegen, damit sie eindeutig erfasst werden (Nyquist-Frequenz)?`, label: 'Nyquist-Frequenz', unit: 'kHz', value: v,
      tips: ['Pro Periode des Signals braucht man mehr als zwei Abtastwerte.', 'f_Nyquist = f_s / 2.', `f_Nyquist = ${F(fs)} kHz / 2.`],
      steps: ['f_N = f_s / 2', `f_N = ${F(fs)} kHz / 2 = ${F(v)} kHz`], meta: { fs } });
  });
  add('Abtastung', 'Mindest-Abtastfrequenz', 1, 'fs_min', (R) => {
    const fmax = pick(R, [3.4, 4, 5, 10, 15, 20]), v = 2 * fmax;
    return out({ text: `Ein Signal enthält Anteile bis f_max = ${F(fmax)} kHz. Welche Abtastfrequenz muss nach dem Abtasttheorem mindestens überschritten werden (Grenzwert angeben)?`, label: 'Grenzwert f_s', unit: 'kHz', value: v,
      tips: ['Die Abtastfrequenz muss mehr als doppelt so hoch sein wie die höchste Signalfrequenz.', 'f_s > 2 · f_max.', `f_s > 2 · ${F(fmax)} kHz.`],
      steps: ['f_s > 2 · f_max', `f_s > 2 · ${F(fmax)} kHz = ${F(v)} kHz`], meta: { fmax } });
  });
  add('Abtastung', 'Abtastperiode', 1, 'ts', (R) => {
    const fs = pick(R, [8, 10, 16, 22.05, 32, 44.1, 48, 96]), v = 1e3 / fs;
    return out({ text: `Eine Audio-Schnittstelle tastet mit f_s = ${F(fs)} kHz ab. Wie viel Zeit liegt zwischen zwei Abtastwerten?`, label: 'Abtastperiode T_s', unit: 'µs', value: v,
      tips: ['Frequenz und Periodendauer sind Kehrwerte voneinander.', 'T_s = 1 / f_s.', `T_s = 1 / ${F(fs)} kHz, Ergebnis in µs (1 / kHz = 1000 µs).`],
      steps: ['T_s = 1 / f_s', `T_s = 1 / ${F(fs)} kHz = ${F(v)} µs`], meta: { fs } });
  });
  add('Abtastung', 'Alias-Frequenz bei Unterabtastung', 2, 'alias1', (R) => {
    const fs = pick(R, [8, 10, 12, 16, 20, 25, 40]), f = Math.round(fs * (0.55 + 0.4 * R()) * 10) / 10, v = C.alias(f, fs);
    return out({ text: `Ein Sinus mit f = ${F(f)} kHz wird mit f_s = ${F(fs)} kHz abgetastet (ohne Antialiasing-Filter). Bei welcher Frequenz erscheint er im Spektrum?`, label: 'Alias-Frequenz', unit: 'kHz', value: v,
      tips: ['Das Signal liegt oberhalb der Nyquist-Frequenz f_s/2. Es wird an f_s/2 „gespiegelt“.', 'f_Alias = f_s − f  (für f_s/2 < f < f_s).', `f_Alias = ${F(fs)} kHz − ${F(f)} kHz.`],
      steps: [`Nyquist-Frequenz: f_s/2 = ${F(fs / 2)} kHz < f = ${F(f)} kHz → Aliasing`, `f_Alias = |f − n · f_s| mit dem n, das die Differenz am kleinsten macht (n = ${Math.round(f / fs)})`, `f_Alias = ${F(v)} kHz`], meta: { fs, f } });
  });
  add('Abtastung', 'Alias-Frequenz oberhalb der Abtastfrequenz', 3, 'alias2', (R) => {
    let fs, f, v;
    do { fs = pick(R, [8, 10, 12, 16, 20, 25]); f = Math.round(fs * (1.1 + 1.4 * R()) * 10) / 10; v = C.alias(f, fs); } while (v < 0.06 * fs || Math.abs(v - fs / 2) < 0.02 * fs);
    const n = Math.round(f / fs);
    return out({ text: `Ein Sinus mit f = ${F(f)} kHz wird mit f_s = ${F(fs)} kHz abgetastet. Welche Frequenz sieht man im Spektrum (0 bis f_s/2)?`, label: 'Alias-Frequenz', unit: 'kHz', value: v,
      tips: ['Die Frequenz ist größer als f_s. Ziehe ein ganzzahliges Vielfaches von f_s ab, bis du im Bereich ±f_s/2 landest.', 'f_Alias = | f − n · f_s | mit n = Runden(f / f_s).', `n = Runden(${F(f)} / ${F(fs)}) = ${n}; f_Alias = |${F(f)} − ${n} · ${F(fs)}| kHz.`],
      steps: [`f / f_s = ${F(f / fs)} → n = ${n}`, `f_Alias = |${F(f)} kHz − ${n} · ${F(fs)} kHz| = ${F(v)} kHz`], meta: { fs, f } });
  });
  add('Abtastung', 'Wagenradeffekt', 2, 'wheel', (R) => {
    const fb = pick(R, [24, 25, 30, 50]), d = pick(R, [1, 2, 3]) * pick(R, [-1, 1]), fr = fb + d, v = C.aliasSigned(fr, fb);
    return out({ text: `Eine Kamera nimmt ${F(fb)} Bilder pro Sekunde auf. Ein Rad mit einer einzigen Markierung dreht sich mit ${F(fr)} Umdrehungen pro Sekunde (im Uhrzeigersinn). Mit welcher scheinbaren Drehfrequenz sieht man die Markierung im Film? (Negativ = scheinbar rückwärts.)`, label: 'Scheinbare Drehfrequenz', unit: 'Hz', value: v,
      tips: ['Die Bildrate ist die Abtastfrequenz. Das Rad dreht fast genau eine ganze Umdrehung zwischen zwei Bildern.', 'f_scheinbar = f − n · f_Bild mit dem n, das einen Wert zwischen −f_Bild/2 und +f_Bild/2 ergibt.', `f_scheinbar = ${F(fr)} Hz − 1 · ${F(fb)} Hz.`],
      steps: [`f / f_Bild = ${F(fr / fb)} → n = 1`, `f_scheinbar = ${F(fr)} Hz − ${F(fb)} Hz = ${F(v)} Hz`, v < 0 ? 'negativ: Das Rad scheint rückwärts zu laufen.' : 'positiv: Das Rad scheint (langsam) vorwärts zu laufen.'], meta: { fb, fr } });
  });
  add('Abtastung', 'Breite des Übergangsbereichs eines Antialiasing-Filters', 2, 'aa_transition', (R) => {
    const fs = pick(R, [40, 44.1, 48, 96]), fn = pick(R, [16, 18, 20].filter(q => fs - 2 * q >= 2)), v = fs - 2 * fn;
    return out({ text: `Das Nutzsignal reicht bis f_n = ${F(fn)} kHz und soll unverändert durch das Antialiasing-Filter gehen. Es wird mit f_s = ${F(fs)} kHz abgetastet. Anteile oberhalb von f_s − f_n würden in das Nutzband falten und müssen gesperrt sein. Wie breit darf der Übergang zwischen Durchlass- und Sperrbereich höchstens sein?`, label: 'Übergangsbreite', unit: 'kHz', value: v,
      tips: ['Das Filter muss ab f_n durchlassen (bis dahin) und bei f_s − f_n schon sperren. Dazwischen liegt der Übergangsbereich.', 'Δf_Übergang = (f_s − f_n) − f_n = f_s − 2·f_n.', `Δf = ${F(fs)} kHz − 2 · ${F(fn)} kHz.`],
      steps: ['Sperrbereich beginnt bei f_s − f_n, Durchlass endet bei f_n', `Δf = (f_s − f_n) − f_n = ${F(fs - fn)} kHz − ${F(fn)} kHz = ${F(v)} kHz`], meta: { fs, fn } });
  });
  add('Abtastung', 'Signal-Rausch-Abstand eines idealen Wandlers', 2, 'snr', (R) => {
    const b = pick(R, [8, 10, 12, 14, 16]), v = C.snrIdeal(b);
    return out({ text: `Ein idealer Analog-Digital-Wandler hat ${b} Bit Auflösung und wird mit einem Sinus voll ausgesteuert. Wie groß ist sein Signal-Rausch-Abstand durch die Quantisierung?`, label: 'SNR', unit: 'dB', value: v,
      tips: ['Jedes zusätzliche Bit halbiert die Quantisierungsstufe, das sind etwa 6 dB mehr Abstand.', 'SNR = 6,02 · N_Bit + 1,76 dB (Vollaussteuerung, Sinus).', `SNR = 6,02 · ${b} + 1,76 dB.`],
      steps: ['SNR = 6,02 · N + 1,76 dB', `SNR = 6,02 · ${b} dB + 1,76 dB = ${F(v)} dB`], meta: { b }, tolo: { rel: 0, abs: 0.35 } });
  });
  add('Abtastung', 'Quantisierungsstufe (LSB)', 1, 'lsb', (R) => {
    const U = pick(R, [1, 2.5, 3.3, 5, 10]), b = pick(R, [8, 10, 12, 16]), v = C.lsb(U, b) * 1000;
    return out({ text: `Ein ${b}-Bit-Wandler hat den Eingangsbereich 0 bis ${F(U)} V. Wie groß ist die Spannung eines niederwertigsten Bits (1 LSB)?`, label: 'LSB', unit: 'mV', value: v,
      tips: ['Der Bereich wird in 2^N gleiche Stufen geteilt.', 'U_LSB = U_Bereich / 2^N.', `U_LSB = ${F(U)} V / 2^${b} = ${F(U)} V / ${Math.pow(2, b)}.`],
      steps: ['U_LSB = U_Bereich / 2^N', `U_LSB = ${F(U)} V / ${Math.pow(2, b)} = ${F(v)} mV`], meta: { U, b } });
  });

  /* ============================================================ 4  Filter */
  const RS = [1, 2.2, 4.7, 10, 22, 47], CS = [10, 22, 47, 100, 220];
  add('Filter', 'Grenzfrequenz eines RC-Tiefpasses', 1, 'rc_fg', (R) => {
    const r = pick(R, RS), c = pick(R, CS), v = 1 / (2 * Math.PI * r * 1e3 * c * 1e-9);
    return out({ text: `Ein RC-Tiefpass besteht aus R = ${F(r)} kΩ und C = ${F(c)} nF. Wie groß ist die Grenzfrequenz (−3 dB)?`, label: 'Grenzfrequenz', unit: 'Hz', value: v,
      tips: ['Bei der Grenzfrequenz ist der Blindwiderstand des Kondensators genauso groß wie der Widerstand.', 'f_g = 1 / (2π · R · C).', `f_g = 1 / (2π · ${F(r)} kΩ · ${F(c)} nF).`],
      steps: ['f_g = 1 / (2π R C)', `R · C = ${F(r * 1e3)} Ω · ${F(c * 1e-9, 4)} F = ${F(r * 1e3 * c * 1e-9, 4)} s`, `f_g = 1 / (2π · ${F(r * 1e3 * c * 1e-9, 4)} s) = ${F(v)} Hz`], meta: { R: r * 1e3, C: c * 1e-9 } });
  });
  add('Filter', 'Dämpfung eines Tiefpasses 1. Ordnung', 2, 'lp1_db', (R) => {
    const fg = pick(R, [200, 500, 1000, 2000, 5000]), k = pick(R, [2, 3, 5, 10]), f = k * fg, v = C.magDB(C.mkFilter('lp', 1, { f0: fg }), f);
    return out({ text: `Ein Tiefpass 1. Ordnung hat die Grenzfrequenz f_g = ${Hz(fg)}. Welchen Betrag des Frequenzgangs (in dB, negativ für Dämpfung) hat er bei f = ${Hz(f)}?`, label: '|H| in dB', unit: 'dB', value: v,
      tips: ['Der Betrag des Tiefpasses 1. Ordnung ist 1/√(1 + (f/f_g)²).', '|H|_dB = −10 · log₁₀(1 + (f/f_g)²).', `|H|_dB = −10 · log₁₀(1 + ${F(k)}²).`],
      steps: ['|H| = 1 / √(1 + (f/f_g)²)', `f/f_g = ${F(k)} → |H| = 1/√${F(1 + k * k)} = ${F(1 / Math.sqrt(1 + k * k), 5)}`, `|H|_dB = 20·log₁₀|H| = ${F(v)} dB`], meta: { fg, f }, tolo: { rel: 0, abs: 0.1 } });
  });
  add('Filter', 'Phase eines Tiefpasses 1. Ordnung', 2, 'lp1_ph', (R) => {
    const fg = pick(R, [200, 500, 1000, 2000, 5000]), k = pick(R, [0.2, 0.5, 2, 4, 10]), f = k * fg, v = C.phase(C.mkFilter('lp', 1, { f0: fg }), f);
    return out({ text: `Ein Tiefpass 1. Ordnung mit f_g = ${Hz(fg)} wird mit f = ${Hz(f)} betrieben. Welche Phasenverschiebung hat der Ausgang gegenüber dem Eingang (in Grad, negativ = Nacheilung)?`, label: 'Phase φ', unit: '°', value: v,
      tips: ['Der Ausgang eilt dem Eingang nach. Bei der Grenzfrequenz sind es genau 45°.', 'φ = −arctan(f / f_g).', `φ = −arctan(${F(k)}).`],
      steps: ['φ = −arctan(f/f_g)', `f/f_g = ${F(k)}`, `φ = −arctan(${F(k)}) = ${F(v)}°`], meta: { fg, f } });
  });
  add('Filter', 'Hochpass 1. Ordnung unterhalb der Grenzfrequenz', 2, 'hp1_db', (R) => {
    const fg = pick(R, [200, 500, 1000, 2000, 5000]), k = pick(R, [0.1, 0.2, 0.3, 0.5]), f = k * fg, v = C.magDB(C.mkFilter('hp', 1, { f0: fg }), f);
    return out({ text: `Ein Hochpass 1. Ordnung hat die Grenzfrequenz f_g = ${Hz(fg)}. Welchen Betrag (in dB) hat er bei f = ${Hz(f)}?`, label: '|H| in dB', unit: 'dB', value: v,
      tips: ['Beim Hochpass ist der Betrag (f/f_g) / √(1 + (f/f_g)²).', '|H|_dB = 20·log₁₀( x / √(1 + x²) ) mit x = f/f_g.', `x = ${F(k)}: |H|_dB = 20·log₁₀( ${F(k)} / √(1 + ${F(k)}²) ).`],
      steps: ['|H| = x / √(1 + x²), x = f/f_g', `x = ${F(k)} → |H| = ${F(k)} / ${F(Math.sqrt(1 + k * k), 5)} = ${F(k / Math.sqrt(1 + k * k), 5)}`, `|H|_dB = ${F(v)} dB`], meta: { fg, f }, tolo: { rel: 0, abs: 0.1 } });
  });
  add('Filter', 'Frequenz für eine vorgegebene Dämpfung', 3, 'lp1_freq_att', (R) => {
    const fg = pick(R, [500, 1000, 2000, 4000]), att = pick(R, [6, 10, 20, 26]), v = C.lp1FreqForAtt(fg, att);
    return out({ text: `Ein Tiefpass 1. Ordnung hat f_g = ${Hz(fg)}. Bei welcher Frequenz beträgt die Dämpfung ${F(att)} dB (der Betrag ist dann −${F(att)} dB)?`, label: 'Frequenz', unit: 'Hz', value: v,
      tips: ['Stelle die Betragsformel nach f um. Schreibe zuerst die Dämpfung als Zahlenfaktor: 10^(Dämpfung/20).', '(f/f_g)² = 10^(a/10) − 1, also f = f_g · √(10^(a/10) − 1).', `f = ${F(fg)} Hz · √(10^(${F(att)}/10) − 1).`],
      steps: [`10^(a/10) = 10^(${F(att)}/10) = ${F(Math.pow(10, att / 10), 5)}`, `f = f_g · √(${F(Math.pow(10, att / 10), 5)} − 1) = ${F(fg)} Hz · ${F(Math.sqrt(Math.pow(10, att / 10) - 1), 5)}`, `f = ${F(v)} Hz`], meta: { fg, att } });
  });
  add('Filter', 'Butterworth-Tiefpass 2. Ordnung', 2, 'bw2_db', (R) => {
    const fg = pick(R, [500, 1000, 2000, 5000]), k = pick(R, [2, 3, 5, 10]), f = k * fg, v = C.magDB(C.mkFilter('lp', 2, { f0: fg }), f);
    return out({ text: `Ein Butterworth-Tiefpass 2. Ordnung hat f_g = ${Hz(fg)}. Welchen Betrag (in dB) hat er bei f = ${Hz(f)}?`, label: '|H| in dB', unit: 'dB', value: v,
      tips: ['Beim Butterworth-Filter n-ter Ordnung ist |H|² = 1/(1 + (f/f_g)^(2n)).', '|H|_dB = −10 · log₁₀(1 + (f/f_g)⁴) für n = 2.', `|H|_dB = −10 · log₁₀(1 + ${F(k)}⁴).`],
      steps: ['|H|² = 1 / (1 + x⁴), x = f/f_g', `x = ${F(k)} → x⁴ = ${F(Math.pow(k, 4))}`, `|H|_dB = −10 · log₁₀(${F(1 + Math.pow(k, 4))}) = ${F(v)} dB`], meta: { fg, f }, tolo: { rel: 0, abs: 0.1 } });
  });
  add('Filter', 'Sprungantwort eines RC-Gliedes', 2, 'rc_step', (R) => {
    const c = pick(R, [10, 47, 100]), k = pick(R, [0.5, 1, 2, 3]), U0 = pick(R, [5, 10, 12]), tau = 10e3 * c * 1e-9, t = k * tau;
    const v = U0 * C.respond(C.mkFilter('lp', 1, { f0: 1 / (2 * Math.PI * tau) }), 2, t)[1];
    return out({ text: `Ein RC-Tiefpass (R = 10 kΩ, C = ${F(c)} nF) liegt zum Zeitpunkt t = 0 an einem Spannungssprung von 0 V auf ${F(U0)} V. Der Kondensator ist anfangs entladen. Welche Spannung hat der Kondensator nach t = ${C.fmtS(t)}?`, label: 'Kondensatorspannung', unit: 'V', value: v,
      tips: ['Der Kondensator lädt sich nach einer e-Funktion auf. Die Zeitkonstante ist τ = R·C.', 'u_C(t) = U₀ · (1 − e^(−t/τ)).', `τ = ${C.fmtS(tau)}; u_C = ${F(U0)} V · (1 − e^(−${F(k)})).`],
      steps: [`τ = R·C = 10 kΩ · ${F(c)} nF = ${C.fmtS(tau)}`, `t/τ = ${F(k)}`, `u_C = U₀·(1 − e^(−t/τ)) = ${F(U0)} V · (1 − ${F(Math.exp(-k), 5)}) = ${F(v)} V`], meta: { U0, tau, t } });
  });
  add('Filter', 'Anstiegszeit eines Tiefpasses', 2, 'lp1_rise', (R) => {
    const fg = pick(R, [1, 2, 5, 10, 20, 100]), v = C.riseLP1(fg * 1e3) * 1e6;
    return out({ text: `Ein Tiefpass 1. Ordnung hat die Grenzfrequenz f_g = ${F(fg)} kHz. Wie lang ist die Anstiegszeit seiner Sprungantwort von 10 % auf 90 % des Endwerts?`, label: 'Anstiegszeit', unit: 'µs', value: v,
      tips: ['Die Anstiegszeit hängt nur von der Zeitkonstante τ = 1/(2π·f_g) ab: Der Weg von 10 % bis 90 % dauert 2,2 τ.', 't_r = ln(9) · τ = ln(9) / (2π · f_g) ≈ 0,35 / f_g.', `t_r = ln(9) / (2π · ${F(fg)} kHz).`],
      steps: ['u(t) = 1 − e^(−t/τ): t₁₀ = −τ·ln(0,9), t₉₀ = −τ·ln(0,1)', 't_r = t₉₀ − t₁₀ = τ · ln 9 = 2,197 τ', `τ = 1/(2π · ${F(fg)} kHz) = ${F(1e3 / (2 * Math.PI * fg))} µs`, `t_r = ${F(v)} µs`], meta: { fg: fg * 1e3 } });
  });
  add('Filter', 'Güte eines Bandpasses', 2, 'bp_q', (R) => {
    const f0 = pick(R, [455, 1000, 4500, 10700]), B = pick(R, [20, 50, 100, 200]), v = f0 / B;
    return out({ text: `Ein Schwingkreis-Bandpass hat die Mittenfrequenz f₀ = ${Hz(f0)} und die −3-dB-Bandbreite B = ${Hz(B)}. Wie groß ist seine Güte Q?`, label: 'Güte Q', unit: '', value: v,
      tips: ['Die Güte sagt, wie schmal das Durchlassband im Vergleich zur Mittenfrequenz ist.', 'Q = f₀ / B.', `Q = ${F(f0)} Hz / ${F(B)} Hz.`],
      steps: ['Q = f₀ / B', `Q = ${F(f0)} Hz / ${F(B)} Hz = ${F(v)}`], meta: { f0, B }, tolo: { abs: 0.01 } });
  });
  add('Filter', 'Obere Bandgrenze eines Bandpasses', 3, 'bp_fo', (R) => {
    const f0 = pick(R, [1000, 2000, 5000, 10000]), Q = pick(R, [1, 2, 4, 5, 10]), v = C.cutoffs(C.mkFilter('bp', 2, { f0, Q }))[1];
    return out({ text: `Ein Bandpass 2. Ordnung hat f₀ = ${Hz(f0)} und die Güte Q = ${F(Q)}. Bei welcher Frequenz liegt die obere −3-dB-Grenze?`, label: 'obere Grenzfrequenz', unit: 'Hz', value: v,
      tips: ['Die beiden Grenzfrequenzen liegen nicht symmetrisch um f₀, sondern so, dass ihr Produkt f₀² ergibt (geometrisches Mittel). Ihr Abstand ist die Bandbreite f₀/Q.', 'f_o = f₀ · ( √(1 + 1/(4Q²)) + 1/(2Q) ).', `f_o = ${F(f0)} Hz · ( √(1 + 1/(4 · ${F(Q)}²)) + 1/(2 · ${F(Q)}) ).`],
      steps: [`1/(2Q) = ${F(1 / (2 * Q), 5)}`, `√(1 + 1/(4Q²)) = ${F(Math.sqrt(1 + 1 / (4 * Q * Q)), 5)}`, `f_o = ${F(f0)} Hz · (${F(Math.sqrt(1 + 1 / (4 * Q * Q)), 5)} + ${F(1 / (2 * Q), 5)}) = ${F(v)} Hz`], meta: { f0, Q }, tolo: { rel: 0.001 } });
  });
  add('Filter', 'Überschwingen bei Güte Q', 3, 'overshoot', (R) => {
    const Q = pick(R, [1, 1.5, 2, 3, 5]), z = 1 / (2 * Q), v = C.overshoot(Q) * 100;
    return out({ text: `Ein Tiefpass 2. Ordnung hat die Güte Q = ${F(Q)}. Um wie viel Prozent des Endwerts schwingt seine Sprungantwort über?`, label: 'Überschwingen', unit: '%', value: v,
      tips: ['Die Dämpfung ist ζ = 1/(2Q). Je kleiner ζ, desto stärker das Überschwingen (unter ζ = 1 schwingt das System).', 'ü = exp( −π·ζ / √(1 − ζ²) ) · 100 %.', `ζ = 1/(2 · ${F(Q)}); ü = exp(−π · ζ / √(1 − ζ²)).`],
      steps: [`ζ = 1/(2Q) = ${F(z, 5)}`, `ü = exp(−π · ${F(z, 5)} / √(1 − ${F(z * z, 5)})) = ${F(v / 100, 5)}`, `ü = ${F(v)} %`], meta: { Q } });
  });

  /* ============================================================ 5  Faltung */
  const nz = (R, mk, f) => { let a, v, i = 0; do { a = mk(); v = f(a); i++; } while (Math.abs(v) < 1e-9 && i < 30); return [a, v]; };
  add('Faltung', 'Faltung ausrechnen', 1, 'conv_one', (R) => {
    const [d, v] = nz(R, () => { const x = seq(R, 3, 1, 4), h = seq(R, pick(R, [2, 3]), -2, 3), n = ri(R, 1, x.length + h.length - 3); return { x, h, n }; }, p => C.conv(p.x, p.h)[p.n]);
    const T = C.convTerms(d.x, d.h, d.n);
    return out({ text: `Gegeben sind x[n] = ${lst(d.x)} und h[n] = ${lst(d.h)} (jeweils ab n = 0, sonst 0). Berechne y[${d.n}] der Faltung y = x ∗ h.`, label: `y[${d.n}]`, unit: '', value: v,
      tips: ['Beim Falten wird h gespiegelt und über x geschoben. Für y[n] multiplizierst du alle sich überdeckenden Werte und addierst.', 'y[n] = Σ x[k] · h[n − k], nur Terme mit gültigen Indizes.', `Für n = ${d.n}: ${T.map(q => `x[${q.k}]·h[${q.j}]`).join(' + ')}.`],
      steps: [`y[${d.n}] = ` + T.map(q => `x[${q.k}]·h[${q.j}]`).join(' + '), '= ' + T.map(q => `${Pn(q.x)}·${Pn(q.h)}`).join(' + '), `= ${F(v)}`], meta: d, tolo: { abs: 0.01, rel: 0 } });
  });
  add('Faltung', 'Länge des Faltungsergebnisses', 1, 'conv_len', (R) => {
    const M = ri(R, 3, 12), K = ri(R, 3, 12), v = C.conv(new Array(M).fill(1), new Array(K).fill(1)).length;
    return out({ text: `Ein Signal mit ${M} Werten wird mit einer Impulsantwort aus ${K} Werten gefaltet. Wie viele Werte hat das Ergebnis (alle Positionen, die ungleich 0 sein können)?`, label: 'Länge', unit: '', value: v,
      tips: ['Das Ergebnis beginnt, sobald sich die beiden Folgen zum ersten Mal berühren, und endet, wenn sie sich zuletzt berühren.', 'Länge = M + K − 1.', `Länge = ${M} + ${K} − 1.`],
      steps: ['Länge = M + K − 1', `Länge = ${M} + ${K} − 1 = ${v}`], meta: { M, K }, tolo: { abs: 0.01, rel: 0 } });
  });
  add('Faltung', 'Gleitender Mittelwert', 1, 'conv_mavg', (R) => {
    const x = seq(R, 6, 0, 9), n = ri(R, 2, 5), h = [1 / 3, 1 / 3, 1 / 3], v = C.conv(x, h)[n];
    return out({ text: `Ein gleitender Mittelwert über 3 Werte hat die Impulsantwort h = [1/3; 1/3; 1/3]. Am Eingang liegt x = ${lst(x)}. Wie groß ist y[${n}]?`, label: `y[${n}]`, unit: '', value: v,
      tips: ['Ein gleitender Mittelwert bildet den Durchschnitt aus dem aktuellen und den zwei vorherigen Eingangswerten.', `y[n] = ( x[n] + x[n−1] + x[n−2] ) / 3.`, `y[${n}] = ( x[${n}] + x[${n - 1}] + x[${n - 2}] ) / 3 = ( ${F(x[n])} + ${F(x[n - 1])} + ${F(x[n - 2])} ) / 3.`],
      steps: [`y[${n}] = (x[${n}] + x[${n - 1}] + x[${n - 2}]) / 3`, `= (${F(x[n])} + ${F(x[n - 1])} + ${F(x[n - 2])}) / 3 = ${F(v)}`], meta: { x, n }, tolo: { abs: 0.01 } });
  });
  add('Faltung', 'Differenzbildner', 1, 'conv_diff', (R) => {
    const x = seq(R, 6, 0, 9), n = ri(R, 1, 5), v = C.conv(x, [1, -1])[n];
    return out({ text: `Ein Differenzbildner (zeitdiskreter Differenzierer) hat die Impulsantwort h = [1; −1]. Am Eingang liegt x = ${lst(x)}. Wie groß ist y[${n}]?`, label: `y[${n}]`, unit: '', value: v,
      tips: ['Mit h[0] = 1 und h[1] = −1 wird vom aktuellen Wert der vorherige abgezogen.', 'y[n] = x[n] − x[n−1].', `y[${n}] = x[${n}] − x[${n - 1}] = ${F(x[n])} − ${F(x[n - 1])}.`],
      steps: [`y[${n}] = x[${n}]·h[0] + x[${n - 1}]·h[1]`, `= ${F(x[n])}·1 + ${F(x[n - 1])}·(−1) = ${F(v)}`], meta: { x, n }, tolo: { abs: 0.01, rel: 0 } });
  });
  add('Faltung', 'Echo', 2, 'conv_echo', (R) => {
    const d = pick(R, [2, 3]), a = pick(R, [0.3, 0.5, 0.6, 0.8]), x = seq(R, 3, 1, 5), h = new Array(d + 1).fill(0); h[0] = 1; h[d] = a;
    const n = d + ri(R, 0, 2), v = C.conv(x, h)[n], T = C.convTerms(x, h, n).filter(q => q.h !== 0);
    return out({ text: `Ein Echo-System gibt das Eingangssignal direkt weiter und zusätzlich um ${d} Takte verzögert mit dem Faktor ${F(a)} (h = ${lst(h)}). Am Eingang liegt x = ${lst(x)} (danach 0). Wie groß ist y[${n}]?`, label: `y[${n}]`, unit: '', value: v,
      tips: ['Das Ausgangssignal ist die Summe aus dem direkten Anteil und dem verzögerten, abgeschwächten Anteil. Prüfe, welche Eingangswerte zu n gehören (Indizes ≥ 0 und < 3).', `y[n] = x[n]·1 + a·x[n − ${d}] (jeweils nur, wenn der Index existiert).`, `y[${n}] = ${T.map(q => `x[${q.k}]·${F(q.h)}`).join(' + ')}.`],
      steps: [`y[${n}] = ` + T.map(q => `x[${q.k}]·h[${q.j}]`).join(' + '), '= ' + T.map(q => `${Pn(q.x)}·${Pn(q.h)}`).join(' + ') + ` = ${F(v)}`], meta: { x, h, n }, tolo: { abs: 0.01 } });
  });
  add('Faltung', 'Summe der Ausgangswerte', 2, 'conv_sum', (R) => {
    const x = seq(R, 4, 1, 5), h = seq(R, 3, -1, 4), y = C.conv(x, h), v = y.reduce((p, q) => p + q, 0);
    return out({ text: `Es wird x = ${lst(x)} mit h = ${lst(h)} gefaltet. Wie groß ist die Summe aller Werte von y = x ∗ h? (Tipp: Du musst nicht alle Werte einzeln berechnen.)`, label: 'Σ y[n]', unit: '', value: v,
      tips: ['Die Summe aller Ausgangswerte ist der Wert des Ausgangs bei Frequenz 0 (Gleichanteil).', 'Σ y[n] = (Σ x[k]) · (Σ h[j]).', `Σ y = (${x.map(F).join(' + ')}) · (${h.map(F).join(' + ')}).`],
      steps: [`Σ x = ${F(x.reduce((p, q) => p + q, 0))}, Σ h = ${F(h.reduce((p, q) => p + q, 0))}`, `Σ y = Σ x · Σ h = ${F(v)}`, `Kontrolle durch vollständige Faltung: y = ${lst(y)}`], meta: { x, h }, tolo: { abs: 0.01, rel: 0 } });
  });
  add('Faltung', 'Faltung zweier Rechtecke', 2, 'conv_rect', (R) => {
    const L1 = ri(R, 3, 6), L2 = ri(R, 2, 5), a1 = pick(R, [1, 2]), a2 = pick(R, [1, 2, 3]), y = C.conv(new Array(L1).fill(a1), new Array(L2).fill(a2)), v = Math.max(...y);
    return out({ text: `Ein Rechteck aus ${L1} Werten der Höhe ${F(a1)} wird mit einem Rechteck aus ${L2} Werten der Höhe ${F(a2)} gefaltet. Wie groß ist der größte Wert im Ergebnis?`, label: 'Maximum', unit: '', value: v,
      tips: ['Beim Schieben wächst die Überdeckung zuerst, bleibt dann konstant (bei unterschiedlicher Länge) und nimmt wieder ab. Das Maximum ist die volle Überdeckung des kürzeren Rechtecks.', 'y_max = min(L₁, L₂) · a₁ · a₂.', `y_max = min(${L1}; ${L2}) · ${F(a1)} · ${F(a2)}.`],
      steps: [`volle Überdeckung: min(${L1}; ${L2}) = ${Math.min(L1, L2)} Werte`, `y_max = ${Math.min(L1, L2)} · ${F(a1)} · ${F(a2)} = ${F(v)}`], meta: { L1, L2, a1, a2 }, tolo: { abs: 0.01, rel: 0 } });
  });
  add('Faltung', 'Sprungantwort aus der Impulsantwort', 3, 'conv_step', (R) => {
    const h = seq(R, 4, 1, 6).map(v => v / 10), n = ri(R, 1, 4), u = new Array(h.length + 3).fill(1), v = C.conv(h, u)[n];
    return out({ text: `Ein System hat die Impulsantwort h = ${lst(h)} (ab n = 0). Der Eingang ist ein Sprung (u[n] = 1 für n ≥ 0). Wie groß ist die Sprungantwort s[${n}]?`, label: `s[${n}]`, unit: '', value: v,
      tips: ['Der Sprung ist eine Folge von Einsen. Falten mit lauter Einsen bedeutet, die Werte von h aufzusummieren.', 's[n] = Σ h[j] für j = 0 … n (nur vorhandene Werte).', `s[${n}] = ${h.slice(0, n + 1).map(F).join(' + ')}.`],
      steps: [`s[${n}] = Σ_{j=0..${n}} h[j]`, `= ${h.slice(0, n + 1).map(F).join(' + ')} = ${F(v)}`], meta: { h, n }, tolo: { abs: 0.005 } });
  });
  add('Faltung', 'Reihenschaltung zweier Systeme', 3, 'conv_series', (R) => {
    const p = pick(R, [1, 2]), a = pick(R, [-3, -2, -1, 1, 2, 3]), b = pick(R, [-3, -2, -1, 1, 2, 3]), h1 = [p, a], h2 = [1, b], h = C.conv(h1, h2), i = pick(R, [1, 2]), v = h[i];
    return out({ text: `Zwei Systeme mit den Impulsantworten h₁ = ${lst(h1)} und h₂ = ${lst(h2)} werden hintereinandergeschaltet. Wie groß ist der Wert h[${i}] der Gesamt-Impulsantwort?`, label: `h[${i}]`, unit: '', value: v,
      tips: ['Die Gesamt-Impulsantwort einer Reihenschaltung ist die Faltung der beiden Einzel-Impulsantworten.', 'h = h₁ ∗ h₂ (Länge 2 + 2 − 1 = 3).', `h[${i}] = ${C.convTerms(h1, h2, i).map(q => `h₁[${q.k}]·h₂[${q.j}]`).join(' + ')}.`],
      steps: ['h = h₁ ∗ h₂', `h[${i}] = ${C.convTerms(h1, h2, i).map(q => `${Pn(q.x)}·${Pn(q.h)}`).join(' + ')} = ${F(v)}`, `ganz: h = ${lst(h)}`], meta: { h1, h2, i }, tolo: { abs: 0.01, rel: 0 } });
  });

  /* ============================================================ 6  Modulation */
  add('Modulation', 'Modulationsgrad bestimmen', 1, 'am_m', (R) => {
    const Ac = pick(R, [2, 4, 5, 8, 10]), m = pick(R, [0.3, 0.4, 0.5, 0.6, 0.8, 0.9]), Am = Ac * m, v = Am / Ac * 100;
    return out({ text: `Ein Träger hat die Amplitude Â_T = ${F(Ac)} V. Das modulierende Signal hat die Amplitude Â_m = ${F(Am)} V (Amplitudenmodulation). Wie groß ist der Modulationsgrad?`, label: 'Modulationsgrad m', unit: '%', value: v,
      tips: ['Der Modulationsgrad vergleicht, wie stark die Trägeramplitude schwankt, mit der Trägeramplitude selbst.', 'm = Â_m / Â_T (in % mit 100 multiplizieren).', `m = ${F(Am)} V / ${F(Ac)} V.`],
      steps: ['m = Â_m / Â_T', `m = ${F(Am)} V / ${F(Ac)} V = ${F(v / 100, 4)} = ${F(v)} %`], meta: { Ac, Am } });
  });
  add('Modulation', 'Seitenfrequenzen bei AM', 1, 'am_usb', (R) => {
    const fc = pick(R, [540, 720, 810, 1000, 1080, 1400]), fm = pick(R, [3, 4.5, 5, 8]), v = fc + fm;
    return out({ text: `Ein Träger mit f_T = ${F(fc)} kHz wird mit einem Sinuston von ${F(fm)} kHz in der Amplitude moduliert. Bei welcher Frequenz liegt die obere Seitenlinie (obere Seitenfrequenz)?`, label: 'obere Seitenlinie', unit: 'kHz', value: v,
      tips: ['Beim Modulieren entstehen neue Spektrallinien dicht neben dem Träger, genau um die Modulationsfrequenz verschoben.', 'f_OSB = f_T + f_m (und f_USB = f_T − f_m).', `f_OSB = ${F(fc)} kHz + ${F(fm)} kHz.`],
      steps: ['f_OSB = f_T + f_m', `f_OSB = ${F(fc)} kHz + ${F(fm)} kHz = ${F(v)} kHz`, `(untere Seitenlinie: ${F(fc - fm)} kHz)`], meta: { fc, fm }, tolo: { rel: 0.001 } });
  });
  add('Modulation', 'Bandbreite eines AM-Signals', 1, 'am_bw', (R) => {
    const fm = pick(R, [3, 4.5, 5, 8, 10]), v = 2 * fm;
    return out({ text: `Ein Sender moduliert seinen Träger mit einem Tonsignal bis f_m,max = ${F(fm)} kHz (AM, zweiseitig). Welche Bandbreite belegt er?`, label: 'Bandbreite', unit: 'kHz', value: v,
      tips: ['Es entstehen zwei Seitenbänder, das obere und das untere, beide ragen so weit wie die höchste Modulationsfrequenz.', 'B = 2 · f_m,max.', `B = 2 · ${F(fm)} kHz.`],
      steps: ['B = (f_T + f_m,max) − (f_T − f_m,max) = 2 f_m,max', `B = 2 · ${F(fm)} kHz = ${F(v)} kHz`], meta: { fm } });
  });
  add('Modulation', 'Amplitude einer Seitenlinie', 2, 'am_side', (R) => {
    const Ac = pick(R, [2, 4, 5, 10]), m = pick(R, [0.4, 0.5, 0.6, 0.8]), v = C.amLines({ Ac, m, fc: 1000, fm: 100 })[2].a;
    return out({ text: `Ein Träger mit Â_T = ${F(Ac)} V wird mit dem Modulationsgrad m = ${F(m)} amplitudenmoduliert. Welche Amplitude hat jede der beiden Seitenlinien im Spektrum?`, label: 'Seitenlinie', unit: 'V', value: v,
      tips: ['Die Schwankung der Hüllkurve (m · Â_T) steckt in den beiden Seitenlinien, jede trägt die Hälfte.', 'Â_Seite = m · Â_T / 2.', `Â_Seite = ${F(m)} · ${F(Ac)} V / 2.`],
      steps: ['s(t) = Â_T·cos(ω_T t) + (m Â_T/2)·cos((ω_T+ω_m)t) + (m Â_T/2)·cos((ω_T−ω_m)t)', `Â_Seite = ${F(m)} · ${F(Ac)} V / 2 = ${F(v)} V`], meta: { Ac, m } });
  });
  add('Modulation', 'Kleinste Hüllkurvenspannung', 2, 'am_umin', (R) => {
    const Ac = pick(R, [2, 4, 5, 8, 10]), m = pick(R, [0.3, 0.5, 0.6, 0.8]), v = Ac * (1 - m);
    return out({ text: `Ein Träger mit Â_T = ${F(Ac)} V wird mit m = ${F(m)} amplitudenmoduliert. Wie klein wird die Einhüllende (Hüllkurve) mindestens?`, label: 'Hüllkurve minimal', unit: 'V', value: v,
      tips: ['Die Hüllkurve schwankt um den Träger herum nach oben und nach unten.', 'Û_min = Â_T · (1 − m), Û_max = Â_T · (1 + m).', `Û_min = ${F(Ac)} V · (1 − ${F(m)}).`],
      steps: ['Hüllkurve e(t) = Â_T · (1 + m · cos(ω_m t))', `Û_max = ${F(Ac * (1 + m))} V, Û_min = ${F(Ac)} V · (1 − ${F(m)}) = ${F(v)} V`], meta: { Ac, m } });
  });
  add('Modulation', 'Modulationsgrad aus dem Oszilloskopbild', 2, 'am_m_env', (R) => {
    const Ac = pick(R, [2, 4, 5, 8, 10]), m = pick(R, [0.3, 0.4, 0.5, 0.6, 0.8]), Umax = Ac * (1 + m), Umin = Ac * (1 - m), v = (Umax - Umin) / (Umax + Umin) * 100;
    return out({ text: `Auf dem Oszilloskop liest man an einem AM-Signal die größte Hüllkurvenamplitude Û_max = ${F(Umax)} V und die kleinste Û_min = ${F(Umin)} V ab. Wie groß ist der Modulationsgrad?`, label: 'Modulationsgrad m', unit: '%', value: v,
      tips: ['Û_max = Â_T·(1 + m) und Û_min = Â_T·(1 − m). Subtrahiere und addiere beide Gleichungen.', 'm = (Û_max − Û_min) / (Û_max + Û_min).', `m = (${F(Umax)} − ${F(Umin)}) / (${F(Umax)} + ${F(Umin)}).`],
      steps: ['Û_max − Û_min = 2·m·Â_T, Û_max + Û_min = 2·Â_T', `m = (${F(Umax)} V − ${F(Umin)} V) / (${F(Umax)} V + ${F(Umin)} V) = ${F(v / 100, 4)} = ${F(v)} %`], meta: { Umax, Umin, Ac, m } });
  });
  add('Modulation', 'Seitenbandleistung bei AM', 3, 'am_eta', (R) => {
    const m = pick(R, [0.5, 0.6, 0.8, 1]), v = C.amEta(m) * 100;
    return out({ text: `Ein AM-Sender moduliert mit dem Modulationsgrad m = ${F(m)} (Sinuston). Welchen Anteil der gesamten Sendeleistung tragen die beiden Seitenbänder zusammen?`, label: 'Anteil Seitenbänder', unit: '%', value: v,
      tips: ['Die Gesamtleistung ist die Trägerleistung plus die Leistung beider Seitenlinien. Die Leistung ist proportional zum Amplitudenquadrat (Faktor 1/2 kürzt sich weg).', 'P_Seiten / P_ges = (m²/2) / (1 + m²/2) = m² / (2 + m²).', `Anteil = ${F(m)}² / (2 + ${F(m)}²).`],
      steps: ['P_T ∝ Â_T², P_Seiten ∝ 2 · (m Â_T/2)² = m² Â_T²/2', `Anteil = m² / (2 + m²) = ${F(m * m)} / ${F(2 + m * m)} = ${F(v / 100, 4)} = ${F(v)} %`, 'Die Nachricht steckt nur in den Seitenbändern: Selbst bei m = 1 sind es nur ein Drittel der Leistung.'], meta: { m } });
  });
  add('Modulation', 'Modulationsindex bei FM', 2, 'fm_beta', (R) => {
    const df = pick(R, [5, 10, 15, 25, 50, 75]), fm = pick(R, [1, 2.5, 5, 10, 15]), v = df / fm;
    return out({ text: `Ein Frequenzmodulator hat den Frequenzhub Δf = ${F(df)} kHz bei einer Modulationsfrequenz f_m = ${F(fm)} kHz. Wie groß ist der Modulationsindex β?`, label: 'Modulationsindex β', unit: '', value: v,
      tips: ['Der Hub sagt, wie weit die Trägerfrequenz nach oben und unten ausgelenkt wird. Der Index vergleicht ihn mit der Modulationsfrequenz.', 'β = Δf / f_m.', `β = ${F(df)} kHz / ${F(fm)} kHz.`],
      steps: ['β = Δf / f_m', `β = ${F(df)} kHz / ${F(fm)} kHz = ${F(v)}`], meta: { df, fm }, tolo: { abs: 0.01 } });
  });
  add('Modulation', 'Bandbreite nach Carson', 2, 'fm_carson', (R) => {
    const df = pick(R, [5, 10, 25, 50, 75]), fm = pick(R, [1, 3, 5, 15]), v = C.carson(df, fm);
    return out({ text: `Ein FM-Signal hat den Frequenzhub Δf = ${F(df)} kHz und eine höchste Modulationsfrequenz von f_m = ${F(fm)} kHz. Wie groß ist die benötigte Bandbreite nach der Carson-Regel?`, label: 'Bandbreite', unit: 'kHz', value: v,
      tips: ['FM hat theoretisch unendlich viele Seitenlinien, fast die gesamte Leistung liegt aber in einem begrenzten Bereich um den Träger.', 'B ≈ 2 · (Δf + f_m).', `B ≈ 2 · (${F(df)} kHz + ${F(fm)} kHz).`],
      steps: ['Carson-Regel: B ≈ 2·(Δf + f_m)', `B ≈ 2 · (${F(df)} kHz + ${F(fm)} kHz) = ${F(v)} kHz`], meta: { df, fm }, tolo: { rel: 0.003 } });
  });
  /* ---- digitale Modulation (v62.186): Bit je Symbol, Bitrate, Symbolrate, Bandbreite mit Roll-off, FSK-Index, spektrale Effizienz ---- */
  const DM = [[2, 'BPSK'], [4, 'QPSK'], [8, '8-PSK'], [16, '16-QAM'], [64, '64-QAM'], [256, '256-QAM']];
  const DMQ = [DM[1], DM[3], DM[4]], bitsOf = M => Math.round(Math.log2(M));
  add('Modulation', 'Bit je Symbol', 1, 'dm_bits', (R) => {
    const q = pick(R, DM), M = q[0], v = bitsOf(M);
    return out({ text: `Ein digitales Modulationsverfahren (${q[1]}) unterscheidet M = ${M} verschiedene Symbolzustände. Wie viele Bit überträgt ein einzelnes Symbol?`, label: 'Bit je Symbol', unit: 'bit', value: v,
      tips: ['Mit jedem zusätzlichen Bit verdoppelt sich die Zahl der möglichen Zustände: 1 Bit hat 2 Zustände, 2 Bit haben 4, 3 Bit haben 8.', 'k = log₂(M), das heißt: 2 hoch k ergibt M.', `k = log₂(${M}). Zähle, wie oft du die 2 mit sich selbst malnehmen musst, bis ${M} herauskommt.`],
      steps: ['k = log₂(M)', `k = log₂(${M}) = ${F(v)} bit (Probe: 2 hoch ${F(v)} = ${M})`], meta: { M }, tolo: { abs: 0.01, rel: 0 } });
  });
  add('Modulation', 'Bitrate aus Symbolrate', 1, 'dm_bitrate', (R) => {
    const q = pick(R, DMQ), M = q[0], k = bitsOf(M), Rs = pick(R, [10, 20, 25, 50, 100, 150]), v = Rs * k;
    return out({ text: `Ein Modem sendet mit ${q[1]} (M = ${M} Symbolzustände) und einer Symbolrate von ${F(Rs)} kBd (1 Bd = 1 Symbol je Sekunde). Wie groß ist die Bitrate?`, label: 'Bitrate', unit: 'kbit/s', value: v,
      tips: ['Jedes Symbol trägt mehrere Bit. Die Bitrate ist deshalb größer als die Symbolrate.', 'R_b = R_s · log₂(M).', `R_b = ${F(Rs)} kBd · log₂(${M}).`],
      steps: [`Bit je Symbol: k = log₂(${M}) = ${k}`, `R_b = R_s · k = ${F(Rs)} kBd · ${k} bit = ${F(v)} kbit/s`], meta: { Rs, M } });
  });
  add('Modulation', 'Symbolrate für eine Bitrate', 2, 'dm_symrate', (R) => {
    const q = pick(R, DMQ), M = q[0], k = bitsOf(M), Rb = pick(R, [12, 24, 48, 60, 96, 120, 240, 480]), v = Rb / k;
    return out({ text: `Über eine Funkstrecke sollen ${F(Rb)} kbit/s übertragen werden. Als Modulation ist ${q[1]} mit M = ${M} Symbolzuständen vorgesehen. Welche Symbolrate ist dafür nötig (in kBd, 1 Bd = 1 Symbol je Sekunde)?`, label: 'Symbolrate', unit: 'kBd', value: v,
      tips: ['Je mehr Bit ein Symbol trägt, desto weniger Symbole je Sekunde brauchst du für dieselbe Bitrate.', 'R_s = R_b / log₂(M).', `R_s = ${F(Rb)} kbit/s / log₂(${M}).`],
      steps: [`Bit je Symbol: k = log₂(${M}) = ${k}`, `R_s = R_b / k = ${F(Rb)} kbit/s / ${k} bit = ${F(v)} kBd`], meta: { Rb, M } });
  });
  add('Modulation', 'Bandbreite mit Roll-off-Faktor', 2, 'dm_bw', (R) => {
    const Rs = pick(R, [10, 20, 25, 50, 100, 200]), a = pick(R, [0.2, 0.25, 0.35, 0.5]), v = Rs * (1 + a);
    return out({ text: `Ein digitaler Sender überträgt ${F(Rs)} kBd (das sind ${F(Rs)} 000 Symbole je Sekunde). Sein Impulsformfilter hat den Roll-off-Faktor α = ${F(a)}. Welche Bandbreite belegt das modulierte Signal ungefähr?`, label: 'Bandbreite', unit: 'kHz', value: v,
      tips: ['Ohne Roll-off wäre die Bandbreite so groß wie die Symbolrate, das ist das theoretische Minimum. Der Roll-off-Faktor sagt, um welchen Anteil die weichen Filterflanken das Spektrum breiter machen.', 'B ≈ R_s · (1 + α).', `B ≈ ${F(Rs)} kHz · (1 + ${F(a)}).`],
      steps: ['B ≈ R_s · (1 + α)', `B ≈ ${F(Rs)} kHz · ${F(1 + a)} = ${F(v)} kHz`, `(ganz ohne Roll-off wären es mindestens ${F(Rs)} kHz)`], meta: { Rs, a } });
  });
  add('Modulation', 'Modulationsindex bei FSK', 2, 'dm_fsk_h', (R) => {
    const Rb = pick(R, [10, 20, 40, 50, 100]), h0 = pick(R, [0.5, 0.75, 1, 1.5, 2]), f0 = pick(R, [450, 500, 600, 750]), f1 = f0 + h0 * Rb, df = f1 - f0, v = df / Rb;
    return out({ text: `Ein 2-FSK-Sender sendet für eine „0“ die Frequenz f₀ = ${F(f0)} kHz und für eine „1“ die Frequenz f₁ = ${F(f1)} kHz. Die Bitrate beträgt R_b = ${F(Rb)} kbit/s. Der Frequenzabstand ist Δf = f₁ − f₀, der Modulationsindex ist h = Δf / R_b. Wie groß ist h?`, label: 'Modulationsindex h', unit: '', value: v,
      tips: ['Bei FSK steht jede der beiden Frequenzen für einen Bitwert. Der Index vergleicht den Abstand der beiden Frequenzen mit der Bitrate.', 'Δf = f₁ − f₀ und h = Δf / R_b (kHz geteilt durch kbit/s ergibt eine Zahl ohne Einheit).', `h = (${F(f1)} kHz − ${F(f0)} kHz) / ${F(Rb)} kbit/s.`],
      steps: ['Δf = f₁ − f₀ und h = Δf / R_b', `Δf = ${F(f1)} kHz − ${F(f0)} kHz = ${F(df)} kHz`, `h = ${F(df)} kHz / ${F(Rb)} kbit/s = ${F(v)}`].concat(v === 0.5 ? ['Mit h = 0,5 heißt das Verfahren MSK (Minimum Shift Keying): Das ist bei kohärenter Demodulation der kleinste Abstand, bei dem die beiden Signale zueinander orthogonal sind.'] : []), meta: { f0, f1, Rb }, tolo: { abs: 0.01 } });
  });
  add('Modulation', 'Spektrale Effizienz', 3, 'dm_eff', (R) => {
    const q = pick(R, [DM[1], DM[3], DM[4], DM[5]]), M = q[0], k = bitsOf(M), Rs = pick(R, [1, 2, 5, 10]), a = pick(R, [0.2, 0.25, 0.35, 0.5]), Rb = Rs * k, B = Rs * (1 + a), v = Rb / B;
    return out({ text: `Eine Richtfunkstrecke arbeitet mit ${q[1]} (M = ${M} Symbolzustände) bei einer Symbolrate von ${F(Rs)} MBd. Das Impulsformfilter hat den Roll-off-Faktor α = ${F(a)}, die belegte Bandbreite ist B ≈ R_s · (1 + α). Wie groß ist die spektrale Effizienz, also die Bitrate geteilt durch die Bandbreite?`, label: 'Spektrale Effizienz', unit: 'bit/s/Hz', value: v,
      tips: ['Die spektrale Effizienz sagt, wie viele Bit je Sekunde in jedem Hertz Bandbreite Platz finden. Du brauchst also zuerst die Bitrate und die Bandbreite.', 'η = R_b / B mit R_b = R_s · log₂(M) und B ≈ R_s · (1 + α).', `η = (${F(Rs)} MBd · log₂(${M})) / (${F(Rs)} MHz · (1 + ${F(a)})).`],
      steps: [`R_b = R_s · log₂(M) = ${F(Rs)} MBd · ${k} bit = ${F(Rb)} Mbit/s`, `B ≈ R_s · (1 + α) = ${F(Rs)} MHz · ${F(1 + a)} = ${F(B)} MHz`, `η = R_b / B = ${F(Rb)} Mbit/s / ${F(B)} MHz = ${F(v)} bit/s je Hz`, 'Die Symbolrate kürzt sich heraus: η = log₂(M) / (1 + α).'], meta: { M, Rs, a } });
  });

  /* ============================================================ Lerntexte */
  const BLOCKS = [
    { id: 'kenn', tab: 'kenn', cat: 'Kenngrößen', icon: '〰️', title: 'Signale und Kenngrößen',
      intro: 'Ein Signal ist eine Größe, die sich über die Zeit verändert. Mit wenigen Kennzahlen beschreibst du, wie „stark“ und wie „spitz“ sie ist: Mittelwert, Effektivwert und Crest-Faktor. Stelle unten eine Kurvenform ein und lies die Werte ab.',
      more: [
        ['Mittelwert', 'Der Mittelwert (Gleichanteil) ist die Fläche unter der Kurve, geteilt durch die Periodendauer. Ein symmetrischer Sinus hat den Mittelwert 0, ein Rechteck zwischen 0 und Û den Wert Û·D (Tastgrad D = Einschaltdauer geteilt durch Periodendauer).'],
        ['Effektivwert', 'Der Effektivwert sagt, welche Gleichspannung dieselbe Wärme im Widerstand erzeugt. Du bildest das Quadrat des Signals, mittelst es und ziehst die Wurzel (englisch RMS: Root Mean Square). Er ist die Kennzahl für Leistung. Bei Signalen mit verschiedenen Frequenzen addieren sich die Quadrate der Anteile.'],
        ['Gleichrichtwert', 'Der Gleichrichtwert ist der Mittelwert des Betrags. Billige Messgeräte messen ihn und rechnen mit dem Formfaktor der Sinusform auf einen „Effektivwert“ um. Bei anderen Kurvenformen zeigen sie dann falsch an. True-RMS-Geräte bilden wirklich das Quadratmittel.'],
        ['Crest- und Formfaktor', 'Crest-Faktor = Scheitelwert / Effektivwert: Er zeigt, wie spitz ein Signal ist (Rechteck 1, Sinus √2, Dreieck √3, kurze Impulse sehr groß). Formfaktor = Effektivwert / Gleichrichtwert.']
      ] },
    { id: 'spek', tab: 'spek', cat: 'Spektrum und DFT', icon: '📊', title: 'Spektrum, DFT und FFT',
      intro: 'Praktisch jedes technische Signal lässt sich als Summe von Sinusschwingungen darstellen (bei periodischen Signalen: Gleichanteil plus Grundschwingung und Oberschwingungen). Das Spektrum zeigt, welche Frequenzen mit welcher Amplitude darin stecken. Mische unten ein eigenes Signal und sieh, was die FFT daraus macht. Stelle die Frequenz zwischen zwei Rasterlinien, dann erlebst du den Leckeffekt.',
      more: [
        ['DFT und FFT', 'Die diskrete Fourier-Transformation (DFT) rechnet N Abtastwerte in N komplexe Spektralwerte um. Direkt nach Definition braucht sie etwa N² Rechenschritte. Die FFT liefert exakt dasselbe Ergebnis mit nur etwa N·log₂N Schritten, indem sie die Summe geschickt in gerade und ungerade Anteile zerlegt. Beim hier benutzten Verfahren (Radix 2) muss N eine Zweierpotenz sein.'],
        ['Frequenzraster', 'Die Linien liegen im Abstand Δf = f_s/N, das ist der Kehrwert der Messdauer. Wer feiner auflösen will, muss länger messen. Mehr Abtastwerte bei gleicher Dauer helfen nicht.'],
        ['Leckeffekt', 'Die DFT tut so, als wiederhole sich das Messfenster endlos. Passt eine ganze Zahl von Perioden hinein, stimmt das. Sonst entsteht an der Nahtstelle ein Sprung, und die Linie „zerfließt“ auf viele Nachbarlinien. Der Spitzenwert sinkt (bis zu 3,9 dB beim Rechteckfenster).'],
        ['Fensterung', 'Ein Fenster blendet die Ränder des Messbereichs sanft aus. Das Hann-Fenster verringert den Leckeffekt stark, kostet aber Auflösung (die Linien werden breiter). Weil das Fenster auch die Amplitude im Mittel verkleinert, muss man mit dem Fenstermittelwert (Hann: 0,5) korrigieren.']
      ] },
    { id: 'abt', tab: 'abt', cat: 'Abtastung', icon: '⏱️', title: 'Abtastung und Aliasing',
      intro: 'Ein Digitalsystem sieht ein Signal nur an einzelnen Zeitpunkten. Tastet es zu langsam ab, wird aus einer hohen Frequenz eine niedrigere Scheinfrequenz (Alias). Ändere unten Signal- und Abtastfrequenz und beobachte, wann sich die Rekonstruktion vom Original löst.',
      more: [
        ['Abtasttheorem', 'Ein Signal, das nur Frequenzen unterhalb von f_max enthält, lässt sich aus seinen Abtastwerten vollständig zurückgewinnen, wenn f_s größer als 2·f_max ist. Die halbe Abtastfrequenz heißt Nyquist-Frequenz.'],
        ['Aliasing', 'Das Spektrum eines abgetasteten Signals wiederholt sich bei allen Vielfachen von f_s. Liegt eine Frequenz oberhalb von f_s/2, rutscht ihre Wiederholung ins Nutzband. Die Scheinfrequenz ist der Abstand zum nächsten Vielfachen von f_s: f_Alias = |f − n·f_s|.'],
        ['Antialiasing-Filter', 'Was einmal als Alias im Nutzband liegt, lässt sich nicht mehr vom echten Signal trennen. Deshalb sperrt ein analoges Tiefpassfilter vor dem Wandler alles oberhalb von f_s/2. Streng genügt es, ab f_s − f_n zu sperren (f_n = höchste Nutzfrequenz), weil erst diese Anteile in das Nutzband bis f_n falten. Es braucht einen Übergangsbereich, daher wählt man f_s etwas größer als 2·f_max.'],
        ['Quantisierung', 'Zusätzlich rundet der Wandler jeden Wert auf eine von 2^N Stufen. Der Fehler wirkt wie Rauschen. Jedes Bit mehr verbessert den Signal-Rausch-Abstand um etwa 6 dB.']
      ] },
    { id: 'fil', tab: 'fil', cat: 'Filter', icon: '🎚️', title: 'Filterentwurf und Frequenzgang',
      intro: 'Ein Filter lässt manche Frequenzen durch und dämpft andere. Der Frequenzgang zeigt das für jede Frequenz als Betrag (in dB) und Phase. Ziehe unten an der Grenzfrequenz und der Güte und sieh gleichzeitig, wie die Sprungantwort im Zeitbereich reagiert.',
      more: [
        ['Betrag und Phase', 'Eine Sinusschwingung am Eingang kommt als Sinus gleicher Frequenz am Ausgang an, aber mit anderer Amplitude und verschoben. Das Verhältnis der Amplituden ist der Betrag |H(f)|, die Verschiebung die Phase. Im Bode-Diagramm trägt man den Betrag in dB und die Phase über der Frequenz (logarithmisch) auf.'],
        ['Grenzfrequenz', 'Die Grenzfrequenz ist dort, wo der Betrag um 3 dB gesunken ist (auf 1/√2 oder 71 %); die Leistung hat sich dann halbiert. Bei einem RC-Glied gilt f_g = 1/(2πRC). Eine Ordnung bedeutet 20 dB je Dekade Flankensteilheit, zwei Ordnungen 40 dB je Dekade.'],
        ['Güte und Schwingverhalten', 'Bei Filtern 2. Ordnung bestimmt die Güte Q die Form: Ab Q > 0,5 schwingt die Sprungantwort über (bei Q = 0,707, Butterworth, um 4,3 %). Q = 0,707 hat den flachsten Betragsverlauf; größere Q erzeugen zusätzlich eine Überhöhung nahe der Grenzfrequenz. Beim Bandpass bestimmt Q die Bandbreite B = f₀/Q.'],
        ['Zeit- und Frequenzbereich', 'Eine kleine Bandbreite bedeutet einen langsamen Anstieg: Beim Tiefpass 1. Ordnung ist die Anstiegszeit (10 % bis 90 %) etwa 0,35/f_g. Steile Filterflanken verlängern zusätzlich das Einschwingen. Das ist derselbe Zusammenhang wie bei der Bandbreite eines Oszilloskops.']
      ] },
    { id: 'fal', tab: 'fal', cat: 'Faltung', icon: '🧮', title: 'Faltung und Impulsantwort',
      intro: 'Die Impulsantwort h[n] verrät alles über ein lineares, zeitinvariantes System (LTI-System): Gibt man einen einzelnen Impuls hinein, kommt h heraus. Jedes Eingangssignal ist eine Folge von Impulsen, deshalb ergibt sich der Ausgang aus der Faltung y = x ∗ h. Schiebe unten den Regler n und sieh, wie jeder Ausgangswert entsteht.',
      more: [
        ['So rechnest du', 'Spiegle h, lege es unter x so, dass h[0] unter x[n] liegt, multipliziere übereinanderliegende Werte und addiere. Für den nächsten Ausgangswert schiebst du h um eine Stelle weiter. Formel: y[n] = Σ x[k]·h[n − k].'],
        ['Eigenschaften', 'Das Ergebnis hat die Länge M + K − 1. Faltung ist vertauschbar und assoziativ, und die Reihenschaltung zweier Systeme hat als Impulsantwort die Faltung ihrer Einzelantworten. Ein einzelner Impuls ist das neutrale Element.'],
        ['Typische Systeme', 'Der gleitende Mittelwert [1/3, 1/3, 1/3] glättet (Tiefpass), der Differenzbildner [1, −1] (zeitdiskreter Differenzierer) betont schnelle Änderungen (Hochpass), und ein Echo [1, 0, 0, a] fügt eine verzögerte Kopie hinzu.'],
        ['Zum Frequenzbereich', 'Faltung im Zeitbereich entspricht der Multiplikation der Spektren. Darum kann man lange Faltungen schnell mit der FFT rechnen. Die Summe aller Werte von h ist die Verstärkung bei Frequenz 0.']
      ] },
    { id: 'mod', tab: 'mod', cat: 'Modulation', icon: '📡', title: 'Modulation (AM und FM)',
      intro: 'Um Information über Funk oder Leitungen zu schicken, „reitet“ sie auf einem hochfrequenten Träger. Bei AM verändert das Nutzsignal die Amplitude des Trägers, bei FM seine Frequenz. Ändere unten Träger und Modulation und beobachte Zeitverlauf und Spektrum.',
      more: [
        ['Amplitudenmodulation', 's(t) = Â_T·(1 + m·cos ω_m t)·cos ω_T t. Das Spektrum hat den Träger und zwei Seitenlinien bei f_T ± f_m, jede mit m·Â_T/2. Die Bandbreite ist 2·f_m. Der Modulationsgrad m darf nicht über 1 steigen, sonst wird die Hüllkurve verzerrt (Übermodulation).'],
        ['Leistung', 'Nur die Seitenbänder tragen die Nachricht. Ihr Anteil an der Gesamtleistung ist m²/(2 + m²), selbst bei m = 1 nur ein Drittel.'],
        ['Frequenzmodulation', 'Bei FM bleibt die Amplitude konstant, die Momentanfrequenz schwankt um bis zu ±Δf (Frequenzhub) um die Trägerfrequenz. Der Modulationsindex ist β = Δf/f_m. Das Spektrum besteht aus vielen Seitenlinien im Abstand f_m, ihre Amplituden folgen den Besselfunktionen J_n(β).'],
        ['Bandbreite von FM', 'Für die Praxis genügt die Carson-Regel B ≈ 2·(Δf + f_m). FM braucht mehr Bandbreite als AM, ist dafür aber unempfindlicher gegen Amplitudenstörungen.'],
        ['Digitale Modulation', 'Bei digitaler Modulation steht jedes Symbol für eine Gruppe von Bit. Mit M Symbolzuständen sind es log₂(M) Bit je Symbol (QPSK 2, 16-QAM 4, 64-QAM 6). Die Bitrate ist die Symbolrate mal Bit je Symbol. Bei PSK und QAM belegt das Signal mit einem Impulsformfilter etwa B ≈ R_s·(1 + α), dabei ist α der Roll-off-Faktor. Für FSK gilt diese Formel nicht. Die spektrale Effizienz R_b/B in bit/s je Hz sagt, wie gut die Bandbreite genutzt wird. Bei 2-FSK steht jede der beiden Frequenzen für einen Bitwert, der Modulationsindex ist h = Δf/R_b mit dem Frequenzabstand Δf.']
      ] }
  ];

  const meta = { lab: 'sig', name: 'Signale und Systeme', stufe: 'studium', version: 'v63.185', zielgruppe: 'Technikerschule, Duales Studium, Wirtschaftsingenieurwesen', bloecke: BLOCKS.length };
  const TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  const api = { meta, tasks, CATS, blocks: BLOCKS };
  root.SIG_DATA = api; root.SIG_TASKS = TASKS;
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign(api, { TASKS });
})(typeof window !== 'undefined' ? window : globalThis);
