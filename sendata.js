/* sendata.js - Sensorik-Lab: Beispiele und Aufgaben mit automatischer Prüfung (Simulation, ohne Browser lauffähig)
 * window.SEN_DATA  = { examples: [ { id, name, cat, rig, desc, controls, seq?, dur? } ] }   (seq: [{ t(ms), set | ramp }], dur in ms)
 * window.SEN_TASKS = { tasks: [ { id, lab:'sen', cat, title, level, rig, text, hint[3], ask?, start(), sol(), check(answer) } ], run(task, answer) }
 * window.TaskTest  = async only => [ { id, pct, startPct, bad } ]
 * Die Prüfungen laufen headless mit SEN_CORE.runSeq und den sieben Prüfständen (SEN_RIGS): Sie messen Verhalten (Simulation, feste Szenarien),
 * nicht die Form der Eingabe. Benötigt: sencore.js und senrig-temp/opt/force/accel/loop/dig/adc.js.
 * Statische Prüfungen starten den Prüfstand mit den Steuerwerten schon im Konstruktor (rigOpts.controls), damit die Sonde nicht erst
 * einschwingen muss; die Wärmeträgheit zeigen die Beispiele.
 * answer = { rig, controls:{key:Wert}, seq:[{t(ms), set}], rows:[{t(s), key, value}], dur(ms), state, simTime(ms), value:(Zahl|null), text }
 * start() und sol() liefern { rig, controls, seq?, dur?, value? } (value nur bei Zahlenaufgaben, dient dem Selbsttest). */
(function (root) {
  'use strict';
  const CORE = () => root.SEN_CORE, RIGS = () => root.SEN_RIGS;
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');

  /* ====================================================================== Eingabe prüfen und aufbereiten */
  const ctlDefs = rig => { const R = RIGS(); const d = R && R.defs && R.defs[rig]; return d && Array.isArray(d.controls) ? d.controls : null; };
  function toNum(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return parseFloat(v.replace(/\s/g, '').replace(',', '.'));
    return NaN;
  }
  /* Wert an die Steuerelement-Definition anpassen (wie die Oberfläche); undefined = unpassend */
  function coerce(def, v) {
    if (!def) return v;
    if (def.type === 'slider') {
      if (isObj(v) && 'rel' in v) v = def.min + (def.max - def.min) * (+v.rel || 0);
      const x = toNum(v); return fin(x) ? clamp(x, def.min, def.max) : undefined;
    }
    if (def.type === 'switch' || def.type === 'button') return v === undefined || v === null || isObj(v) || Array.isArray(v) ? undefined : !!v;
    if (def.type === 'select') {
      const o = def.options || [];
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      return m ? m.value : undefined;
    }
    return v;
  }
  function rowsToSeq(rows) {
    const m = new Map();
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!isObj(r) || typeof r.key !== 'string') return;
      const t = Math.round(Math.max(0, +r.t || 0) * 1000);
      if (!m.has(t)) m.set(t, {});
      m.get(t)[r.key] = r.value;
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, set]) => ({ t, set }));
  }
  /* -> { controls, seq, problems[] } ; wirft nie */
  function clean(a, rig) {
    const problems = [], defs = ctlDefs(rig), map = {};
    if (defs) defs.forEach(c => { map[c.key] = c; });
    a = isObj(a) ? a : {};
    const one = (k, v, where) => {
      if (defs && !map[k]) { problems.push('Den Steuerwert „' + k + '“ gibt es an diesem Prüfstand nicht' + where + '.'); return undefined; }
      const x = coerce(map[k], v);
      if (x === undefined) { problems.push('Der Wert für „' + k + '“ ist ungültig' + where + '.'); return undefined; }
      return x;
    };
    const controls = {};
    if (isObj(a.controls)) Object.keys(a.controls).forEach(k => { const x = one(k, a.controls[k], ''); if (x !== undefined) controls[k] = x; });
    const src = Array.isArray(a.seq) && a.seq.length ? a.seq : rowsToSeq(a.rows), seq = [];
    src.forEach((e, i) => {
      if (!isObj(e)) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm ist unlesbar.'); return; }
      const t = toNum(e.t);
      if (!fin(t) || t < 0) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm hat keine gültige Zeit.'); return; }
      const out = { t };
      const set = isObj(e.set) ? e.set : (typeof e.key === 'string' ? { [e.key]: e.value } : null);
      if (set) { out.set = {}; Object.keys(set).forEach(k => { const x = one(k, set[k], ' (Schritt ' + (i + 1) + ')'); if (x !== undefined) out.set[k] = x; }); }
      if (isObj(e.ramp) && typeof e.ramp.key === 'string') {
        if (defs && !map[e.ramp.key]) problems.push('Den Steuerwert „' + e.ramp.key + '“ gibt es an diesem Prüfstand nicht (Schritt ' + (i + 1) + ').');
        else out.ramp = { key: e.ramp.key, to: toNum(e.ramp.to), durMs: toNum(e.ramp.durMs) };
      }
      seq.push(out);
    });
    seq.sort((p, q) => p.t - q.t);
    return { controls, seq, problems };
  }
  /* Startwerte: Steuerwerte plus Schritte ganz am Anfang (t <= 50 ms) */
  function initial(c) {
    const o = Object.assign({}, c.controls);
    c.seq.forEach(e => { if (e.t <= 50 && e.set) Object.assign(o, e.set); });
    return o;
  }
  function numAns(a) {
    if (!isObj(a)) return null;
    if (fin(a.value)) return a.value;
    if (typeof a.value === 'string') { const x = toNum(a.value); if (fin(x)) return x; }
    if (typeof a.text === 'string' && a.text.trim() !== '') { const x = toNum(a.text); if (fin(x)) return x; }
    return null;
  }

  /* ====================================================================== Simulation und Auswertung */
  const lastT = seq => seq.reduce((m, e) => Math.max(m, e.t || 0), 0);
  function run(rig, seq, T, controls, o) {
    const ctl = controls || {};
    return CORE().runSeq(rig, seq, T, Object.assign({ controls: ctl, rigOpts: { controls: ctl }, sampleMs: 10 }, o || {}));
  }
  const smpAt = (r, t) => { const s = r.samples; for (let i = 0; i < s.length; i++) if (s[i].t >= t - 1e-9) return s[i]; return s[s.length - 1] || { t: 0, meters: {}, state: {} }; };
  const stAt = (r, t) => smpAt(r, t).state || {};
  const maxOf = (r, k, t0, t1) => r.samples.filter(s => s.t >= (t0 == null ? 0 : t0) && s.t <= (t1 == null ? 1e9 : t1)).reduce((m, s) => Math.max(m, +s.state[k] || 0), 0);
  const hasFault = (r, code) => (r.faults || []).indexOf(code) >= 0;
  /* zuletzt gesetzter Wert eines Steuerwerts (Steuerwerte, dann Schritte) */
  function effCtl(c, key, def) {
    let v = c.controls[key] !== undefined ? c.controls[key] : def;
    c.seq.forEach(e => { if (e.set && e.set[key] !== undefined) v = e.set[key]; });
    return v;
  }
  function mk(rig, fn) {
    return function (a) {
      try {
        const c = clean(a, rig), rows = [];
        const r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || '') }); };
        fn(c, r, a);
        return rows;
      } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
    };
  }
  /* erste Zeile jeder Simulationsaufgabe: Eingabefehler getrennt melden */
  function inputRow(c, r, sim) {
    const errs = c.problems.concat(sim && sim.errors ? sim.errors : []);
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
  }

  /* Zahlenaufgaben: Ergebnis mit 2 % Toleranz; typische Fehler werden im Warum-Text erkannt */
  function askCheck(rig, want, mistakes) {
    return mk(rig, (c, r, a) => {
      const v = numAns(a);
      r(v !== null, 'Du hast eine Zahl in das Antwortfeld eingetragen', 'Tippe das Ergebnis deiner Rechnung als Zahl in das Feld (Komma oder Punkt).');
      if (v === null) { r(false, 'Das Ergebnis stimmt (Toleranz 2 %)', 'Ohne Zahl kann nichts geprüft werden.'); return; }
      const ok = Math.abs(v - want) <= 0.02 * Math.abs(want);
      let why = '';
      if (!ok) {
        const hit = (mistakes || []).find(m => Math.abs(v - m[0]) <= 0.02 * Math.abs(m[0]));
        why = hit ? hit[1] : 'Dein Wert ' + fm(v, 3) + ' weicht mehr als 2 % vom richtigen Ergebnis ab. Rechne mit den Formeln aus dem Tipp noch einmal nach und achte auf die Einheit.';
      }
      r(ok, 'Das Ergebnis stimmt (Toleranz 2 %)', why);
    });
  }

  /* ====================================================================== Rechenwerte der Zahlenaufgaben */
  const NTC50 = 10000 * Math.exp(3950 * (1 / 323.15 - 1 / 298.15));                    /* se3: 3588 Ω */
  const BRIDGE_PT = 5 * (138.5 / (138.5 + 100) - 0.5) * 1000;                          /* se4: 403,6 mV */
  const LEAD_ERR = 2 * 1.5 / 0.385;                                                    /* se5: 7,79 K */
  const PITCH = Math.atan2(0.40, Math.hypot(0.30, 0.86)) * 180 / Math.PI;              /* se14: 23,7° */
  const LSB12 = 5 / 4096 * 1000;                                                       /* se20: 1,2207 mV */

  /* ====================================================================== Prüfungen der Simulationsaufgaben */
  const BASE2 = { sensor: 'ldr', lux: 500, rLoad: 10000, thresh: 2.5, hyst: 0.2, fdelay: 0, target: 'hell', dist: 3, material: 'stahl', ambient: 0 };
  /* se2: Näherungsschalter für Stahl wählen */
  const checkSe2 = mk('licht', (c, r) => {
    const ctl = Object.assign({}, BASE2, initial(c), { material: 'stahl', ambient: 20000, dist: 3 });
    const s = run('licht', [{ t: 1500, set: { dist: 40 } }], 3200, ctl), a = stAt(s, 1400), b = s.final || {};
    inputRow(c, r, s);
    r(ctl.sensor === 'induktiv' || ctl.sensor === 'kapazitiv', 'Du hast einen Näherungsschalter gewählt (induktiv oder kapazitiv)', 'Gewählt ist „' + ctl.sensor + '“. Lichtschranken und LDR leiden unter Fremdlicht, der Ultraschallsensor misst Abstände und schaltet noch bei 150 mm. Für Metall ohne Berührung nimmst du einen Näherungsschalter.');
    r(a.state === 1, 'Bei 3 mm Abstand schaltet der Ausgang ein', 'Bei 3 mm zeigt der Ausgang ' + a.state + '. Der Sensor muss den Stahlbolzen auch bei hellem Hallenlicht (20 000 lx) erkennen.');
    r(b.state === 0, 'Bei 40 mm Abstand fällt der Ausgang wieder ab', 'Bei 40 mm zeigt der Ausgang noch ' + b.state + '. Der Sensor darf nur schalten, wenn der Bolzen wirklich in der Nähe ist, nicht dauernd.');
  });

  /* se6: Selbsterwärmung des NTC */
  const BASE6 = { sensor: 'ntc', circuit: 'teiler', rRef: 100, gain: 1, adcBits: 12, vref: 5, lin: 'sh', selfHeat: true, lead: 0, wires: 2, tMeas: 100 };
  const checkSe6 = mk('temperatur', (c, r) => {
    const ctl = Object.assign({}, BASE6, initial(c), { sensor: 'ntc', circuit: 'teiler', selfHeat: true, lead: 0, tMeas: 100 });
    const s = run('temperatur', [], 600, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(effCtl(c, 'selfHeat', true) !== false, 'Die Selbsterwärmung bleibt eingeschaltet (nicht einfach wegrechnen)', 'Der Schalter „Selbsterwärmung berücksichtigen“ ist aus. Das ist Schummeln: In der Wirklichkeit lässt sich die Erwärmung nicht abschalten, nur verkleinern.');
    r(fin(f.errorStatic) && Math.abs(f.errorStatic) <= 0.5, 'Der Messfehler bei 100 °C beträgt höchstens 0,5 K', 'Fehler im eingeschwungenen Zustand: ' + fm(f.errorStatic, 2) + ' K (Selbsterwärmung ' + fm(f.dTself, 2) + ' K). Die Verlustleistung P = I² · R heizt den NTC auf. Weniger Strom gibt weniger Erwärmung.');
    r(!hasFault(s, 'selfheat'), 'Die Anlage meldet keine Selbsterwärmung', 'Die Anlage meldet noch Selbsterwärmung (Messstrom ' + fm(f.current * 1000, 2) + ' mA).');
    r(!f.saturated && fin(f.resolution) && f.resolution <= 0.2, 'Die Auflösung bleibt besser als 0,2 K je Digit', 'Auflösung: ' + fm(f.resolution, 2) + ' K je Digit. Mit zu kleinem Messstrom bleibt vom Signal kaum etwas übrig: Der Wandler sieht fast nichts.');
  });

  /* se7: Linearisierung des NTC */
  const BASE7 = { sensor: 'ntc', circuit: 'teiler', rRef: 10000, gain: 1, adcBits: 12, vref: 3.3, lin: 'aus', selfHeat: true, lead: 0, wires: 2, tMeas: 20 };
  const checkSe7 = mk('temperatur', (c, r) => {
    const ctl = Object.assign({}, BASE7, initial(c), { sensor: 'ntc', circuit: 'teiler', tMeas: 20 });
    const s = run('temperatur', [{ t: 400, set: { tMeas: 60 } }, { t: 800, set: { tMeas: 90 } }], 1200, ctl);
    inputRow(c, r, s);
    [[20, 350], [60, 750], [90, 1150]].forEach(p => {
      const e = stAt(s, p[1]).errorStatic;
      r(fin(e) && Math.abs(e) <= 2, 'Bei ' + p[0] + ' °C ist der Fehler höchstens 2 K', 'Fehler bei ' + p[0] + ' °C: ' + fm(e, 1) + ' K. Eine Gerade zwischen 0 und 100 °C passt nicht zur Exponentialkurve des NTC. Die Rechnung oder die Tabelle gleicht das aus.');
    });
  });

  /* se9: LDR-Schalter ohne Flattern */
  const BASE9 = { sensor: 'ldr', lux: 10, rLoad: 10000, thresh: 2.5, hyst: 0, fdelay: 0, ambient: 0 };
  const checkSe9 = mk('licht', (c, r) => {
    const ctl = Object.assign({}, BASE9, initial(c), { sensor: 'ldr', lux: 10, ambient: 0 });
    const s = run('licht', [{ t: 3500, set: { lux: 20 } }, { t: 6500, set: { lux: 5 } }], 9500, ctl);
    inputRow(c, r, s);
    const fl = Math.max.apply(null, s.samples.filter(x => x.t >= 1000 && x.t <= 3400).map(x => +x.state.flutter || 0));
    r(fl <= 2 && !hasFault(s, 'flutter'), 'Bei 10 lx bleibt der Ausgang ruhig (höchstens 2 Schaltspiele pro Sekunde)', 'Gemessen: ' + fm(fl, 0) + ' Schaltspiele pro Sekunde. Das Rauschen schaltet den Komparator hin und her, solange es keine Hysterese oder Entprellzeit gibt.');
    r(stAt(s, 6400).state === 1, 'Bei 20 lx schaltet der Ausgang ein', 'Bei 20 lx ist der Ausgang noch ' + stAt(s, 6400).state + '. Die Hysterese ist so groß geworden, dass die Einschaltschwelle erst bei mehr Licht erreicht wird.');
    r(stAt(s, 9400).state === 0, 'Bei 5 lx schaltet der Ausgang wieder aus', 'Bei 5 lx ist der Ausgang noch ' + stAt(s, 9400).state + '. Bei zu großer Hysterese oder Entprellzeit bleibt der Schalter hängen.');
  });

  /* se10: Gabellichtschranke mit Fremdlicht */
  const BASE10 = { sensor: 'gabel', dist: 0, rLoad: 10000, thresh: 2.5, hyst: 0.2, fdelay: 0, ambient: 700 };
  const checkSe10 = mk('licht', (c, r) => {
    const ctl = Object.assign({}, BASE10, initial(c), { sensor: 'gabel', ambient: 700, dist: 0 });
    const seq = [{ t: 600, set: { dist: 30 } }, { t: 1500, set: { dist: 0 } }, { t: 2400, set: { dist: 30 } }, { t: 3300, set: { dist: 0 } }];
    const s = run('licht', seq, 4200, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(stAt(s, 1400).state === 1 && stAt(s, 3200).state === 1, 'Ein Teil in der Gabel (30 mm) schaltet den Ausgang ein', 'Mit Teil in der Gabel zeigt der Ausgang ' + stAt(s, 1400).state + '. Prüfe, ob die Spannung bei abgedunkeltem Empfänger über der Schwelle liegt.');
    r(stAt(s, 2300).state === 0 && f.state === 0, 'Ohne Teil schaltet der Ausgang aus', 'Ohne Teil bleibt der Ausgang auf ' + f.state + '. Das Fremdlicht hält den Empfänger offen oder sättigt ihn; die Schwelle muss zwischen beiden Pegeln liegen.');
    r(!hasFault(s, 'saturation') && !hasFault(s, 'ambient'), 'Weder Sättigung noch Fremdlicht-Meldung', 'Die Anlage meldet ' + s.faults.join(' und ') + '. Mit großem Arbeitswiderstand läuft der Empfänger bei Fremdlicht an den Anschlag.');
  });

  /* se12: Verstärkung wählen */
  const BASE12 = { mode: 'kraft', bridge: 'voll', uBridge: 5, gain: 10, offset: 0, filter: 20, adcBits: 12, temp: 25, cal: true, force: 100 };
  const checkSe12 = mk('kraft', (c, r) => {
    const ctl = Object.assign({}, BASE12, initial(c), { mode: 'kraft', bridge: 'voll', temp: 25, force: 100 });
    const s = run('kraft', [], 800, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.uOut) && f.uOut >= 2.6 && f.uOut <= 3.2, 'Bei 100 N liegt die Spannung am Wandler zwischen 2,6 V und 3,2 V', 'Gemessen: ' + fm(f.uOut, 2) + ' V. Der Wandler arbeitet von 0 bis 3,3 V; der Endwert soll ihn zu etwa 80 bis 95 % aussteuern. Nach der Brücke liegen bei 5 V Speisung rund 10 mV, dazu kommt ein fester Offset von etwa 0,17 V.');
    r(!f.saturated && !hasFault(s, 'saturation'), 'Der Wandler läuft nicht an den Anschlag', 'Der Wandler ist übersteuert. Die Verstärkung ist zu groß: Der Endwert würde abgeschnitten.');
    r(!hasFault(s, 'selfheat'), 'Der DMS wird nicht zu warm (keine Meldung zu hoher Speisung)', 'Bei 10 V Speisespannung erwärmen sich die DMS selbst. Besser eine kleinere Speisespannung nehmen und die Verstärkung erhöhen.');
    r(fin(f.value) && Math.abs(f.value - 100) <= 2, 'Die Anzeige zeigt bei 100 N auch 100 N (±2 N)', 'Angezeigt: ' + fm(f.value, 1) + ' N. Mit sehr kleiner Wandlerauflösung oder stark abgeschnittenem Signal stimmt die Anzeige nicht mehr.');
  });

  /* se13: Kalibrierung per Ablaufprogramm */
  const BASE13 = { mode: 'kraft', bridge: 'viertel', uBridge: 5, gain: 200, offset: 0, filter: 20, adcBits: 12, temp: 25, cal: true, force: 0, calZero: false, calSpan: false };
  const checkSe13 = mk('kraft', (c, r) => {
    const L = lastT(c.seq), t1 = L + 1500, t2 = t1 + 4000, t3 = t2 + 4000, T = t3 + 4000;
    const ver = [{ t: t1, set: { force: 0 } }, { t: t2, set: { force: 50 } }, { t: t3, set: { force: 100 } }];
    const ctl = Object.assign({}, BASE13, initial(c), { mode: 'kraft', bridge: 'viertel', temp: 25, force: 0, calZero: false, calSpan: false });
    const s = run('kraft', c.seq.concat(ver), T, ctl), f = s.final || {};
    inputRow(c, r, s);
    const press = key => c.seq.filter(e => e.set && e.set[key] === true).map(e => +stAt(s, e.t + 20).force || 0);
    const zf = press('calZero'), sf = press('calSpan');
    r(zf.length > 0 && zf.some(x => x <= 5), 'Der Nullpunkt wird im lastfreien Zustand abgeglichen (Taster bei höchstens 5 N)', zf.length ? 'Der Nullpunkt-Abgleich fand bei ' + fm(zf[0], 0) + ' N statt. Ohne Last muss die Anzeige 0 N zeigen: Nimm die Last erst weg, dann drücke den Taster.' : 'Im Ablaufprogramm fehlt der Taster „Nullpunkt abgleichen“ (calZero).');
    r(sf.length > 0 && sf.some(x => x >= 80), 'Der Endwert wird bei (fast) voller Last abgeglichen (Taster bei mindestens 80 N)', sf.length ? 'Der Endwert-Abgleich fand bei ' + fm(sf[0], 0) + ' N statt. Der Endwert braucht die Referenzlast von 100 N.' : 'Im Ablaufprogramm fehlt der Taster „Endwert abgleichen“ (calSpan).');
    r(effCtl(c, 'cal', true) !== false, 'Die Kalibrierung ist eingeschaltet („Kalibrierung verwenden“)', 'Der Schalter „Kalibrierung verwenden“ ist aus: Die Abgleichwerte werden dann nicht benutzt.');
    [['0 N', t2 - 100, 0], ['50 N', t3 - 100, 50], ['100 N', T, 100]].forEach(p => {
      const x = stAt(s, p[1]), e = fin(x.value) ? x.value - p[2] : NaN;
      r(fin(e) && Math.abs(e) <= 2.5, 'Bei ' + p[0] + ' liegt die Anzeige höchstens 2,5 N daneben', 'Bei ' + p[0] + ' zeigt die Anzeige ' + fm(x.value, 1) + ' N (Abweichung ' + fm(e, 1) + ' N). Die Viertelbrücke hat einen Nullpunktfehler. Stelle den Nullpunkt im lastfreien Zustand ab und den Endwert bei genau 100 N.');
    });
  });

  /* se15: Messbereich für einen Stoß */
  const BASE15 = { tiltX: 0, tiltY: 0, shock: 8, range: 2, res: 10, rate: 100, filter: 0, vibFreq: 0, vibAmp: 0 };
  const checkSe15 = mk('beschleunigung', (c, r) => {
    const T = clamp(lastT(c.seq) + 2000, 2500, 12000);
    const ctl = Object.assign({}, BASE15, initial(c), { shock: 8, vibFreq: 0, vibAmp: 0, tiltX: 0, tiltY: 0, hit: false });
    const s = run('beschleunigung', c.seq, T, ctl, { sampleMs: 5 });
    inputRow(c, r, s);
    const hit = c.seq.some(e => e.set && e.set.hit === true);
    r(hit, 'Im Ablaufprogramm wird der Stoß ausgelöst (Taster „Stoß auslösen“)', 'Im Ablaufprogramm fehlt der Schritt „hit = an“. Ohne Stoß gibt es nichts zu messen.');
    r(!hasFault(s, 'clip') && hit, 'Der Messbereich reicht: kein Clipping', 'Die Anlage meldet Clipping bei ±' + fm(+effCtl(c, 'range', 2), 0) + ' g. Der Stoß von etwa 8 g (plus 1 g Erdbeschleunigung) passt nicht hinein.');
    const pk = maxOf(s, 'peak');
    r(pk >= 8.0 && hit, 'Die gemessene Spitze liegt bei mindestens 8,0 g', 'Gemessene Spitze: ' + fm(pk, 1) + ' g. Ein kurzer Stoß dauert nur wenige Millisekunden: Bei niedriger Datenrate oder aktivem Tiefpassfilter wird die Spitze verschluckt.');
  });

  /* se18: Bürde für 4…20 mA */
  const BASE18 = { signal: '420', value: 10, lo: 0, hi: 10, uSupply: 24, rBurden: 750, rLine: 100, adcBits: 12, emi: 0, wireBreak: false, short: false };
  const checkSe18 = mk('normsignal', (c, r) => {
    const ctl = Object.assign({}, BASE18, initial(c), { signal: '420', uSupply: 24, rLine: 100, lo: 0, hi: 10, wireBreak: false, short: false, emi: 0, value: 10 });
    const s = run('normsignal', [], 1500, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(!hasFault(s, 'burden') && f.headroom >= 0, 'Der Messumformer bleibt aussteuerbar (genug Spannungsreserve bei 20 mA)', 'Spannungsreserve: ' + fm(f.headroom, 1) + ' V. Der Messumformer braucht mindestens 12 V an seinen Klemmen. Maximalbürde = (24 V − 12 V) / 20 mA − Leitungswiderstand = 500 Ω.');
    r(!hasFault(s, 'adcOver') && !f.adcClip, 'Der Wandler wird nicht übersteuert', 'Bei 20 mA fallen an der Bürde ' + fm(f.uBurden, 1) + ' V ab, der Wandler verträgt höchstens 5 V. Daraus folgt R ≤ 5 V / 20 mA = 250 Ω.');
    r(fin(f.shown) && Math.abs(f.shown - 10) <= 0.1, 'Die Anzeige zeigt bei 10 bar auch 10 bar (±0,1 bar)', 'Angezeigt: ' + fm(f.shown, 2) + ' bar. Bei Übersteuerung wird der Endwert abgeschnitten.');
    r(fin(f.uAdc) && f.uAdc >= 2.5, 'Der Wandler wird bei 20 mA mindestens zur Hälfte ausgesteuert (2,5 V)', 'Bei 20 mA liegen nur ' + fm(f.uAdc, 2) + ' V am Wandler. Mit mindestens 125 Ω nutzt du mehr als die Hälfte seines Bereichs; sonst bleibt die Auflösung grob.');
  });

  /* se19: Drahtbruch erkennen */
  const BASE19 = { signal: '010', value: 5, lo: 0, hi: 10, uSupply: 24, rBurden: 250, rLine: 20, adcBits: 12, emi: 0, wireBreak: false, short: false };
  const checkSe19 = mk('normsignal', (c, r) => {
    const ctl = Object.assign({}, BASE19, initial(c), { value: 5, lo: 0, hi: 10, wireBreak: false, short: false, emi: 0, uSupply: 24 });
    const s = run('normsignal', [{ t: 1500, set: { wireBreak: true } }], 3000, ctl);
    inputRow(c, r, s);
    const a = stAt(s, 1400), b = stAt(s, 2900);
    r(fin(a.shown) && Math.abs(a.shown - 5) <= 0.2, 'Vor dem Bruch misst die Kette richtig (5 bar, ±0,2 bar)', 'Vor dem Bruch wird ' + fm(a.shown, 2) + ' bar angezeigt statt 5 bar. Prüfe Bürde und Wandler.');
    r(b.wireDetected === true, 'Der Drahtbruch wird erkannt (die Auswertung meldet „Leitung unterbrochen“)', 'Beim Drahtbruch zeigt die Anlage keine Fehlererkennung (angezeigt: ' + fm(b.shown, 2) + ' bar). Bei 0…10 V ist 0 V ein gültiger Messwert, bei 0…20 mA ebenso 0 mA. Nur ein Signal mit „Live Zero“ (4 mA oder 1 V) unterscheidet Bruch und Nullpunkt.');
  });

  /* se21: Abtastrate wählen */
  const BASE21 = { wave: 'sin', fSig: 900, amp: 1.5, offset: 1.65, noise: 0, bits: 12, vref: 3.3, fs: 1000, sampleHold: true, aaf: false };
  const checkSe21 = mk('adu', (c, r) => {
    const ctl = Object.assign({}, BASE21, initial(c), { wave: 'sin', fSig: 900, amp: 1.5, offset: 1.65, noise: 0 });
    const s = run('adu', [], 1500, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(!hasFault(s, 'aliasing') && !f.aliasing, 'Die Anlage meldet kein Aliasing', 'Bei fs = ' + fm(+ctl.fs, 0) + ' Hz erscheint das 900-Hz-Signal als ' + fm(f.fAlias, 0) + ' Hz. Das Abtasttheorem verlangt fs > 2 · f_max.');
    r(fin(f.fAlias) && Math.abs(f.fAlias - 900) <= 5, 'Der Prüfstand erkennt das Signal mit 900 Hz', 'Erkannt wird ' + fm(f.fAlias, 0) + ' Hz statt 900 Hz. Ein Anti-Aliasing-Filter allein hilft nicht: Er würde das 900-Hz-Signal selbst wegfiltern.');
    r(+ctl.fs >= 2250, 'Die Abtastrate beträgt mindestens das 2,5-fache der Signalfrequenz (2250 Hz)', 'fs = ' + fm(+ctl.fs, 0) + ' Hz. In der Praxis nimmt man mindestens das 2,5- bis 5-fache, damit auch die Kurvenform erkennbar bleibt.');
    r(+ctl.fs <= 5000, 'Die Abtastrate bleibt höchstens 5000 Hz (Speicher und Rechenzeit)', 'fs = ' + fm(+ctl.fs, 0) + ' Hz ist unnötig hoch. Der Mikrocontroller schafft höchstens 5000 Messungen je Sekunde.');
  });

  /* se22: Pull-up wählen (Standardmodus, 2 m Kabel) */
  const BASE22 = { sensor: 'sht', addr: 68, addrPin: 'low', twin: false, pullup: 47000, busSpeed: 100000, busLength: 2, stretch: false };
  const checkSe22 = mk('digital', (c, r) => {
    const ctl = Object.assign({}, BASE22, initial(c), { sensor: 'sht', twin: false, addr: 68, addrPin: 'low', busSpeed: 100000, busLength: 2 });
    const s = run('digital', [], 10000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.tr) && fin(f.trLimit) && f.tr <= f.trLimit, 'Die Anstiegszeit liegt innerhalb der Grenze von 1000 ns', 'Anstiegszeit: ' + fm(f.tr, 0) + ' ns (Grenze ' + fm(f.trLimit, 0) + ' ns). Aus t_r = 0,8473 · R · C folgt R ≤ 1000 ns / (0,8473 · 210 pF) = 5,6 kΩ.');
    r(f.pullupLow === false, 'Der Pull-up ist nicht zu klein (Ausgangsstrom des Sensors bleibt zulässig)', 'Mit so wenig Widerstand müsste der Sensor mehr als 3 mA nach Masse ziehen. Der untere Grenzwert liegt bei etwa (3,3 V − 0,4 V) / 3 mA = 1 kΩ.');
    r(fin(f.txCount) && f.txCount >= 1 && f.txFail === 0 && f.lastOk === true, 'Alle Übertragungen laufen fehlerfrei', 'Fehlgeschlagene Übertragungen: ' + f.txFail + ' von ' + f.txCount + ' (Grund: ' + (f.lastReason || '?') + '). Zu langsame Flanken verfälschen die Bits.');
  });

  /* se23: Adresskonflikt lösen */
  const BASE23 = { sensor: 'sht', addr: 68, addrPin: 'low', twin: true, pullup: 4700, busSpeed: 100000, busLength: 0.3, stretch: false };
  const checkSe23 = mk('digital', (c, r) => {
    const ctl = Object.assign({}, BASE23, initial(c), { sensor: 'sht', twin: true, busSpeed: 100000, pullup: 4700, busLength: 0.3 });
    const s = run('digital', [], 10000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(effCtl(c, 'twin', true) !== false, 'Beide Sensoren bleiben am Bus (der zweite wird nicht abgesteckt)', 'Der zweite Sensor wurde entfernt. Die Aufgabe verlangt, dass beide Sensoren am Bus bleiben.');
    r(f.conflict === false, 'Es gibt keine Adresskollision mehr', 'Beide Sensoren antworten auf dieselbe Adresse und stören sich gegenseitig. Der SHT hat einen Adress-Pin: Low gibt 0x44, High gibt 0x45.');
    r(f.readsTwin === false && fin(f.rhShown) && Math.abs(f.rhShown - 45) <= 1, 'Der Controller liest den richtigen Sensor (45 % Feuchte)', 'Angezeigt: ' + fm(f.rhShown, 1) + ' % Feuchte. Der Controller fragt jetzt vielleicht die Adresse des zweiten Sensors ab. Stelle „Adresse im Controller“ passend zum umgesteckten Sensor ein.');
    r(fin(f.txCount) && f.txCount >= 1 && f.txFail === 0 && f.lastOk === true, 'Alle Übertragungen laufen fehlerfrei (Prüfsumme stimmt)', 'Fehlgeschlagene Übertragungen: ' + f.txFail + ' von ' + f.txCount + ' (Grund: ' + (f.lastReason || '?') + ').');
  });

  /* se24: Pt100 zeigt zu viel an (Leitungswiderstand) */
  const BASE24 = { sensor: 'pt100', circuit: 'bruecke', rRef: 100, gain: 5, adcBits: 12, vref: 3.3, lin: 'sh', selfHeat: true, lead: 2, wires: 2, tMeas: 60 };
  const checkSe24 = mk('temperatur', (c, r) => {
    const ctl = Object.assign({}, BASE24, initial(c), { sensor: 'pt100', lead: 2, tMeas: 60, selfHeat: true });
    const s = run('temperatur', [], 600, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(effCtl(c, 'sensor', 'pt100') === 'pt100' && effCtl(c, 'lead', 2) >= 1.5, 'Der Sensor bleibt ein Pt100 und das Kabel behält seinen Widerstand (2 Ω je Ader)', 'Du hast den Sensor getauscht oder den Leitungswiderstand wegeingestellt. Das Kabel ist fest verlegt und der Pt100 bleibt.');
    r(fin(f.errorStatic) && Math.abs(f.errorStatic) <= 0.5, 'Die Anzeige liegt bei 60 °C höchstens 0,5 K daneben', 'Fehler: ' + fm(f.errorStatic, 1) + ' K. Im 2-Leiter-Betrieb addiert sich der Widerstand beider Adern (4 Ω) zum Pt100; das sind rund 10 K. Eine Schaltung mit Leitungsausgleich beseitigt ihn.');
    r(+effCtl(c, 'wires', 2) >= 3, 'Die Anschlusstechnik gleicht den Leitungswiderstand aus (3- oder 4-Leiter)', 'Bei 2-Leiter-Technik geht der Widerstand beider Adern in die Messung ein. Nur 3- oder 4-Leiter-Technik gleicht ihn aus.');
    r(!f.saturated, 'Der Wandler ist nicht übersteuert', 'Der Wandler läuft an den Anschlag.');
  });

  /* se25: DMS driftet bei Wärme */
  const BASE25 = { mode: 'kraft', bridge: 'viertel', uBridge: 5, gain: 200, offset: 0, filter: 20, adcBits: 12, temp: 60, cal: true, force: 0 };
  const checkSe25 = mk('kraft', (c, r) => {
    const ctl = Object.assign({}, BASE25, initial(c), { mode: 'kraft', temp: 60, force: 0 });
    const s = run('kraft', [{ t: 1500, set: { force: 100 } }], 3500, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(effCtl(c, 'temp', 60) >= 55, 'Die Betriebstemperatur am DMS bleibt bei 60 °C', 'Die Maschine läuft heiß; die Temperatur lässt sich nicht einfach wegstellen. Die Messschaltung muss die Wärme vertragen.');
    const z = stAt(s, 1400), e0 = z.value - 0, e1 = f.value - 100;
    r(fin(e0) && Math.abs(e0) <= 2, 'Ohne Last zeigt die Anzeige höchstens 2 N daneben', 'Ohne Last zeigt die Anzeige ' + fm(z.value, 1) + ' N. Die Wärme dehnt den Federkörper und ändert den DMS-Widerstand; eine einzelne Brückenhälfte gleicht das nicht aus.');
    r(fin(e1) && Math.abs(e1) <= 2, 'Bei 100 N zeigt die Anzeige höchstens 2 N daneben', 'Bei 100 N zeigt die Anzeige ' + fm(f.value, 1) + ' N.');
    r(!hasFault(s, 'drift') && !hasFault(s, 'zero'), 'Die Anlage meldet weder Drift noch Nullpunktfehler', 'Die Anlage meldet noch ' + s.faults.filter(x => x === 'drift' || x === 'zero').join(' und ') + '. In einer Voll- oder Halbbrücke heben sich Temperatureinflüsse gegenseitig auf.');
  });

  /* se26: induktiver Näherungsschalter erkennt Aluminium nicht */
  const BASE26 = { sensor: 'induktiv', material: 'alu', dist: 5, rLoad: 10000, ambient: 0 };
  const checkSe26 = mk('licht', (c, r) => {
    const ctl = Object.assign({}, BASE26, initial(c), { material: 'alu', ambient: 0, dist: 5 });
    const s = run('licht', [{ t: 1500, set: { dist: 20 } }], 3200, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(stAt(s, 1400).state === 1, 'Bei 5 mm Abstand schaltet der Ausgang bei Aluminium ein', 'Bei 5 mm bleibt der Ausgang aus. Für Aluminium gilt der Reduktionsfaktor 0,4: Der induktive Sensor mit Sn = 8 mm schaltet erst bei 3,2 mm.');
    r(f.state === 0, 'Bei 20 mm fällt der Ausgang wieder ab', 'Bei 20 mm bleibt der Ausgang ein. Der Sensor darf nur nahe am Teil schalten.');
    r(!hasFault(s, 'material'), 'Der Sensor kann das Material grundsätzlich erkennen', 'Der Sensor reagiert auf dieses Material gar nicht.');
  });

  /* se28: Pt100-Messkette auslegen */
  const BASE28 = { sensor: 'pt100', circuit: 'teiler', rRef: 1000, gain: 1, adcBits: 10, vref: 3.3, lin: 'sh', selfHeat: true, lead: 2, wires: 2, tMeas: 100 };
  const checkSe28 = mk('temperatur', (c, r) => {
    const forced = { sensor: 'pt100', lead: 2, selfHeat: true };
    const at = T => run('temperatur', [], 400, Object.assign({}, BASE28, initial(c), forced, { tMeas: T })).final || {};
    const f0 = at(0), f50 = at(50), f100 = at(100);
    const s100 = run('temperatur', [], 400, Object.assign({}, BASE28, initial(c), forced, { tMeas: 100 }));
    inputRow(c, r, s100);
    const worst = Math.max(Math.abs(f0.errorStatic), Math.abs(f50.errorStatic), Math.abs(f100.errorStatic));
    r(fin(worst) && worst <= 1.5, 'Der Fehler bleibt bei 0, 50 und 100 °C unter 1,5 K', 'Größter Fehler: ' + fm(worst, 1) + ' K. Bei 2 Ω je Ader macht die 2-Leiter-Schaltung rund 10 K Fehler; Leitungsausgleich und ein kleiner Messstrom sind nötig.');
    const vr = +effCtl(c, 'vref', 3.3), rel = f100.uOut / vr;
    r(fin(rel) && rel >= 0.7 && rel <= 0.97 && !f100.saturated, 'Bei 100 °C ist der Wandler zu 70 bis 97 % ausgesteuert', 'Bei 100 °C liegen ' + fm(f100.uOut, 2) + ' V am Wandler (' + fm(rel * 100, 0) + ' % von ' + fm(vr, 1) + ' V). Der Pt100 ändert sich nur um 38,5 Ω; ohne Verstärkung bleibt davon wenig, zu viel Verstärkung übersteuert.');
    r(fin(f100.resolution) && f100.resolution <= 0.15, 'Die Auflösung ist besser als 0,15 K je Digit', 'Auflösung: ' + fm(f100.resolution, 2) + ' K je Digit. Mehr Verstärkung oder mehr Bit helfen.');
    r(!hasFault(s100, 'selfheat') && fin(f100.dTself) && f100.dTself < 1, 'Der Messstrom erwärmt den Pt100 um weniger als 1 K', 'Selbsterwärmung: ' + fm(f100.dTself, 2) + ' K. Ein Pt100 verträgt nur etwa 1 mA Messstrom, ohne spürbar warm zu werden.');
  });

  /* ====================================================================== Aufgaben */
  const S = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});
  const ttl = [
    /* ------------------------------------------------------------ Grundlagen */
    { id: 'se1', lab: 'sen', cat: 'Grundlagen', title: 'Ausgangsspannung der DMS-Vollbrücke', level: 1, rig: 'kraft',
      text: 'Ein Kraftaufnehmer mit DMS-Vollbrücke hat laut Datenblatt den Kennwert 2 mV/V. Du speist die Brücke mit 10 V und belastest den Aufnehmer bis zur Nennlast. Berechne die Ausgangsspannung der Brücke in Millivolt.',
      ask: { label: 'Brückenspannung bei Nennlast', unit: 'mV' },
      hint: ['Der Kennwert sagt dir, wie viele Millivolt Ausgang du je Volt Speisespannung bei Nennlast bekommst.', 'Ausgangsspannung = Kennwert · Speisespannung. Der Kennwert hat die Einheit mV/V, die Speisespannung die Einheit V.', '2 mV/V · 10 V = 20 mV.'],
      start: () => S('kraft', {}, { value: null }), sol: () => S('kraft', {}, { value: 20 }),
      check: askCheck('kraft', 20, [[2, 'Du hast die Speisespannung vergessen. Der Kennwert gilt je Volt: Ausgangsspannung = Kennwert · Speisespannung.'], [0.2, 'Du hast durch die Speisespannung geteilt. Eine höhere Speisespannung ergibt ein größeres Ausgangssignal, also wird multipliziert.'], [0.02, 'Das ist das Ergebnis in Volt. Gefragt sind Millivolt: mal 1000.']]) },
    { id: 'se2', lab: 'sen', cat: 'Grundlagen', title: 'Sensorart für einen Stahlbolzen wählen', level: 1, rig: 'licht',
      text: 'An einer Zuführung soll ein Stahlbolzen berührungslos erkannt werden. Er kommt bis auf 3 mm an den Sensor heran und wird danach wieder weggefahren (40 mm). Die Halle hat große Fenster, es herrschen bis zu 20 000 lx Fremdlicht. Wähle am Licht-Prüfstand eine geeignete Sensorart: Der Ausgang soll bei 3 mm einschalten und bei 40 mm ausschalten.',
      hint: ['Überlege, welche Messgröße zum Stahlbolzen passt: Licht, Abstand oder die Nähe von Metall? Und was stört im Hellen?', 'Optische Sensoren leiden unter Fremdlicht. Ein Näherungsschalter erkennt Metall berührungslos, ganz ohne Licht. Der Ultraschallsensor schaltet erst bei 150 mm und passt nicht.', 'Wähle den induktiven Näherungsschalter (Sn = 8 mm). Auch der kapazitive Schalter erkennt Stahl, er ist aber eher für Kunststoff und Flüssigkeiten gedacht.'],
      start: () => S('licht', { sensor: 'ldr', dist: 3, material: 'stahl', ambient: 20000 }), sol: () => S('licht', { sensor: 'induktiv', dist: 3, material: 'stahl', ambient: 20000 }),
      check: checkSe2 },
    /* ------------------------------------------------------------ Temperatur */
    { id: 'se3', lab: 'sen', cat: 'Temperatur', title: 'NTC-Kennlinie: Widerstand bei 50 Grad', level: 1, rig: 'temperatur',
      text: 'Ein NTC hat bei 25 °C einen Widerstand von 10 kΩ und einen B-Wert von 3950 K. Berechne seinen Widerstand bei 50 °C. Rechne dafür mit der B-Wert-Gleichung. Gib das Ergebnis in Ohm an.',
      ask: { label: 'Widerstand bei 50 °C', unit: 'Ω' },
      hint: ['Bei einem NTC sinkt der Widerstand, wenn die Temperatur steigt. Das Ergebnis muss also kleiner als 10 kΩ sein.', 'R = R25 · exp(B · (1/T − 1/T25)). Setze die Temperaturen in Kelvin ein: T = 273,15 + ϑ.', '1/323,15 K − 1/298,15 K = −2,5948·10⁻⁴ 1/K. Mal 3950 K ergibt −1,0249. exp(−1,0249) = 0,3588. R = 10 kΩ · 0,3588 = 3588 Ω.'],
      start: () => S('temperatur', { sensor: 'ntc', tMeas: 50 }, { value: null }), sol: () => S('temperatur', { sensor: 'ntc', tMeas: 50 }, { value: NTC50 }),
      check: askCheck('temperatur', NTC50, [[5000, 'Der Widerstand ändert sich nicht linear mit der Temperatur, sondern exponentiell. Setze die Werte in die B-Wert-Gleichung ein.'], [NTC50 / 1000, 'Das ist das Ergebnis in Kiloohm. Das Feld erwartet Ohm: mal 1000.'], [10000 * Math.exp(-3950 * (1 / 323.15 - 1 / 298.15)), 'Das Vorzeichen im Exponenten ist vertauscht. Bei höherer Temperatur sinkt der Widerstand des NTC.'], [10000 * 25 / 50, 'Du hast den Widerstand umgekehrt proportional zur Celsius-Temperatur gerechnet. Der NTC folgt der B-Wert-Gleichung mit Temperaturen in Kelvin.']]) },
    { id: 'se4', lab: 'sen', cat: 'Temperatur', title: 'Wheatstone-Brücke mit Pt100', level: 2, rig: 'temperatur',
      text: 'Eine Wheatstone-Brücke wird mit 5 V gespeist. Drei Zweige sind Festwiderstände mit je 100 Ω. Im vierten Zweig sitzt ein Pt100, der bei 100 °C einen Widerstand von 138,5 Ω hat. Der Pt100 liegt unten in derselben Brückenhälfte wie einer der Festwiderstände (Spannungsteiler aus 100 Ω oben und Pt100 unten), die andere Hälfte teilt genau 1:1. Berechne die Brückenspannung in Millivolt.',
      ask: { label: 'Brückenspannung bei 100 °C', unit: 'mV' },
      hint: ['Die Brücke besteht aus zwei Spannungsteilern. Die Brückenspannung ist die Differenz der beiden Teilerspannungen.', 'Ua = Ue · (R_Pt / (100 Ω + R_Pt) − 100 Ω / (100 Ω + 100 Ω)). Der zweite Summand ist genau ein halbes Mal Ue.', 'R_Pt / (100 Ω + R_Pt) = 138,5 / 238,5 = 0,5807. Minus 0,5 gibt 0,0807. Mal 5 V ergibt 0,4036 V = 403,6 mV.'],
      start: () => S('temperatur', { sensor: 'pt100', circuit: 'bruecke', tMeas: 100 }, { value: null }), sol: () => S('temperatur', { sensor: 'pt100', circuit: 'bruecke', tMeas: 100 }, { value: BRIDGE_PT }),
      check: askCheck('temperatur', BRIDGE_PT, [[5000 * 138.5 / 238.5, 'Du hast nur die eine Brückenhälfte gerechnet. Die Brückenspannung ist die Differenz beider Teilerspannungen: Ua = U1 − U2.'], [5 * (138.5 - 100) / (138.5 + 100) * 1000, 'Das ist nicht die Brückenformel. Rechne beide Teilerspannungen einzeln aus und bilde dann die Differenz.'], [BRIDGE_PT / 1000, 'Das ist das Ergebnis in Volt. Gefragt sind Millivolt: mal 1000.']]) },
    { id: 'se5', lab: 'sen', cat: 'Temperatur', title: 'Leitungsfehler beim Pt100 in 2-Leiter-Technik', level: 2, rig: 'temperatur',
      text: 'Ein Pt100 ist in 2-Leiter-Technik an eine 20 m lange Leitung angeschlossen. Jede Ader hat einen Widerstand von 1,5 Ω. Der Pt100 ändert seinen Widerstand um etwa 0,385 Ω je Kelvin. Um wie viele Kelvin zeigt die Anzeige zu viel an? Berechne den Fehler in Kelvin.',
      ask: { label: 'Anzeigefehler durch die Leitung', unit: 'K' },
      hint: ['Bei der 2-Leiter-Technik fließt der Messstrom durch beide Adern. Alle Widerstände auf dem Weg gehören zum Messwiderstand.', 'Der Zusatzwiderstand ist Hin- plus Rückleitung. Der Fehler in Kelvin ist der Zusatzwiderstand geteilt durch die Empfindlichkeit 0,385 Ω/K.', 'ΔR = 2 · 1,5 Ω = 3 Ω. ΔT = 3 Ω / 0,385 Ω/K = 7,8 K.'],
      start: () => S('temperatur', { sensor: 'pt100', wires: 2 }, { value: null }), sol: () => S('temperatur', { sensor: 'pt100', wires: 2 }, { value: LEAD_ERR }),
      check: askCheck('temperatur', LEAD_ERR, [[1.5 / 0.385, 'Du hast nur eine Ader gerechnet. Der Strom fließt durch Hin- und Rückleitung, also zählen beide Adern.'], [3, 'Das ist der Zusatzwiderstand in Ohm. Teile ihn durch 0,385 Ω/K, dann hast du den Fehler in Kelvin.'], [3 * 0.385, 'Du hast mit der Empfindlichkeit multipliziert statt zu teilen. Ohm geteilt durch Ohm je Kelvin ergibt Kelvin.']]) },
    { id: 'se6', lab: 'sen', cat: 'Temperatur', title: 'Selbsterwärmung des NTC verkleinern', level: 3, rig: 'temperatur',
      text: 'Ein NTC (10 kΩ bei 25 °C) misst im Spannungsteiler eine Messstelle mit 100 °C. Bei 5 V Referenzspannung und einem Referenzwiderstand von nur 100 Ω fließt so viel Strom, dass sich der NTC selbst aufheizt und die Anzeige deutlich zu hoch liegt. Verändere den Aufbau so, dass der Messfehler bei 100 °C höchstens 0,5 K beträgt und die Anlage keine Selbsterwärmung meldet. Der Schalter „Selbsterwärmung berücksichtigen“ bleibt eingeschaltet.',
      hint: ['Der Messstrom heizt den NTC wie eine kleine Heizung: P = I² · R. Je kleiner der Strom, desto kleiner die Erwärmung.', 'Der Strom wird vom Referenzwiderstand und der Referenzspannung bestimmt. Wähle einen deutlich größeren Rref. Zu groß darf er auch nicht werden, sonst bleibt zu wenig Signal für den Wandler.', 'Zum Beispiel Rref = 4,7 kΩ oder 10 kΩ bei 5 V. Dann bleibt die Erwärmung unter 0,5 K und die Auflösung ist besser als 0,05 K je Digit.'],
      start: () => S('temperatur', BASE6), sol: () => S('temperatur', Object.assign({}, BASE6, { rRef: 4700 })),
      check: checkSe6 },
    { id: 'se7', lab: 'sen', cat: 'Temperatur', title: 'NTC linearisieren', level: 2, rig: 'temperatur',
      text: 'Ein NTC im Spannungsteiler soll im Bereich von 20 bis 90 °C messen. Die Anzeige verwendet eine Gerade zwischen 0 und 100 °C und liegt bei 20, 60 und 90 °C um 7 bis 20 K daneben. Stelle die Linearisierung so ein, dass der Fehler bei allen drei Temperaturen höchstens 2 K beträgt.',
      hint: ['Die Kennlinie eines NTC ist stark gekrümmt. Eine Gerade passt nur an wenigen Stellen.', 'Am Prüfstand gibt es drei Arten der Auswertung: Gerade, Tabelle und Rechnung. Überlege, welche der Kurve folgt.', 'Wähle „Rechnung (Steinhart-Hart / Kennlinie)“. Die Tabelle mit Stützstellen alle 20 K reicht mit etwa 1,5 K Restfehler ebenfalls aus.'],
      start: () => S('temperatur', BASE7), sol: () => S('temperatur', Object.assign({}, BASE7, { lin: 'sh' })),
      check: checkSe7 },
    /* ------------------------------------------------------------ Licht und Näherung */
    { id: 'se8', lab: 'sen', cat: 'Licht und Näherung', title: 'Schaltabstand bei Aluminium', level: 1, rig: 'licht',
      text: 'Ein induktiver Näherungsschalter hat den Nennschaltabstand Sn = 8 mm (gemessen an einer Stahlplatte). Du willst ein Bauteil aus Aluminium erkennen. Der Reduktionsfaktor für Aluminium beträgt 0,4. Berechne den tatsächlichen Schaltabstand in Millimetern.',
      ask: { label: 'Schaltabstand bei Aluminium', unit: 'mm' },
      hint: ['Der Nennschaltabstand gilt für Stahl. Andere Metalle dämpfen den Schwingkreis weniger und schalten daher früher, also bei kleinerem Abstand.', 'Schaltabstand = Nennschaltabstand · Reduktionsfaktor.', 'Schaltabstand = 8 mm · 0,4 = 3,2 mm. Aluminium schaltet also viel näher als Stahl.'],
      start: () => S('licht', { sensor: 'induktiv', material: 'alu', dist: 5 }, { value: null }), sol: () => S('licht', { sensor: 'induktiv', material: 'alu', dist: 5 }, { value: 3.2 }),
      check: askCheck('licht', 3.2, [[8, 'Du hast den Reduktionsfaktor vergessen. Aluminium schaltet erst deutlich näher als Stahl.'], [20, 'Du hast durch den Faktor geteilt. Der Faktor ist kleiner als 1 und verkleinert den Schaltabstand: Sr = Sn · Faktor.'], [0.32, 'Das Komma sitzt an der falschen Stelle: 8 · 0,4 = 3,2.']]) },
    { id: 'se9', lab: 'sen', cat: 'Licht und Näherung', title: 'Dämmerungsschalter ohne Flattern', level: 2, rig: 'licht',
      text: 'Ein LDR-Schalter meldet „hell“ ab etwa 10 lx. Genau bei 10 lx liegt aber die Schaltschwelle, und das Rauschen lässt den Ausgang flattern (mehr als 400 Schaltspiele pro Sekunde). Stelle den Prüfstand so ein, dass der Ausgang bei 10 lx ruhig bleibt, bei 20 lx einschaltet und bei 5 lx wieder ausschaltet. Du kannst Hysterese und Entprellzeit verändern.',
      hint: ['Flattern entsteht, wenn der Komparator bei jeder kleinen Störung die Schwelle überschreitet. Er braucht einen Abstand zwischen Ein- und Ausschaltpunkt.', 'Dieser Abstand heißt Hysterese. Alternativ schaltet der Ausgang erst, wenn der neue Zustand einige Millisekunden anliegt (Entprellzeit). Zu viel davon verhindert aber das Schalten bei 20 lx und 5 lx.', 'Zum Beispiel Hysterese 0,3 V (Ein- und Ausschaltpunkt je 0,15 V von der Schwelle). Auch eine Entprellzeit von 30 ms genügt.'],
      start: () => S('licht', BASE9), sol: () => S('licht', Object.assign({}, BASE9, { hyst: 0.3 })),
      check: checkSe9 },
    { id: 'se10', lab: 'sen', cat: 'Licht und Näherung', title: 'Gabellichtschranke bei Fremdlicht', level: 3, rig: 'licht',
      text: 'Eine Gabellichtschranke zählt Teile, die in der Gabel (30 mm) den Strahl unterbrechen. Durch das Hallenfenster fällt dauernd Fremdlicht von etwa 700 lx auf den Empfänger; es lässt sich nicht abschirmen. Mit 10 kΩ Arbeitswiderstand und 2,5 V Schwelle schaltet die Schranke falsch. Stelle Arbeitswiderstand und Schwelle so ein, dass ein Teil in der Gabel den Ausgang einschaltet, ein freier Strahl ihn ausschaltet und die Anlage weder Sättigung noch Fremdlicht meldet.',
      hint: ['Der Empfänger ist ein Fototransistor: Mehr Licht gibt mehr Strom und damit mehr Spannungsabfall am Arbeitswiderstand. Bei zu viel Licht läuft er in die Sättigung.', 'Wähle den Arbeitswiderstand kleiner, damit der Empfänger auch bei Fremdlicht und freiem Strahl nicht an den Anschlag läuft. Die Schwelle muss mit und ohne Fremdlicht richtig schalten: Sie liegt über dem Pegel des freien Strahls ohne Fremdlicht und unter dem Pegel mit Teil bei Fremdlicht.', 'Zum Beispiel Arbeitswiderstand 5 kΩ und Schwelle 3,25 V. Ohne Fremdlicht liegt der freie Strahl dann bei 3,0 V (aus) und mit Teil bei 5,0 V (ein). Mit 700 lx Fremdlicht sind es 1,7 V und 3,7 V.'],
      start: () => S('licht', BASE10), sol: () => S('licht', Object.assign({}, BASE10, { rLoad: 5000, thresh: 3.25 })),
      check: checkSe10 },
    /* ------------------------------------------------------------ Kraft und Druck */
    { id: 'se11', lab: 'sen', cat: 'Kraft und Druck', title: 'Brückenspannung der DMS-Viertelbrücke', level: 2, rig: 'kraft',
      text: 'Ein einzelner DMS mit dem k-Faktor 2 ist in einer Viertelbrücke geschaltet und wird mit 5 V gespeist. Der Federkörper dehnt den DMS um 800 µm/m. Berechne die Brückenspannung in Millivolt. Rechne mit der Näherungsformel für die Viertelbrücke.',
      ask: { label: 'Brückenspannung', unit: 'mV' },
      hint: ['Bei der Viertelbrücke ändert sich nur ein Widerstand der vier. Die Brücke gibt deshalb nur einen Teil der möglichen Spannung ab.', 'Ua ≈ Ue · k · ε / 4. Rechne ε = 800 µm/m = 800 · 10⁻⁶ ein.', 'Ua = 5 V · 2 · 800·10⁻⁶ / 4 = 2·10⁻³ V = 2 mV.'],
      start: () => S('kraft', { bridge: 'viertel', uBridge: 5 }, { value: null }), sol: () => S('kraft', { bridge: 'viertel', uBridge: 5 }, { value: 2 }),
      check: askCheck('kraft', 2, [[8, 'Du hast die Formel der Vollbrücke benutzt (ohne Teilung durch 4). Bei der Viertelbrücke trägt nur ein DMS bei.'], [4, 'Du hast die Formel der Halbbrücke benutzt (durch 2). Bei der Viertelbrücke wird durch 4 geteilt.'], [0.002, 'Das ist das Ergebnis in Volt. Gefragt sind Millivolt: mal 1000.'], [2000, 'Das ist das Ergebnis in Mikrovolt. Gefragt sind Millivolt: durch 1000.']]) },
    { id: 'se12', lab: 'sen', cat: 'Kraft und Druck', title: 'Verstärkung für den Kraftaufnehmer', level: 2, rig: 'kraft',
      text: 'Ein Biegebalken mit DMS-Vollbrücke misst Kräfte bis 100 N. Bei 5 V Speisespannung gibt die Brücke bei 100 N etwa 10 mV ab. Der Wandler arbeitet von 0 bis 3,3 V. Stelle die Verstärkung des Instrumentenverstärkers so ein, dass die Spannung am Wandler bei 100 N zwischen 2,6 V und 3,2 V liegt, ohne dass der Wandler an den Anschlag läuft.',
      hint: ['Die Verstärkung soll den kleinen Brückenwert auf die Größe des Wandlerbereichs heben. Der Endwert (100 N) soll den Wandler fast, aber nicht ganz ausfüllen.', 'Die Verstärkung ist Zielspannung geteilt durch Brückenspannung. Ziehe vorher den festen Offset von etwa 0,17 V ab, der am Ausgang immer dazukommt.', 'Für 2,9 V am Wandler: (2,9 V − 0,17 V) / 10,06 mV ≈ 271. Alles zwischen etwa 250 und 300 funktioniert. Bei 10 V Speisung wäre die Verstärkung nur halb so groß, der DMS würde aber warm.'],
      start: () => S('kraft', BASE12), sol: () => S('kraft', Object.assign({}, BASE12, { gain: 270 })),
      check: checkSe12 },
    { id: 'se13', lab: 'sen', cat: 'Kraft und Druck', title: 'Kraftaufnehmer kalibrieren', level: 3, rig: 'kraft',
      text: 'Ein Kraftaufnehmer mit Viertelbrücke und 200-facher Verstärkung zeigt im lastfreien Zustand etwa 4 N und bei 100 N rund 104 N. Baue im Ablaufprogramm die Kalibrierung: Bei 0 N drückst du den Taster „Nullpunkt abgleichen“, später bei genau 100 N den Taster „Endwert abgleichen“. Lass die Taster danach wieder los. Danach muss die Anzeige bei 0, 50 und 100 N höchstens 2,5 N danebenliegen. Die Startvorlage belastet den Aufnehmer schon.',
      hint: ['Eine Kalibrierung legt zwei Punkte fest: den Nullpunkt ohne Last und den Endwert mit der Referenzlast. Dazu muss die Last zum jeweiligen Zeitpunkt wirklich anliegen.', 'Im Ablaufprogramm: Kraft 0 N, dann „Nullpunkt abgleichen“ an und kurz danach wieder aus. Nach dem Aufbringen der 100 N und einigen Sekunden Wartezeit „Endwert abgleichen“ an und wieder aus.', 'Zum Beispiel: 0,5 s calZero an, 0,7 s calZero aus, 1,5 s Kraft 100 N, 4,5 s calSpan an, 4,7 s calSpan aus. Das Ende des Ablaufs bei 6 s.'],
      start: () => S('kraft', BASE13, { seq: [{ t: 0, set: { force: 0 } }, { t: 1500, set: { force: 100 } }], dur: 6000 }),
      sol: () => S('kraft', BASE13, { seq: [{ t: 0, set: { force: 0 } }, { t: 500, set: { calZero: true } }, { t: 700, set: { calZero: false } }, { t: 1500, set: { force: 100 } }, { t: 4500, set: { calSpan: true } }, { t: 4700, set: { calSpan: false } }], dur: 6000 }),
      check: checkSe13 },
    /* ------------------------------------------------------------ Beschleunigung */
    { id: 'se14', lab: 'sen', cat: 'Beschleunigung', title: 'Nickwinkel aus den Beschleunigungswerten', level: 2, rig: 'beschleunigung',
      text: 'Ein MEMS-Sensor liegt ruhig in einer Maschine und liefert die Beschleunigungen ax = 0,40 g, ay = 0,30 g und az = 0,86 g. Berechne den Nickwinkel θ (Neigung um die y-Achse) in Grad. Rechne mit θ = atan2(ax, √(ay² + az²)).',
      ask: { label: 'Nickwinkel θ', unit: '°' },
      hint: ['Im Stillstand misst der Sensor nur die Erdbeschleunigung. Ihre Anteile in den drei Achsen verraten die Lage.', 'Der Nickwinkel ist der Winkel, dessen Tangens ax durch die Länge von ay und az zusammen ist: θ = atan(ax / √(ay² + az²)).', '√(0,30² + 0,86²) = 0,9108 g. θ = atan(0,40 / 0,9108) = atan(0,4392) = 23,7°.'],
      start: () => S('beschleunigung', { tiltX: 24, tiltY: 19 }, { value: null }), sol: () => S('beschleunigung', { tiltX: 24, tiltY: 19 }, { value: PITCH }),
      check: askCheck('beschleunigung', PITCH, [[Math.atan2(0.40, 0.86) * 180 / Math.PI, 'Du hast ay nicht berücksichtigt. Unter dem Bruch steht die Länge aus ay und az: √(ay² + az²).'], [Math.atan2(0.30, 0.86) * 180 / Math.PI, 'Das ist der Rollwinkel (aus ay und az). Der Nickwinkel gehört zur Achse ax.'], [Math.tan(PITCH * Math.PI / 180), 'Das ist der Tangens. Gefragt ist der Winkel: Bilde den Arkustangens (atan).']]) },
    { id: 'se15', lab: 'sen', cat: 'Beschleunigung', title: 'Messbereich und Datenrate für einen Stoß', level: 2, rig: 'beschleunigung',
      text: 'Ein Transportschaden soll aufgezeichnet werden: Beim Aufprall wirkt für wenige Millisekunden ein Stoß von etwa 8 g. Der Sensor steht auf ±2 g, 100 Hz Datenrate und 20 Hz Tiefpassfilter, damit sieht er fast nichts. Stelle Messbereich, Datenrate und Filter so ein, dass der Stoß nicht abgeschnitten wird und die gemessene Spitze mindestens 8,0 g beträgt. Der Ablauf löst den Stoß selbst aus.',
      hint: ['Der Messbereich muss größer sein als der größte Wert, sonst wird das Signal abgeschnitten (Clipping). Denke an die 1 g Erdbeschleunigung, die dazukommt.', 'Ein Stoß ist kurz. Der Sensor muss ihn oft genug abfragen (hohe Datenrate), und der Tiefpassfilter darf die Spitze nicht abflachen.', 'Messbereich ±16 g, Datenrate 400 Hz oder 800 Hz, Filter aus. Dann misst du eine Spitze von rund 8,4 bis 8,8 g.'],
      start: () => S('beschleunigung', Object.assign({}, BASE15, { rate: 100, filter: 20, range: 2 }), { seq: [{ t: 500, set: { hit: true } }, { t: 700, set: { hit: false } }], dur: 2500 }),
      sol: () => S('beschleunigung', Object.assign({}, BASE15, { range: 16, rate: 800, filter: 0 }), { seq: [{ t: 500, set: { hit: true } }, { t: 700, set: { hit: false } }], dur: 2500 }),
      check: checkSe15 },
    { id: 'se16', lab: 'sen', cat: 'Beschleunigung', title: 'I2C-Registerwerte der x-Achse lesen', level: 3, rig: 'beschleunigung',
      text: 'Ein Controller liest von einem ADXL345-ähnlichen Sensor (Bereich ±2 g, 10 Bit, Auflösung 3,9 mg je Digit) die Register der x-Achse: DATAX0 (0x32) = 0xE0 und DATAX1 (0x33) = 0xFF. Die beiden Bytes bilden einen 16-Bit-Wert im Zweierkomplement (niederwertiges Byte zuerst). Berechne die Beschleunigung in x-Richtung in g.',
      ask: { label: 'Beschleunigung in x-Richtung', unit: 'g' },
      hint: ['Der Sensor sendet zuerst das niederwertige Byte (Little-Endian). Beide Bytes zusammen ergeben den Zählwert.', 'Zählwert = DATAX1 · 256 + DATAX0. Ist das oberste Bit gesetzt (Wert ab 32768), ist die Zahl negativ: Zählwert − 65536. Danach mal 3,9 mg.', '0xFFE0 = 65504. 65504 − 65536 = −32. −32 · 3,9 mg = −0,125 g (mit 1/256 g genau −0,125 g).'],
      start: () => S('beschleunigung', { range: 2, res: 10 }, { value: null }), sol: () => S('beschleunigung', { range: 2, res: 10 }, { value: -32 / 256 }),
      check: askCheck('beschleunigung', -0.125, [[0xE0 / 256, 'Du hast das Vorzeichen übersehen und nur das niederwertige Byte benutzt. Beide Bytes gehören zusammen: 0xFFE0 ist im Zweierkomplement negativ.'], [65504 / 256, 'Du hast den Wert ohne Vorzeichen gelesen (65504). Bei gesetztem oberstem Bit ziehst du 65536 ab.'], [0.125, 'Das Vorzeichen fehlt. Die Zahl 0xFFE0 ist im Zweierkomplement negativ, die Beschleunigung zeigt also entgegen der x-Achse.']]) },
    /* ------------------------------------------------------------ Normsignale */
    { id: 'se17', lab: 'sen', cat: 'Normsignale', title: 'Druck aus dem Schleifenstrom berechnen', level: 1, rig: 'normsignal',
      text: 'Ein Drucktransmitter (Messbereich 0 bis 16 bar) liefert ein 4…20-mA-Signal. Die SPS misst an der Bürde einen Schleifenstrom von 12,8 mA. Der Messumformer rechnet seinen Messbereich linear auf 4 bis 20 mA um. Berechne den zugehörigen Druck in bar.',
      ask: { label: 'Druck', unit: 'bar' },
      hint: ['Bei 4…20 mA bedeuten 4 mA den Anfang des Messbereichs (0 bar) und 20 mA das Ende (16 bar). Der Nullpunkt liegt nicht bei 0 mA.', 'Zieh zuerst 4 mA ab: Nutzstrom = I − 4 mA. Der nutzbare Bereich ist 16 mA breit. Druck = Nutzstrom / 16 mA · 16 bar.', '(12,8 mA − 4 mA) / 16 mA = 0,55. 0,55 · 16 bar = 8,8 bar.'],
      start: () => S('normsignal', { signal: '420', lo: 0, hi: 16 }, { value: null }), sol: () => S('normsignal', { signal: '420', lo: 0, hi: 16 }, { value: 8.8 }),
      check: askCheck('normsignal', 8.8, [[12.8 / 20 * 16, 'Du hast die 4 mA am Anfang nicht abgezogen. Bei 4…20 mA liegt der Nullpunkt bei 4 mA, nicht bei 0 mA.'], [12.8 / 16 * 16, 'Du hast den Strom ohne Umrechnung als bar gelesen. Rechne den Strom erst auf den Bereichsanteil um.'], [(12.8 - 4) / 20 * 16, 'Du hast durch 20 mA geteilt. Die Spanne beträgt 20 mA − 4 mA = 16 mA.']]) },
    { id: 'se18', lab: 'sen', cat: 'Normsignale', title: 'Bürde für den 4…20-mA-Eingang wählen', level: 2, rig: 'normsignal',
      text: 'Ein Zweileiter-Messumformer (Messbereich 0 bis 10 bar, Versorgung 24 V) braucht an seinen Klemmen mindestens 12 V. Die Leitung hat 100 Ω. Der Wandler am Ende der Leitung misst 0 bis 5 V. Die Startvorlage hat 750 Ω Bürde: Der Endwert wird abgeschnitten und der Messumformer geht in die Sättigung. Wähle die Bürde so, dass bei 10 bar weder der Messumformer noch der Wandler übersteuert werden und der Wandler bei 20 mA mindestens zur Hälfte ausgesteuert ist.',
      hint: ['Die Bürde wandelt den Strom in eine Spannung um (U = I · R). Diese Spannung muss in den Wandlerbereich passen. Außerdem muss der Messumformer genug Spannung für sich behalten.', 'Zwei Grenzen: Der Wandler verträgt höchstens 5 V bei 20 mA, also R ≤ 250 Ω. Der Messumformer braucht 12 V: R ≤ (24 V − 12 V) / 20 mA − 100 Ω = 500 Ω. Die kleinere Grenze gilt. Für halbe Aussteuerung gilt R ≥ 2,5 V / 20 mA = 125 Ω.', 'Wähle zum Beispiel die klassische Bürde von 250 Ω. Bei 20 mA fallen dann 5 V ab, bei 4 mA genau 1 V.'],
      start: () => S('normsignal', BASE18), sol: () => S('normsignal', Object.assign({}, BASE18, { rBurden: 250 })),
      check: checkSe18 },
    { id: 'se19', lab: 'sen', cat: 'Normsignale', title: 'Drahtbruch sicher erkennen', level: 2, rig: 'normsignal',
      text: 'Ein Drucksensor (0 bis 10 bar) meldet 5 bar an die Anlage. Nach 1,5 s reißt die Sensorleitung. Mit dem Normsignal 0…10 V zeigt die Anlage danach einfach 0 bar an und niemand merkt den Fehler. Stelle den Prüfstand so ein, dass die Messung vor dem Bruch stimmt und die Anlage den Drahtbruch erkennt (Anzeige „Leitung unterbrochen“).',
      hint: ['Bei einem Drahtbruch fließt kein Strom mehr und die Spannung am Eingang fällt auf null. Entscheidend ist, ob null ein gültiger Messwert sein kann.', 'Ein Signal ist nur dann sicher, wenn der Nullpunkt nicht bei 0 liegt (Live Zero). Dann steht 0 mA oder 0 V eindeutig für einen Fehler.', 'Wähle 4…20 mA (Bürde 250 Ω) oder 1…5 V. Bei 4…20 mA unterschreitet der Strom 3,6 mA und die Anlage erkennt den Bruch.'],
      start: () => S('normsignal', BASE19), sol: () => S('normsignal', Object.assign({}, BASE19, { signal: '420' })),
      check: checkSe19 },
    /* ------------------------------------------------------------ ADU */
    { id: 'se20', lab: 'sen', cat: 'ADU', title: 'Stufenhöhe eines 12-Bit-Wandlers', level: 1, rig: 'adu',
      text: 'Ein 12-Bit-ADU hat die Referenzspannung 5 V und wandelt Spannungen von 0 bis 5 V in Zählwerte von 0 bis 4095. Berechne die Spannung einer Stufe (1 LSB) in Millivolt.',
      ask: { label: 'Spannung je LSB', unit: 'mV' },
      hint: ['Ein ADU teilt den Bereich 0 bis Uref in gleich große Stufen. Die Anzahl der Stufen hängt von der Bitzahl ab.', 'Mit n Bit gibt es 2ⁿ Stufen. LSB = Uref / 2ⁿ.', '2¹² = 4096. LSB = 5 V / 4096 = 1,2207 mV.'],
      start: () => S('adu', { bits: 12, vref: 5 }, { value: null }), sol: () => S('adu', { bits: 12, vref: 5 }, { value: LSB12 }),
      check: askCheck('adu', LSB12, [[5000 / 12, 'Du hast durch die Bitzahl geteilt. Die Anzahl der Stufen ist 2 hoch Bitzahl: 2¹² = 4096.'], [5 / 1024 * 1000, 'Das wäre der Wert für 10 Bit. Hier sind es 12 Bit, also 4096 Stufen.'], [LSB12 / 1000, 'Das ist das Ergebnis in Volt. Gefragt sind Millivolt: mal 1000.']]) },
    { id: 'se21', lab: 'sen', cat: 'ADU', title: 'Abtastrate für ein 900-Hz-Signal', level: 3, rig: 'adu',
      text: 'Ein Messsignal hat die Frequenz 900 Hz (Sinus, 12 Bit). Bei der Abtastrate 1000 Hz erscheint es fälschlich als 100-Hz-Schwingung (Aliasing). Wähle die Abtastrate so, dass kein Aliasing auftritt, der Prüfstand das Signal mit 900 Hz erkennt und die Abtastrate mindestens das 2,5-fache der Signalfrequenz beträgt. Der Mikrocontroller schafft höchstens 5000 Messungen je Sekunde.',
      hint: ['Wenn ein ADU zu langsam abtastet, spiegelt sich das Signal in einen niedrigeren Frequenzbereich. Die Abtastrate muss deutlich über der doppelten Signalfrequenz liegen.', 'Das Abtasttheorem verlangt fs > 2 · f_max. Praktisch rechnest du mit dem 2,5- bis 5-fachen. Das Signal selbst mit einem Filter zu verändern, hilft nicht, du willst ja die 900 Hz messen.', 'Zum Beispiel fs = 2500 Hz oder 4000 Hz. Dann ist fs = 2,8 beziehungsweise 4,4 mal so groß wie die Signalfrequenz.'],
      start: () => S('adu', BASE21), sol: () => S('adu', Object.assign({}, BASE21, { fs: 2500 })),
      check: checkSe21 },
    /* ------------------------------------------------------------ Digitale Sensoren */
    { id: 'se22', lab: 'sen', cat: 'Digitale Sensoren', title: 'Pull-up-Widerstand für den I2C-Bus wählen', level: 2, rig: 'digital',
      text: 'Ein SHT-Sensor hängt am I2C-Bus (Standardmodus, 100 kHz, 3,3 V) an einem 2 m langen Kabel; die Buskapazität beträgt dabei etwa 210 pF. Mit 47 kΩ Pull-up sind die Flanken viel zu langsam, alle Übertragungen schlagen fehl. Die Anstiegszeit darf höchstens 1000 ns betragen. Wähle den Pull-up so, dass alle Übertragungen fehlerfrei laufen und der Widerstand nicht so klein ist, dass der Sensor ihn nicht mehr nach Masse ziehen kann.',
      hint: ['Die Leitung wird über den Pull-up und die Buskapazität aufgeladen. Das ist ein RC-Glied: großer Widerstand gibt langsame Flanken.', 'Aus t_r = 0,8473 · R · C folgt R ≤ t_r / (0,8473 · C). Nach unten begrenzt der Strom, den der Sensor beim Low-Pegel aufnehmen muss: R ≥ (3,3 V − 0,4 V) / 3 mA, etwa 1 kΩ.', 'R ≤ 1000 ns / (0,8473 · 210 pF) = 5,6 kΩ. Aus der Reihe der Werte passen 2,2 kΩ und 4,7 kΩ. 1 kΩ ist zu klein.'],
      start: () => S('digital', BASE22), sol: () => S('digital', Object.assign({}, BASE22, { pullup: 4700 })),
      check: checkSe22 },
    { id: 'se23', lab: 'sen', cat: 'Digitale Sensoren', title: 'Adresskonflikt am I2C-Bus lösen', level: 2, rig: 'digital',
      text: 'An einem I2C-Bus hängen zwei gleiche SHT-Sensoren, beide haben die Adresse 0x44. Der Controller bekommt Mischdaten und Prüfsummenfehler. Der Sensor „1“ hat einen Adress-Pin (Low gibt 0x44, High gibt 0x45); der zweite Sensor ist fest auf 0x44 verdrahtet. Behebe den Konflikt, ohne einen Sensor abzustecken. Der Controller soll danach den Sensor „1“ lesen (45 % relative Feuchte).',
      hint: ['Auf einem I2C-Bus darf jede Adresse nur einmal vorkommen. Antworten zwei Geräte gleichzeitig, mischen sich ihre Bits.', 'Ein Sensor muss auf eine andere Adresse umgestellt werden. Dafür gibt es den Adress-Pin. Danach muss der Controller auch die neue Adresse benutzen.', 'Stelle „ADDR-Pin des SHT“ auf High (Adresse 0x45) und „Adresse im Controller“ auf 0x45.'],
      start: () => S('digital', BASE23), sol: () => S('digital', Object.assign({}, BASE23, { addrPin: 'high', addr: 69 })),
      check: checkSe23 },
    /* ------------------------------------------------------------ Fehlersuche */
    { id: 'se24', lab: 'sen', cat: 'Fehlersuche', title: 'Pt100 zeigt 10 Kelvin zu viel an', level: 2, rig: 'temperatur',
      text: 'Ein Pt100 misst eine Messstelle mit 60 °C, die Anlage zeigt aber etwa 71 °C an. Die Leitung ist 40 m lang (2 Ω je Ader, fest verlegt) und der Pt100 in 2-Leiter-Technik in der Brücke angeschlossen. Behebe den Fehler am Prüfstand so, dass die Anzeige höchstens 0,5 K danebenliegt und der Leitungswiderstand ausgeglichen wird. Sensor und Kabel bleiben unverändert.',
      hint: ['Die Anzeige liegt immer zu hoch, nicht nur bei einer Temperatur. Das sieht nach einem festen Zusatzwiderstand aus.', 'Der Zusatzwiderstand ist die Leitung: 2 Adern · 2 Ω = 4 Ω, das sind rund 10 K. Die Anschlusstechnik bestimmt, ob er in die Messung eingeht.', 'Stelle „Anschlusstechnik“ auf 3-Leiter (in der Brücke) oder wähle „Konstantstromquelle + Verstärker“ mit 4-Leiter-Technik und passendem Rref (1 kΩ) und Verstärkung (10).'],
      start: () => S('temperatur', BASE24), sol: () => S('temperatur', Object.assign({}, BASE24, { wires: 3 })),
      check: checkSe24 },
    { id: 'se25', lab: 'sen', cat: 'Fehlersuche', title: 'Waage driftet bei Wärme', level: 2, rig: 'kraft',
      text: 'Eine Wägezelle mit einem einzelnen DMS (Viertelbrücke, 200-fache Verstärkung) arbeitet in einer warmen Halle bei 60 °C am DMS. Ohne Last zeigt die Waage etwa 25 N, bei 100 N rund 124 N. Die Anlage meldet Drift und Nullpunktfehler. Ändere die Messschaltung so, dass die Anzeige bei 0 N und bei 100 N höchstens 2 N danebenliegt und keine Drift gemeldet wird. Die Temperatur bleibt bei 60 °C.',
      hint: ['Die Wärme dehnt den Federkörper und ändert den Widerstand des DMS. Das wirkt wie eine Kraft, die gar nicht da ist.', 'In einer Voll- oder Halbbrücke sitzen mehrere DMS, deren Temperaturgang sich in der Brücke gegenseitig aufhebt. Bei der Viertelbrücke fehlt dieser Ausgleich.', 'Wähle die Vollbrücke. Mit der Verstärkung 100 liegt der Fehler bei etwa 1 N. Die Halbbrücke reicht nicht ganz aus.'],
      start: () => S('kraft', BASE25), sol: () => S('kraft', Object.assign({}, BASE25, { bridge: 'voll', gain: 100 })),
      check: checkSe25 },
    { id: 'se26', lab: 'sen', cat: 'Fehlersuche', title: 'Näherungsschalter erkennt Aluminium nicht', level: 2, rig: 'licht',
      text: 'Ein induktiver Näherungsschalter (Sn = 8 mm) funktioniert an Stahlteilen einwandfrei. Jetzt soll er ein Aluminiumteil erkennen, das sich bis auf 5 mm nähert; der Einbau lässt sich nicht verändern. Der Ausgang schaltet aber nicht. Wähle einen Sensor, der das Aluminiumteil bei 5 mm sicher erkennt und bei 20 mm wieder loslässt.',
      hint: ['Der Sensor funktioniert, nur das Material ist ein anderes. Schaue, was sich beim Wechsel von Stahl auf Aluminium ändert.', 'Aluminium hat den Reduktionsfaktor 0,4: Der Schaltabstand sinkt von 8 mm auf 3,2 mm. Bei 5 mm ist das Teil zu weit weg. Der Abstand ist festgelegt, also muss ein anderer Sensor her.', 'Wähle den kapazitiven Näherungsschalter. Er erkennt Metall mit Faktor 1 (Sn = 10 mm). Der Ultraschallsensor löst bei 20 mm nicht mehr aus, weil er erst bei 150 mm schaltet.'],
      start: () => S('licht', BASE26), sol: () => S('licht', Object.assign({}, BASE26, { sensor: 'kapazitiv' })),
      check: checkSe26 },
    /* ------------------------------------------------------------ Prüfungsstil */
    { id: 'se27', lab: 'sen', cat: 'Prüfungsstil', title: 'Datenblatt: Genauigkeit des Drucktransmitters', level: 2, rig: 'normsignal',
      text: 'Im Datenblatt eines Drucktransmitters steht: Messbereich 0 bis 16 bar, Ausgang 4…20 mA, Genauigkeit ±0,5 % vom Messbereichsendwert, Versorgung 12 bis 30 V. Der Transmitter misst gerade 8 bar. Berechne den größten möglichen Messfehler in bar.',
      ask: { label: 'Größter Messfehler', unit: 'bar' },
      hint: ['Lies im Datenblatt genau, worauf sich die Prozentangabe bezieht: auf den Messwert oder auf den Endwert des Messbereichs?', 'Die Angabe „vom Endwert“ gilt für den ganzen Bereich gleich, auch bei 8 bar. Fehler = 0,5 % · Endwert.', '0,5 % von 16 bar = 0,005 · 16 bar = 0,08 bar. Auch bei 8 bar bleibt der mögliche Fehler 0,08 bar, bezogen auf den Messwert sind das sogar 1 %.'],
      start: () => S('normsignal', { signal: '420', lo: 0, hi: 16, value: 8 }, { value: null }), sol: () => S('normsignal', { signal: '420', lo: 0, hi: 16, value: 8 }, { value: 0.08 }),
      check: askCheck('normsignal', 0.08, [[0.04, 'Du hast die Prozente auf den Messwert (8 bar) bezogen. Im Datenblatt steht „vom Messbereichsendwert“, das sind 16 bar.'], [0.5, 'Das ist die Prozentzahl, nicht der Fehler in bar. Rechne 0,5 % von 16 bar aus.'], [8, 'Das ist der Messwert, nicht der Fehler. Der Fehler sind 0,5 % von 16 bar.']]) },
    { id: 'se28', lab: 'sen', cat: 'Prüfungsstil', title: 'Messkette für Pt100 auslegen', level: 3, rig: 'temperatur',
      text: 'Lege eine Pt100-Messkette für 0 bis 100 °C aus. Vorgaben: Das Kabel hat 2 Ω je Ader; der Fehler soll bei 0, 50 und 100 °C unter 1,5 K bleiben; der Messstrom darf den Pt100 um weniger als 1 K erwärmen; bei 100 °C soll der Wandler zu 70 bis 97 % ausgesteuert sein; die Auflösung soll besser als 0,15 K je Digit sein. Wähle Schaltung, Rref, Verstärkung, Wandlerauflösung und Anschlusstechnik am Prüfstand. Die Startvorlage ist ein unverstärkter Spannungsteiler mit 10 Bit und 2-Leiter-Technik.',
      hint: ['Gehe die Vorgaben der Reihe nach durch: Leitungsfehler (Anschlusstechnik), Selbsterwärmung (Strom), Aussteuerung (Verstärkung) und Auflösung (Verstärkung und Bit).', 'Ein Pt100 verträgt etwa 1 mA. Die Konstantstromquelle mit 4-Leiter-Technik schaltet den Leitungswiderstand aus und hält den Strom klein. Dann stellst du die Verstärkung so ein, dass 138,5 Ω · 1 mA · G etwa 90 % von 3,3 V ergeben.', 'Zum Beispiel Konstantstromquelle, Rref = 1 kΩ (1 mA), 4-Leiter, 12 Bit und Verstärkung 22. Bei 100 °C ergeben sich etwa 3,05 V (92 %) und 0,1 K je Digit.'],
      start: () => S('temperatur', BASE28), sol: () => S('temperatur', Object.assign({}, BASE28, { circuit: 'strom', rRef: 1000, gain: 22, adcBits: 12, wires: 4 })),
      check: checkSe28 }
  ];
  const tasks = ttl;

  /* ====================================================================== Beispiele */
  const E = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const examples = [
    /* Temperatur */
    E('temp-ntc', 'NTC im Spannungsteiler: Kennlinie abfahren', 'Temperatur', 'temperatur',
      'Die Messstelle wird langsam von 0 auf 100 °C erwärmt. Der Widerstand des NTC fällt dabei stark und nicht linear, die Rechnung (Steinhart-Hart) macht daraus trotzdem eine saubere Temperaturanzeige. Während der Rampe hinkt die Anzeige wegen der Wärmeträgheit der Sonde etwas hinterher.',
      { sensor: 'ntc', circuit: 'teiler', rRef: 10000, adcBits: 12, vref: 3.3, lin: 'sh', selfHeat: true, lead: 0, wires: 2, tMeas: 0 },
      { dur: 50000, seq: [{ t: 0, set: { tMeas: 0 } }, { t: 1000, ramp: { key: 'tMeas', to: 100, durMs: 30000 } }] }),
    E('temp-sprung', 'Temperatursprung: Wärmeträgheit der Sonde', 'Temperatur', 'temperatur',
      'Die Messstelle springt von 25 auf 125 °C. Die Pt100-Sonde braucht ihre Zeit: Nach einer Zeitkonstante von 8 Sekunden zeigt sie erst gut 60 % des Sprungs, nach dem Fünffachen ist sie fast am Ziel. Das ist Wärmeträgheit, nicht Messfehler.',
      { sensor: 'pt100', circuit: 'strom', rRef: 1000, gain: 10, adcBits: 12, vref: 3.3, lin: 'sh', selfHeat: true, lead: 0, wires: 4, tMeas: 25 },
      { dur: 45000, seq: [{ t: 500, set: { tMeas: 125 } }] }),
    E('temp-leiter', '2-, 3- und 4-Leiter-Vergleich beim Pt100', 'Temperatur', 'temperatur',
      'Ein Pt100 hängt an einer Leitung mit 2 Ω je Ader und misst Raumtemperatur. Bei der 2-Leiter-Schaltung addiert sich der Leitungswiderstand und die Anzeige liegt um rund 10 K zu hoch. Die 3-Leiter-Schaltung in der Brücke und die 4-Leiter-Schaltung mit Konstantstrom gleichen den Fehler aus.',
      { sensor: 'pt100', circuit: 'bruecke', rRef: 100, gain: 5, adcBits: 12, vref: 3.3, lin: 'sh', selfHeat: true, lead: 2, wires: 2, tMeas: 25 },
      { dur: 12000, seq: [{ t: 4000, set: { wires: 3 } }, { t: 8000, set: { circuit: 'strom', rRef: 1000, gain: 10, wires: 4 } }] }),
    E('temp-selbst', 'Fehler: Selbsterwärmung des NTC', 'Temperatur', 'temperatur',
      'Mit nur 100 Ω Referenzwiderstand und 5 V fließt ein großer Messstrom, der den NTC selbst um knapp 1 K aufheizt. Die Anzeige liegt dadurch zu hoch. Nach 6 Sekunden wird der Referenzwiderstand auf 10 kΩ erhöht, und die Erwärmung verschwindet.',
      { sensor: 'ntc', circuit: 'teiler', rRef: 100, adcBits: 12, vref: 5, lin: 'sh', selfHeat: true, lead: 0, wires: 2, tMeas: 25 },
      { dur: 12000, seq: [{ t: 6000, set: { rRef: 10000 } }] }),
    E('temp-tck', 'Thermoelement Typ K und Vergleichsstelle', 'Temperatur', 'temperatur',
      'Ein Thermoelement liefert nur die Spannung zwischen Mess- und Vergleichsstelle, nicht die absolute Temperatur. Solange die Vergleichsstellen-Kompensation an ist, stimmt die Anzeige bei 150 °C. Nach 12 Sekunden wird sie abgeschaltet, und die Anzeige liegt um die Temperatur der Klemmstelle zu niedrig.',
      { sensor: 'tck', circuit: 'teiler', gain: 250, adcBits: 12, vref: 3.3, lin: 'sh', cjc: true, tMeas: 150 },
      { dur: 20000, seq: [{ t: 12000, set: { cjc: false } }] }),
    /* Licht und Näherung */
    E('licht-ldr', 'LDR: von dunkel bis hell', 'Licht und Näherung', 'licht',
      'Die Beleuchtung steigt in Zehnerstufen von 1 auf 1000 lx. Der Widerstand des LDR fällt dabei nicht linear, sondern etwa nach einer Potenzfunktion, die Ausgangsspannung steigt entsprechend. Der Komparator schaltet genau einmal, wenn die Spannung die Schwelle überschreitet.',
      { sensor: 'ldr', lux: 1, rLoad: 10000, thresh: 2.5, hyst: 0.2, ambient: 0, fdelay: 0 },
      { dur: 16000, seq: [{ t: 0, set: { lux: 1 } }, { t: 4000, set: { lux: 10 } }, { t: 8000, set: { lux: 100 } }, { t: 12000, set: { lux: 1000 } }] }),
    E('licht-hyst', 'Hysterese-Schleife eines Lichtschalters', 'Licht und Näherung', 'licht',
      'Die Beleuchtung steigt langsam von 1 auf 40 lx und sinkt dann wieder. Mit 1 V Hysterese schaltet der Ausgang beim Anstieg erst bei etwa 18 lx ein, beim Absinken aber schon bei etwa 6 lx wieder aus. Dieser Abstand zwischen Ein- und Ausschaltpunkt ist die Hysterese-Schleife; sie verhindert Flattern.',
      { sensor: 'ldr', lux: 1, rLoad: 10000, thresh: 2.5, hyst: 1, ambient: 0, fdelay: 0 },
      { dur: 41000, seq: [{ t: 0, ramp: { key: 'lux', to: 40, durMs: 20000 } }, { t: 20500, ramp: { key: 'lux', to: 1, durMs: 20000 } }] }),
    E('licht-reduktion', 'Induktiver Schalter: Stahl, Alu und Kupfer', 'Licht und Näherung', 'licht',
      'Das Zielobjekt nähert sich dem induktiven Näherungsschalter (Sn = 8 mm) nacheinander als Stahl-, Aluminium- und Kupferteil. Stahl schaltet bei 8 mm, Aluminium erst bei 3,2 mm und Kupfer bei 2,4 mm. Der Schaltabstand ist der Nennwert mal dem Reduktionsfaktor des Materials.',
      { sensor: 'induktiv', material: 'stahl', dist: 15, rLoad: 10000, ambient: 0 },
      { dur: 12000, seq: [{ t: 0, set: { dist: 15, material: 'stahl' } }, { t: 0, ramp: { key: 'dist', to: 0, durMs: 3000 } }, { t: 4000, set: { dist: 15, material: 'alu' } }, { t: 4000, ramp: { key: 'dist', to: 0, durMs: 3000 } }, { t: 8000, set: { dist: 15, material: 'kupfer' } }, { t: 8000, ramp: { key: 'dist', to: 0, durMs: 3000 } }] }),
    E('licht-fremd', 'Fehler: Fremdlicht an der Gabellichtschranke', 'Licht und Näherung', 'licht',
      'Ein Teil fährt immer wieder durch die Gabel, aber 700 lx Fremdlicht und 10 kΩ Arbeitswiderstand bringen den Empfänger in die Sättigung: Der Ausgang bleibt immer aus. Nach 6 Sekunden wird der Arbeitswiderstand auf 5 kΩ gesenkt und die Schwelle auf 3,25 V angehoben, dann schaltet die Schranke richtig.',
      { sensor: 'gabel', dist: 0, rLoad: 10000, thresh: 2.5, hyst: 0.2, ambient: 700, fdelay: 0 },
      { dur: 12000, seq: [{ t: 1000, set: { dist: 30 } }, { t: 2500, set: { dist: 0 } }, { t: 4000, set: { dist: 30 } }, { t: 5500, set: { dist: 0 } }, { t: 6000, set: { rLoad: 5000, thresh: 3.25 } }, { t: 7000, set: { dist: 30 } }, { t: 8500, set: { dist: 0 } }, { t: 10000, set: { dist: 30 } }, { t: 11500, set: { dist: 0 } }] }),
    /* Kraft und Druck */
    E('kraft-voll', 'Vollbrücke: Kraft messen', 'Kraft und Druck', 'kraft',
      'Ein Biegebalken mit DMS-Vollbrücke wird in Stufen bis 100 N belastet. Die Brücke gibt bei Nennlast etwa 10 mV ab, der Instrumentenverstärker hebt das auf gut 1 V. Die Anzeige folgt der Kraft bis auf einen Restfehler von etwa 1 N, den Nullpunkt-Offset und Hysterese verursachen.',
      { mode: 'kraft', bridge: 'voll', uBridge: 5, gain: 100, offset: 0, filter: 20, adcBits: 12, temp: 25, cal: true, force: 0 },
      { dur: 9000, seq: [{ t: 0, set: { force: 0 } }, { t: 1500, set: { force: 25 } }, { t: 3000, set: { force: 50 } }, { t: 4500, set: { force: 75 } }, { t: 6000, set: { force: 100 } }] }),
    E('kraft-schleife', 'Hysterese-Schleife des Federkörpers', 'Kraft und Druck', 'kraft',
      'Der Balken wird in zehn Sekunden von 0 auf 100 N belastet und danach wieder entlastet. Beim Entlasten zeigt die Anzeige bei gleicher Kraft etwas mehr als beim Belasten, dazu bleibt ein kleiner Rest-Nullpunkt. Dieser Unterschied zwischen Hin- und Rückweg ist die Hysterese.',
      { mode: 'kraft', bridge: 'voll', uBridge: 5, gain: 100, filter: 20, adcBits: 12, temp: 25, force: 0 },
      { dur: 22000, seq: [{ t: 0, ramp: { key: 'force', to: 100, durMs: 10000 } }, { t: 10500, ramp: { key: 'force', to: 0, durMs: 10000 } }] }),
    E('kraft-kalib', 'DMS-Kalibrierung mit Nullpunkt und Endwert', 'Kraft und Druck', 'kraft',
      'Eine Viertelbrücke zeigt ohne Last etwa 4 N an. Bei 1 s wird der Nullpunkt abgeglichen, danach werden 100 N aufgebracht und bei 5 s der Endwert abgeglichen. Danach zeigt die Anzeige bei Last und ohne Last den richtigen Wert, die Nullpunkt-Meldung verschwindet.',
      { mode: 'kraft', bridge: 'viertel', uBridge: 5, gain: 200, offset: 0, filter: 20, adcBits: 12, temp: 25, cal: true, force: 0 },
      { dur: 8000, seq: [{ t: 1000, set: { calZero: true } }, { t: 1200, set: { calZero: false } }, { t: 2000, set: { force: 100 } }, { t: 5000, set: { calSpan: true } }, { t: 5200, set: { calSpan: false } }] }),
    E('kraft-drift', 'Fehler: Temperaturdrift der Viertelbrücke', 'Kraft und Druck', 'kraft',
      'Der DMS erwärmt sich langsam auf rund 80 °C. Ohne Last wandert die Anzeige in der Viertelbrücke auf über 30 N, weil die Wärme den DMS-Widerstand ändert. Bei 50 s wird auf die Vollbrücke umgeschaltet, in der sich der Temperaturgang aufhebt, und der Fehler fällt auf wenige Newton.',
      { mode: 'kraft', bridge: 'viertel', uBridge: 5, gain: 200, filter: 20, adcBits: 12, temp: 25, force: 0 },
      { dur: 70000, seq: [{ t: 0, ramp: { key: 'temp', to: 80, durMs: 20000 } }, { t: 50000, set: { bridge: 'voll', gain: 100 } }] }),
    /* Beschleunigung */
    E('accel-neigung', 'Neigung messen', 'Beschleunigung', 'beschleunigung',
      'Der Sensor wird zuerst um 60° nach vorn gekippt (Nick) und danach um 45° zur Seite (Roll). Aus den Anteilen der Erdbeschleunigung in x, y und z berechnet der Prüfstand die Winkel mit atan2. Vergleiche die Winkel mit der Einstellung und achte auf die Zählwerte.',
      { tiltX: 0, tiltY: 0, shock: 6, vibFreq: 0, vibAmp: 0, range: 2, res: 13, rate: 100, filter: 0 },
      { dur: 14000, seq: [{ t: 500, ramp: { key: 'tiltX', to: 60, durMs: 5000 } }, { t: 7000, ramp: { key: 'tiltY', to: 45, durMs: 5000 } }] }),
    E('accel-clip', 'Fehler: Messbereich zu klein für den Stoß', 'Beschleunigung', 'beschleunigung',
      'Ein Stoß von 8 g trifft den Sensor, der auf ±2 g eingestellt ist: Die Spitze wird bei knapp 2 g abgeschnitten (Clipping). Nach 3 Sekunden wird der Messbereich auf ±16 g erweitert, beim zweiten Stoß misst der Sensor die volle Spitze.',
      { tiltX: 0, tiltY: 0, shock: 8, vibFreq: 0, vibAmp: 0, range: 2, res: 10, rate: 800, filter: 0 },
      { dur: 6000, seq: [{ t: 500, set: { hit: true } }, { t: 700, set: { hit: false } }, { t: 3000, set: { range: 16 } }, { t: 3500, set: { hit: true } }, { t: 3700, set: { hit: false } }] }),
    E('accel-alias', 'Aliasing bei zu niedriger Datenrate', 'Beschleunigung', 'beschleunigung',
      'Eine Schwingung mit 180 Hz wird mit nur 100 Hz Datenrate abgetastet und erscheint als langsame Scheinschwingung mit 20 Hz. Nach 4 Sekunden wird die Datenrate auf 800 Hz erhöht, dann stimmt die Frequenz. Merke: Die Datenrate muss mehr als doppelt so hoch wie die Schwingfrequenz sein.',
      { tiltX: 0, tiltY: 0, vibFreq: 180, vibAmp: 0.6, range: 2, res: 13, rate: 100, filter: 0 },
      { dur: 8000, seq: [{ t: 4000, set: { rate: 800 } }] }),
    /* Normsignale */
    E('norm-420', '4…20 mA: Druck 0 bis 10 bar', 'Normsignale', 'normsignal',
      'Der Messumformer liefert 4 mA bei 0 bar und 20 mA bei 10 bar, die Bürde von 250 Ω macht daraus 1 bis 5 V für den Wandler. Der Druck steigt in zehn Sekunden von 0 auf 10 bar. Der Strom beginnt bei 4 mA, nicht bei 0 mA: Das ist der Live Zero.',
      { signal: '420', value: 0, lo: 0, hi: 10, uSupply: 24, rBurden: 250, rLine: 20, adcBits: 12, emi: 0 },
      { dur: 13000, seq: [{ t: 500, ramp: { key: 'value', to: 10, durMs: 10000 } }] }),
    E('norm-draht', 'Drahtbruch bei 4…20 mA wird erkannt', 'Normsignale', 'normsignal',
      'Nach 3 Sekunden reißt die Schleife, der Strom fällt auf 0 mA. Bei 4…20 mA ist das sofort als Fehler zu erkennen, weil kein gültiger Messwert unter 3,6 mA liegt. Die Anlage zeigt „Leitung unterbrochen“, nach 8 Sekunden ist die Leitung wieder in Ordnung.',
      { signal: '420', value: 5, lo: 0, hi: 10, uSupply: 24, rBurden: 250, rLine: 20, adcBits: 12, emi: 0, wireBreak: false },
      { dur: 12000, seq: [{ t: 3000, set: { wireBreak: true } }, { t: 8000, set: { wireBreak: false } }] }),
    E('norm-draht010', 'Drahtbruch bei 0…10 V bleibt unbemerkt', 'Normsignale', 'normsignal',
      'Dieselbe Leitung reißt, aber das Signal ist 0…10 V. Die Spannung fällt auf 0 V, und das ist ein gültiger Messwert (0 bar): Die Anlage kann den Bruch nicht von einem leeren Behälter unterscheiden. Darum nimmt man in der Praxis Signale mit Live Zero.',
      { signal: '010', value: 5, lo: 0, hi: 10, uSupply: 24, rBurden: 250, rLine: 20, adcBits: 12, emi: 0, wireBreak: false },
      { dur: 12000, seq: [{ t: 3000, set: { wireBreak: true } }, { t: 8000, set: { wireBreak: false } }] }),
    E('norm-buerde', 'Fehler: Bürde zu groß', 'Normsignale', 'normsignal',
      'Die Bürde wird langsam von 100 auf 1000 Ω vergrößert, während der Messumformer 10 bar (20 mA) liefert. Schon ab 250 Ω übersteuert der Wandler (5 V), ab etwa 580 Ω fehlt dem Messumformer außerdem die Spannung, um den Strom einzuprägen. Die Maximalbürde ist (24 V − 12 V) / 20 mA − Leitungswiderstand.',
      { signal: '420', value: 10, lo: 0, hi: 10, uSupply: 24, rBurden: 100, rLine: 20, adcBits: 12, emi: 0 },
      { dur: 13000, seq: [{ t: 500, ramp: { key: 'rBurden', to: 1000, durMs: 10000 } }] }),
    /* Digitale Sensoren */
    E('dig-sht', 'Temperatur und Feuchte per I2C', 'Digitale Sensoren', 'digital',
      'Der SHT-Sensor liefert die Messwerte als Rohdaten über den I2C-Bus. Im Logikanalysator erkennst du Start, Adresse 0x44, Datenbytes mit Prüfsumme und Stopp. Die Temperatur steigt langsam von 23 auf 40 °C, und der Controller rechnet aus dem 16-Bit-Rohwert die Anzeige.',
      { sensor: 'sht', temp: 23, rh: 45, addr: 68, addrPin: 'low', twin: false, pullup: 4700, busSpeed: 100000, busLength: 0.3, stretch: false },
      { dur: 25000, seq: [{ t: 1000, ramp: { key: 'temp', to: 40, durMs: 15000 } }] }),
    E('dig-pullup', 'Fehler: Pull-up zu groß bei 400 kHz', 'Digitale Sensoren', 'digital',
      'Im Fast-Mode mit 400 kHz und 1 m Kabel verlangt der I2C-Bus Anstiegszeiten unter 300 ns. Mit 10 kΩ Pull-up sind die Flanken doppelt so langsam, die Übertragungen schlagen fehl. Nach 12 Sekunden wird auf 2,2 kΩ gewechselt, danach laufen sie wieder fehlerfrei.',
      { sensor: 'sht', temp: 23, rh: 45, addr: 68, addrPin: 'low', twin: false, pullup: 10000, busSpeed: 400000, busLength: 1, stretch: false },
      { dur: 25000, seq: [{ t: 12000, set: { pullup: 2200 } }] }),
    E('dig-konflikt', 'Fehler: Adresskonflikt zweier Sensoren', 'Digitale Sensoren', 'digital',
      'Zwei gleiche SHT-Sensoren melden sich beide mit der Adresse 0x44, ihre Antworten überlagern sich, und die Prüfsumme stimmt nicht mehr. Nach 12 Sekunden wird beim ersten Sensor der Adress-Pin auf High gelegt (Adresse 0x45), und der Controller fragt diese neue Adresse ab. Danach sind beide Sensoren getrennt ansprechbar.',
      { sensor: 'sht', temp: 23, rh: 45, addr: 68, addrPin: 'low', twin: true, pullup: 4700, busSpeed: 100000, busLength: 0.3, stretch: false },
      { dur: 25000, seq: [{ t: 12000, set: { addrPin: 'high', addr: 69 } }] }),
    E('dig-us', 'Ultraschall: Schallgeschwindigkeit hängt von der Temperatur ab', 'Digitale Sensoren', 'digital',
      'Der Ultraschallsensor misst die Laufzeit des Echos und rechnet sie mit einer festen Schallgeschwindigkeit in den Abstand um. Bei 23 °C stimmt das, bei −20 °C ist der Schall langsamer und die Anzeige liegt um rund 7 % zu hoch. Für genaue Messungen braucht der Sensor eine Temperaturkompensation.',
      { sensor: 'us', temp: 23, dist: 1000, pullup: 4700, busSpeed: 100000, busLength: 0.3 },
      { dur: 11000, seq: [{ t: 5000, set: { temp: -20 } }] }),
    /* ADU */
    E('adu-quant', 'Quantisierung: 4, 8 und 12 Bit', 'ADU und Abtastung', 'adu',
      'Ein Sinus wird nacheinander mit 4, 8 und 12 Bit gewandelt. Bei 4 Bit sind die Treppenstufen deutlich zu sehen, mit jedem zusätzlichen Bit wird der Störabstand um rund 6 dB besser. Nach der Formel 6,02 · n + 1,76 dB sind das etwa 26 dB bei 4 Bit, 50 dB bei 8 Bit und 74 dB bei 12 Bit.',
      { wave: 'sin', fSig: 50, amp: 1.5, offset: 1.65, noise: 0, bits: 4, vref: 3.3, fs: 2000, sampleHold: true, aaf: false },
      { dur: 12000, seq: [{ t: 4000, set: { bits: 8 } }, { t: 8000, set: { bits: 12 } }] }),
    E('adu-alias', 'Aliasing-Demo: 900 Hz bei 1 kHz Abtastung', 'ADU und Abtastung', 'adu',
      'Ein 900-Hz-Signal wird mit nur 1000 Hz abgetastet: Das Abtasttheorem ist verletzt, und die Abtastwerte zeigen eine Scheinschwingung mit 100 Hz. Nach 4 Sekunden wird die Abtastrate auf 4000 Hz erhöht, dann wird das Signal richtig als 900 Hz erkannt.',
      { wave: 'sin', fSig: 900, amp: 1.5, offset: 1.65, noise: 0, bits: 12, vref: 3.3, fs: 1000, sampleHold: true, aaf: false },
      { dur: 9000, seq: [{ t: 4000, set: { fs: 4000 } }] }),
    E('adu-aaf', 'Anti-Aliasing-Filter schützt vor Scheinfrequenzen', 'ADU und Abtastung', 'adu',
      'Wieder wird ein 900-Hz-Signal mit 1000 Hz abgetastet. Nach 4 Sekunden schaltet der Tiefpass vor dem Wandler zu, und die Scheinschwingung verschwindet, weil er alles oberhalb der halben Abtastrate abschwächt. Das Nutzsignal geht dabei verloren: Das Filter ist nur eine Notlösung für Störungen, die du nicht messen willst.',
      { wave: 'sin', fSig: 900, amp: 1.5, offset: 1.65, noise: 0, bits: 12, vref: 3.3, fs: 1000, sampleHold: true, aaf: false },
      { dur: 9000, seq: [{ t: 4000, set: { aaf: true } }] })
  ];

  /* ====================================================================== Ausführung, Selbsttest */
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));
  const SEN_TASKS = {
    tasks,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberfläche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig || task.rig, controls: o.controls || {}, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, value: fin(o.value) ? o.value : (typeof o.value === 'string' ? o.value : null), text: typeof o.text === 'string' ? o.text : '' };
  }
  root.SEN_DATA = { examples };
  root.SEN_TASKS = SEN_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await SEN_TASKS.run(t, answerOf(t, t.start()))), L = await SEN_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };
  if (typeof module !== 'undefined') module.exports = { examples, tasks, run, answerOf, clean };
})(typeof window !== 'undefined' ? window : globalThis);
