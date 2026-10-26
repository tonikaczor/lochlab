/* antdata.js - Antriebs-Lab: Beispiele und Aufgaben mit automatischer Prüfung (Simulation, ohne Browser lauffähig)
 * window.ANT_DATA  = { examples: [ { id, name, cat, rig, desc, controls, seq?, dur? } ] }
 * window.ANT_TASKS = { tasks: [ { id, lab:'ant', cat, title, level, rig, text, hint[3], ask?, start(), sol(), check(answer) } ], run(task, answer) }
 * window.TaskTest  = async only => [ { id, pct, startPct, bad } ]
 * Die Prüfungen laufen headless mit ANT_CORE.runSeq und den Prüfständen (ANT_RIGS): Sie messen Verhalten (Simulation, feste Szenarien),
 * nicht die Form der Eingabe. Benötigt: antcore.js und die fünf Prüfstände (antrig-*.js).
 * answer = { rig, controls:{key:Wert}, seq:[{t(ms), set}], rows:[{t(s), key, value}], dur(ms), state, simTime(ms), value:(Zahl|null), text }
 * start() und sol() liefern { rig, controls, seq?, dur?, value? } (value nur bei Zahlenaufgaben, dient dem Selbsttest). */
(function (root) {
  'use strict';
  const CORE = () => root.ANT_CORE, RIGS = () => root.ANT_RIGS;
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');

  /* ====================================================================== Eingabe prüfen und aufbereiten */
  const FREE_KEYS = { motor: 1, loadRel: 1, preset: 1 };
  const ctlDefs = rig => { const R = RIGS(); const d = R && R.defs && R.defs[rig]; return d && Array.isArray(d.controls) ? d.controls : null; };
  function toNum(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') { const x = parseFloat(v.replace(/\s/g, '').replace(',', '.')); return x; }
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
  /* -> { controls, seq, problems[], value } ; wirft nie */
  function clean(a, rig) {
    const problems = [], defs = ctlDefs(rig), map = {};
    if (defs) defs.forEach(c => { map[c.key] = c; });
    a = isObj(a) ? a : {};
    const one = (k, v, where) => {
      if (FREE_KEYS[k]) return v;
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
    return CORE().runSeq(rig, seq, T, Object.assign({ controls: controls || {}, sampleMs: 10 }, o || {}));
  }
  const smpAt = (r, t) => { const s = r.samples; for (let i = 0; i < s.length; i++) if (s[i].t >= t - 1e-9) return s[i]; return s[s.length - 1] || { t: 0, meters: {}, state: {} }; };
  const smpWin = (r, t0, t1) => r.samples.filter(s => s.t >= t0 && s.t <= t1);
  const maxOf = (r, k, t0, t1) => smpWin(r, t0 == null ? 0 : t0, t1 == null ? 1e9 : t1).reduce((m, s) => Math.max(m, +s.state[k] || 0), 0);
  const faultRe = (r, re) => (r.faults || []).some(f => re.test(String(f))) || (r.events || []).some(e => e && re.test(String(e.text || '')) && e.kind === 'error');
  /* zuletzt gesetzter Wert eines Steuerwerts (Steuerwerte, dann Schritte bis tMs) */
  function effCtl(c, key, def, tMs) {
    let v = c.controls[key] !== undefined ? c.controls[key] : def;
    c.seq.forEach(e => { if (e.set && e.set[key] !== undefined && e.t <= (tMs == null ? 1e12 : tMs)) v = e.set[key]; });
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
  function askCheck(want, mistakes) {
    return mk('gleichstrom', (c, r, a) => {
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

  /* Eigenschaften des Drehstrommotors (Typenschild des Prüfstands, ersatzweise feste Werte) */
  function acRated() {
    try { const s = RIGS().create('drehstrom').state(); return { I: s.ratedCurrent || 3.4, M: s.ratedTorque || 10.1, n: s.ratedSpeed || 1420 }; } catch (e) { return { I: 3.4, M: 10.1, n: 1420 }; }
  }

  /* ====================================================================== Prüfungen der Simulationsaufgaben */
  /* an6: Tastgrad für Zieldrehzahl */
  const checkAn6 = mk('gleichstrom', (c, r) => {
    const ctl = Object.assign({ mode: 'pwm', dir: 'vor' }, initial(c), { motor: 'getriebe12', load: 0.005, loadType: 'bremse', uSupply: 12 });
    const s = run('gleichstrom', [], 4000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(!faultRe(s, /shoot|kurzschluss/i), 'Es gibt keinen Brückenkurzschluss', 'Im PWM-Betrieb schaltet die Steuerung die Brücke selbst. Im manuellen Betrieb dürfen S1 und S2 (oder S3 und S4) nie zugleich an sein.');
    r(Math.abs(f.rpm - 3000) <= 150, 'Die Drehzahl liegt bei 3000 1/min (±5 %)', 'Gemessen: ' + fm(f.rpm, 0) + ' 1/min. Bei Nennlast ist die Drehzahl fast proportional zum Tastgrad (bei 100 % rund 4700 1/min); stelle den Tastgrad im PWM-Betrieb entsprechend ein.');
  });
  /* an7: Schaltfolge der H-Brücke von Hand */
  const checkAn7 = mk('gleichstrom', (c, r) => {
    const ctl = { mode: 'manuell', S1: false, S2: false, S3: false, S4: false, uSupply: 12, motor: 'getriebe12', load: 0.005, loadType: 'bremse', duty: 100 };
    const s = run('gleichstrom', c.seq, 6500, ctl, { sampleMs: 5 });
    inputRow(c, r, s);
    const shoot = s.samples.some(x => x.state.shoot || x.state.bridge === 'kurzschluss') || faultRe(s, /shoot/i);
    r(!shoot, 'Nie sind beide Schalter einer Seite gleichzeitig an (kein Brückenkurzschluss)', 'S1 und S2 sowie S3 und S4 dürfen nie zugleich an sein, auch nicht für einen Augenblick beim Umschalten. Schalte erst den einen Schalter aus, dann den anderen ein.');
    const a1 = smpAt(s, 1800), a2 = smpAt(s, 2800), a3 = smpAt(s, 4800), a4 = smpAt(s, 6400);
    r(a1.state.bridge === 'vor' && a1.state.rpm > 1500, 'Von 0 bis 2 s läuft der Motor vorwärts (S1 und S4)', 'Bei 1,8 s: Brücke „' + a1.state.bridge + '“, ' + fm(a1.state.rpm, 0) + ' 1/min. Vorwärts heißt S1 und S4 geschlossen.');
    r(a2.state.bridge === 'bremse' && Math.abs(a2.state.rpm) < 300, 'Von 2 bis 3 s bremst die Brücke den Motor (beide unteren oder beide oberen Schalter)', 'Bei 2,8 s: Brücke „' + a2.state.bridge + '“, ' + fm(a2.state.rpm, 0) + ' 1/min. Zum Bremsen schließt du S2 und S4 (oder S1 und S3): Die Wicklung ist dann kurzgeschlossen.');
    r(a3.state.bridge === 'rueck' && a3.state.rpm < -1500, 'Von 3 bis 5 s läuft der Motor rückwärts (S2 und S3)', 'Bei 4,8 s: Brücke „' + a3.state.bridge + '“, ' + fm(a3.state.rpm, 0) + ' 1/min. Rückwärts heißt S2 und S3 geschlossen.');
    r(a4.state.bridge === 'frei' && Math.abs(a4.state.rpm) < 300, 'Nach 5 s sind alle Schalter aus und der Motor läuft aus', 'Bei 6,4 s: Brücke „' + a4.state.bridge + '“, ' + fm(a4.state.rpm, 0) + ' 1/min.');
  });
  /* an8: Anlaufstrom mit Stufen begrenzen */
  const checkAn8 = mk('gleichstrom', (c, r) => {
    const ctl = { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12, motor: 'getriebe12', load: 0.005, loadType: 'bremse', freq: 5000 };
    const s = run('gleichstrom', c.seq, 6000, ctl, { sampleMs: 5 }), f = s.final || {};
    inputRow(c, r, s);
    const ip = maxOf(s, 'iPeak');
    r(ip <= 0.75, 'Der Strom bleibt beim Hochfahren unter 0,75 A', 'Gemessene Stromspitze: ' + fm(ip, 2) + ' A. Springt der Tastgrad auf einmal hoch, liegt fast die volle Spannung am Anker: I = U / R. Nimm mehr und kleinere Stufen.');
    r(!faultRe(s, /overcurrent|überstrom/i), 'Die Überstrom-Meldung der Anlage bleibt aus', 'Die Anlage meldet Überstrom, sobald der Anlaufstrom über das 2,5-fache des Nennstroms (0,3 A) steigt.');
    r(fin(f.rpm) && f.rpm >= 4200, 'Nach 6 s läuft der Motor mit vollem Tastgrad (über 4200 1/min)', 'Am Ende: ' + fm(f.rpm, 0) + ' 1/min. Der Tastgrad muss spätestens nach 5 s bei 100 % stehen.');
    r(!faultRe(s, /shoot|kurzschluss/i), 'Es gibt keinen Brückenkurzschluss', 'Im PWM-Betrieb ist ein Brückenkurzschluss nicht möglich. Hast du die Betriebsart verstellt?');
  });
  /* an9: Richtungsumkehr */
  const checkAn9 = mk('gleichstrom', (c, r) => {
    const ctl = { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12, motor: 'getriebe12', load: 0.005, loadType: 'bremse', freq: 5000, deadtime: true };
    const s = run('gleichstrom', c.seq, 9000, ctl, { sampleMs: 5 }), f = s.final || {};
    inputRow(c, r, s);
    r(!faultRe(s, /overcurrent|überstrom/i), 'Beim Umkehren tritt kein Überstrom auf', 'Wird die Richtung umgeschaltet, während der Motor noch läuft, addiert sich die Gegenspannung zur Betriebsspannung: Es fließt ein riesiger Strom. Erst Tastgrad auf 0, Motor auslaufen lassen, dann die Richtung wechseln und wieder stufenweise hochfahren.');
    const mid = s.samples.filter(x => x.t > 1500 && Math.abs(x.state.rpm) < 100).length;
    r(mid > 0, 'Der Motor kommt zwischen den Richtungen zum Stillstand', 'Der Motor muss kurz stehen (unter 100 1/min), bevor er in die andere Richtung anläuft.');
    r(fin(f.rpm) && f.rpm <= -1500, 'Am Ende dreht der Motor rückwärts mit mindestens 1500 1/min', 'Am Ende: ' + fm(f.rpm, 0) + ' 1/min. Setze „dir“ auf rueck und fahre den Tastgrad wieder auf 60 %.');
    r(!faultRe(s, /shoot|kurzschluss/i), 'Es gibt keinen Brückenkurzschluss', 'Hast du die Betriebsart auf manuell gestellt?');
  });

  /* Servo: Sollwertsprung von 0 auf 20 Grad */
  function servoRun(c, load, T, base) {
    const ctl = Object.assign({ mode: 'regler' }, base, initial(c), { mode: 'regler', setpoint: 0, load });
    return run('servo', [{ t: 200, set: { setpoint: 20 } }], T, ctl);
  }
  const checkAn10 = mk('servo', (c, r) => {
    const s = servoRun(c, 0, 3000, { kp: 150, ki: 0, kd: 0 }), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.overshoot) && f.overshoot <= 10, 'Das Überschwingen ist höchstens 10 %', 'Gemessen: ' + fm(f.overshoot, 1) + ' %. Der D-Anteil (kd) dämpft das Überschwingen; ein kleineres kp wirkt ebenfalls.');
    r(fin(f.angle) && Math.abs(f.angle - 20) <= 1, 'Nach 3 s steht der Arm auf 20° (±1°)', 'Winkel nach 3 s: ' + fm(f.angle, 1) + '°. Mit kp = 0 oder sehr kleinem kp bewegt sich der Arm nicht bis zum Ziel.');
    r(!faultRe(s, /oscillation|schwing/i), 'Der Regelkreis schwingt nicht', 'Die Anlage meldet Schwingen: kp ist im Verhältnis zu kd zu hoch.');
  });
  const checkAn11 = mk('servo', (c, r) => {
    const s = servoRun(c, 0, 3000, { kp: 20, ki: 0, kd: 1 }), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.overshoot) && f.overshoot <= 5, 'Das Überschwingen ist höchstens 5 %', 'Gemessen: ' + fm(f.overshoot, 1) + ' %. Mehr D-Anteil (kd) bremst den Arm vor dem Ziel.');
    r(fin(f.settle) && f.settle <= 0.15, 'Die Ausregelzeit ist höchstens 0,15 s', 'Gemessen: ' + fm(f.settle, 2) + ' s. Ein größeres kp macht den Arm schneller; ist kd dabei viel zu groß, wird er wieder träge.');
    r(fin(f.angle) && Math.abs(f.angle - 20) <= 1, 'Der Arm steht am Ende auf 20° (±1°)', 'Winkel nach 3 s: ' + fm(f.angle, 1) + '°.');
  });
  const checkAn12 = mk('servo', (c, r) => {
    const s = servoRun(c, 0.3, 4000, { kp: 50, ki: 0, kd: 1 }), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.error) && Math.abs(f.error) <= 0.5, 'Nach 4 s ist der bleibende Fehler höchstens 0,5°', 'Bleibender Fehler: ' + fm(f.error, 1) + '°. Das Gewicht (0,3 Nm) drückt den Arm weg; ein P-Regler braucht dafür einen Fehler. Erst der I-Anteil (ki) räumt ihn weg.');
    r(fin(f.overshoot) && f.overshoot <= 10, 'Das Überschwingen ist höchstens 10 %', 'Gemessen: ' + fm(f.overshoot, 1) + ' %. Ein zu großes ki schaukelt den Arm auf.');
    r(fin(f.settle) && f.settle <= 2, 'Die Ausregelzeit ist höchstens 2 s', 'Gemessen: ' + fm(f.settle, 2) + ' s. Ein zu kleines ki braucht lange, bis der Fehler weg ist.');
  });

  /* Schrittmotor */
  const checkAn14 = mk('schritt', (c, r) => {
    const ctl = { mode: 'manuell', A1: true, A2: false, B1: true, B2: false, stepMode: 'voll', dir: 'vor', load: 0.02, current: 1, run: false, rate: 100 };
    const s = run('schritt', c.seq, clamp(lastT(c.seq) + 1500, 3000, 20000), ctl), f = s.final || {};
    inputRow(c, r, s);
    r(f.steps === 4 && f.pos === 4, 'Der Motor macht genau 4 Schritte vorwärts', 'Gezählte Schritte: ' + fm(f.steps, 0) + ', Rotorlage: ' + fm(f.pos, 0) + ' Schritte. Das Vollschritt-Muster [A1 A2 B1 B2] lautet 1010, 0110, 0101, 1001 und dann wieder 1010. Diese Reihenfolge ergibt vorwärts.');
    r(fin(f.angle) && Math.abs(f.angle - 7.2) <= 0.5, 'Die Welle hat sich um 7,2° gedreht (4 · 1,8°)', 'Gemessener Winkel: ' + fm(f.angle, 1) + '°.');
    r(f.lostSteps === 0, 'Es gehen keine Schritte verloren', 'Schalte die Muster mit genug Pause (mindestens 0,2 s) nacheinander.');
  });
  const checkAn15 = mk('schritt', (c, r) => {
    const ctl = Object.assign({ stepMode: 'voll', rate: 100, current: 1 }, initial(c), { mode: 'auto', dir: 'vor', load: 0.05, run: false });
    const s = run('schritt', [{ t: 0, set: { run: true } }, { t: 1500, set: { run: false } }], 3000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(f.stepMode === 'halb', 'Der Motor läuft im Halbschritt-Betrieb', 'Betriebsart des Treibers: „' + f.stepMode + '“. Stelle bei „Schrittart“ Halbschritt ein.');
    r(fin(f.angle) && Math.abs(f.angle - 135) <= 1, 'Nach 1,5 s Laufzeit steht die Welle auf 135° (±1°)', 'Gemessener Winkel: ' + fm(f.angle, 1) + '°. Im Halbschritt dreht jeder Schritt 0,9°: Für 135° brauchst du 150 Schritte in 1,5 s, also 100 Schritte pro Sekunde.');
    r(f.lostSteps === 0, 'Es gehen keine Schritte verloren', 'Verringere die Schrittfrequenz oder erhöhe den Strom.');
  });
  const checkAn16 = mk('schritt', (c, r) => {
    const ctl = Object.assign({ rate: 400, current: 1 }, initial(c), { mode: 'auto', stepMode: 'voll', dir: 'vor', load: 0.15, run: false });
    const s = run('schritt', [{ t: 0, set: { run: true } }], 3000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(f.lostSteps === 0, 'Es gehen keine Schritte verloren', 'Verlorene Schritte: ' + fm(f.lostSteps, 0) + '. Das Moment des Motors fällt mit der Frequenz ab. Bei 0,15 Nm Last reichen 1 A bei 400 Schritten pro Sekunde nicht: Erhöhe den Strom.');
    r(fin(f.steps) && f.steps >= 1190, 'Der Motor schafft mindestens 400 Schritte pro Sekunde (1190 Schritte in 3 s)', 'Gezählte Schritte in 3 s: ' + fm(f.steps, 0) + '. Stelle die Schrittfrequenz auf mindestens 400 Schritte pro Sekunde.');
    r((+ctl.current || 0) <= 2.5, 'Der eingestellte Strom ist höchstens 2,5 A', 'Der Treiber liefert höchstens 2,5 A.');
    r(fin(f.temp) && f.temp < 100, 'Die Wicklung bleibt unter 100 °C', 'Gemessene Temperatur: ' + fm(f.temp, 0) + ' °C.');
  });
  const checkAn27 = mk('schritt', (c, r) => {
    const ctl = Object.assign({ rate: 400, current: 1 }, initial(c), { mode: 'auto', stepMode: 'voll', dir: 'vor', load: 0.2, run: false });
    const s = run('schritt', [{ t: 0, set: { run: true } }, { t: 2000, set: { run: false } }], 2500, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(f.lostSteps === 0, 'Es gehen keine Schritte verloren', 'Verlorene Schritte: ' + fm(f.lostSteps, 0) + '. Bei 0,2 Nm Last und 1 A schafft der Motor nur kleine Schrittfrequenzen. Verringere die Frequenz oder erhöhe den Strom.');
    r(fin(f.pos) && f.pos >= 190 && f.steps >= 190, 'Der Motor fährt mindestens 100 Schritte pro Sekunde (190 Schritte in 2 s)', 'Gezählte Schritte: ' + fm(f.steps, 0) + ', Rotorlage: ' + fm(f.pos, 0) + '. Die Rotorlage muss mit der Schrittzahl übereinstimmen.');
    r((+ctl.current || 0) <= 2.5, 'Der eingestellte Strom ist höchstens 2,5 A', 'Der Treiber liefert höchstens 2,5 A.');
  });

  /* Drehstrom */
  const AC_BASE = { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, reverse: false, phaseLoss: false, load: 3, freq: 50, ramp: 3 };
  const checkAn19 = mk('drehstrom', (c, r) => {
    const ac = acRated(), T = clamp(lastT(c.seq) + 3000, 4000, 20000);
    const s = run('drehstrom', c.seq, T, Object.assign({}, AC_BASE), { sampleMs: 5 }), f = s.final || {};
    inputRow(c, r, s);
    const shoot = faultRe(s, /kurzschluss|Stern und Dreieck|Sicherung/i) || s.samples.some(x => x.state.fuse) || (s.events || []).some(e => e && e.fx === 'shoot');
    r(!shoot, 'K2 und K3 sind nie gleichzeitig an (kein Kurzschluss, Sicherung bleibt)', 'Stern und Dreieck gleichzeitig ist ein Kurzschluss. Schalte K2 aus, warte kurz und schalte erst dann K3 ein.');
    const live = s.samples.filter(x => x.state.live);
    const firstConn = live.length ? live[0].state.conn : '';
    r(firstConn === 'stern', 'Der Motor läuft zuerst im Stern an', 'Beim Einschalten von K1 muss K2 (Stern) schon geschlossen sein. Erste Schaltung nach dem Einschalten: „' + (firstConn || 'keine') + '“.');
    const ip = maxOf(s, 'iLine');
    r(ip <= 3 * ac.I, 'Der Strom bleibt immer unter dem Dreifachen des Nennstroms', 'Höchster Strom: ' + fm(ip, 1) + ' A (Nennstrom ' + fm(ac.I, 1) + ' A). Ein Direktanlauf zieht etwa das 6-fache. Schaltest du zu früh auf Dreieck, gibt es einen zweiten Stromstoß.');
    let k2off = null, k3on = null, k2 = false, usesK = false, viaConn = false;
    c.seq.forEach(e => {
      const st = e.set || {};
      if ('K2' in st) { if (st.K2) k2 = true; else if (k2 && k2off === null) k2off = e.t; }
      if ('K3' in st && st.K3 && k3on === null) { k3on = e.t; usesK = true; }
      if ('connection' in st) viaConn = true;
    });
    const pauseOk = usesK ? (k2off !== null && k3on - k2off >= 50 && k3on - k2off <= 2000) : viaConn;
    r(pauseOk, 'Zwischen K2 aus und K3 an liegt eine Pause von 50 ms bis 2 s', usesK ? 'K2 aus bei ' + fm(k2off === null ? NaN : k2off / 1000, 2) + ' s, K3 an bei ' + fm(k3on / 1000, 2) + ' s. Die Pause verhindert, dass der Lichtbogen des Sternschützes das Dreieckschütz trifft.' : 'Benutze K2 und K3 mit einer kleinen Zeitverzögerung dazwischen.');
    r(f.conn === 'dreieck' && fin(f.rpm) && f.rpm >= 1440, 'Am Ende läuft der Motor im Dreieck mit voller Drehzahl (mindestens 1440 1/min)', 'Am Ende: Schaltung „' + f.conn + '“, ' + fm(f.rpm, 0) + ' 1/min.');
    const sternMs = s.samples.filter(x => x.state.conn === 'stern').length * 5;
    r(sternMs > 0 && sternMs <= 8000, 'Die Sternphase dauert höchstens 8 s', 'Der Motor lief ' + fm(sternMs / 1000, 1) + ' s im Stern. Nach dem Hochlauf soll auf Dreieck geschaltet werden.');
  });
  const checkAn20 = mk('drehstrom', (c, r) => {
    const ctl = Object.assign({}, AC_BASE, initial(c), { load: 4, reverse: false, phaseLoss: false });
    const s = run('drehstrom', [], 12000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.fMotor) && f.fMotor > 5 && Math.abs(f.fMotor - 50) > 1, 'Der Motor wird vom Frequenzumrichter gespeist (Frequenz am Motor weicht von 50 Hz ab)', 'Frequenz am Motor: ' + fm(f.fMotor, 1) + ' Hz. Wähle „Frequenzumrichter“ als Speisung und schalte K1 (Freigabe) ein.');
    r(fin(f.rpm) && Math.abs(f.rpm - 900) <= 27, 'Die Wellendrehzahl liegt bei 900 1/min (±3 %)', 'Gemessen nach 12 s: ' + fm(f.rpm, 0) + ' 1/min. Näherung: n ≈ 60 · f / p · (1 − Schlupf), mit p = 2 und etwa 2 % Schlupf bei dieser Last.');
    r(!f.fuTrip && !faultRe(s, /Überstrom|Überhitz/i), 'Der Umrichter läuft ohne Störung', 'Der Umrichter hat abgeschaltet oder der Motor wurde zu heiß. Wähle eine längere Hochlaufzeit.');
  });

  /* Getriebe */
  const GEAR_BASE = { type: 'stirnrad', stages: 1, z1: 20, z2: 40, z3: 20, z4: 40, nIn: 1500, mIn: 2, load: 0, eta: 'auto', lube: true };
  const etaOf = f => { const e = +f.eta; return e > 1.5 ? e / 100 : e; };
  const checkAn22 = mk('getriebe', (c, r) => {
    const ctl = Object.assign({}, GEAR_BASE, initial(c), { stages: 1, nIn: 1500, mIn: 2, load: 0, lube: true, eta: 'auto' });
    const s = run('getriebe', [], 3000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.nOut) && Math.abs(f.nOut - 500) <= 10, 'Die Abtriebsdrehzahl liegt bei 500 1/min (±2 %)', 'Gemessen: ' + fm(f.nOut, 0) + ' 1/min bei 1500 1/min am Eingang. Gesucht ist i = 1500 / 500 = 3, also z2 = 3 · z1.');
    r(fin(etaOf(f)) && etaOf(f) >= 0.9, 'Der Wirkungsgrad ist mindestens 90 %', 'Wirkungsgrad: ' + fm(etaOf(f) * 100, 0) + ' %. Ein Schneckengetriebe hat einen schlechteren Wirkungsgrad als Stirnräder oder Riemen.');
    r(!f.broken && !f.overload && !f.overSpeed, 'Das Getriebe ist nicht überlastet', 'Prüfe Moment und Drehzahl.');
  });
  const checkAn26 = mk('getriebe', (c, r) => {
    const ctl = Object.assign({}, GEAR_BASE, initial(c), { type: 'stirnrad', stages: 1, z1: 20, z2: 40, nIn: 1500, mIn: 10, load: 0, eta: 'auto' });
    const s = run('getriebe', [], 40000, ctl, { sampleMs: 100 }), f = s.final || {};
    inputRow(c, r, s);
    r(effCtl(c, 'lube', false) === true, 'Die Ursache der Erwärmung ist beseitigt', 'Reibung und Temperatur steigen noch. Prüfe, was am Getriebe die Reibung senkt, und stelle es ein.');
    const tmax = maxOf(s, 'temp');
    r(tmax <= 70, 'Das Getriebe bleibt unter 70 °C (40 s Dauerbetrieb)', 'Höchste Temperatur: ' + fm(tmax, 0) + ' °C.');
    r(!faultRe(s, /Überhitz|Schmierung|Reibung/i), 'Es gibt keine Fehlermeldung der Anlage', 'Die Anlage meldet noch Überhitzung oder erhöhte Reibung.');
    r(fin(f.nOut) && f.nOut >= 700, 'Das Getriebe läuft (Abtrieb über 700 1/min)', 'Abtriebsdrehzahl: ' + fm(f.nOut, 0) + ' 1/min.');
  });
  const checkAn30 = mk('getriebe', (c, r) => {
    const ctl = Object.assign({}, GEAR_BASE, initial(c), { nIn: 1500, mIn: 1.5, load: 0, lube: true, eta: 'auto' });
    const s = run('getriebe', [], 3000, ctl), f = s.final || {};
    inputRow(c, r, s);
    r(fin(f.nOut) && Math.abs(f.nOut - 100) <= 5, 'Die Trommel dreht mit 100 1/min (±5 %)', 'Abtriebsdrehzahl: ' + fm(f.nOut, 0) + ' 1/min. Gesucht ist i = 1500 / 100 = 15. Mit einer Stufe schaffst du höchstens i = 80 / 8 = 10 sinnvoll, nimm zwei Stufen und multipliziere die Einzelübersetzungen.');
    r(fin(f.mOut) && f.mOut >= 20, 'Das Abtriebsmoment ist mindestens 20 Nm', 'Abtriebsmoment: ' + fm(f.mOut, 1) + ' Nm. Es gilt M_aus = M_ein · i · η.');
    r(fin(etaOf(f)) && etaOf(f) >= 0.9, 'Der Gesamtwirkungsgrad ist mindestens 90 %', 'Wirkungsgrad: ' + fm(etaOf(f) * 100, 0) + ' %. Ein Schneckengetriebe schafft das nicht, zwei Stirnradstufen schon.');
    r(!f.broken && !f.overload && !f.overSpeed, 'Das Getriebe ist nicht überlastet', 'Prüfe Moment und Drehzahl.');
  });

  /* Fehlersuche Drehstrom */
  function acRunCheck(extraRows) {
    return mk('drehstrom', (c, r) => {
      const ctl = Object.assign({}, AC_BASE, initial(c), { load: 3 });
      const s = run('drehstrom', [], 10000, ctl), f = s.final || {};
      inputRow(c, r, s);
      extraRows(c, r, s, f);
    });
  }
  const checkAn24 = acRunCheck((c, r, s, f) => {
    r(fin(f.rpm) && f.rpm > 0, 'Der Motor dreht rechts herum (positive Drehzahl)', 'Drehzahl: ' + fm(f.rpm, 0) + ' 1/min. Das Minuszeichen heißt: linksherum. Zwei Außenleiter sind vertauscht (Schalter „Drehrichtung links“).');
    r(fin(f.rpm) && f.rpm >= 1440, 'Er erreicht seine volle Drehzahl (mindestens 1440 1/min)', 'Drehzahl: ' + fm(f.rpm, 0) + ' 1/min. Der Motor muss laufen: K1 muss an sein.');
    r((s.faults || []).length === 0, 'Die Anlage meldet keine Fehler', 'Gemeldet: ' + (s.faults || []).join(', ') + '.');
  });
  const checkAn25 = acRunCheck((c, r, s, f) => {
    r(!faultRe(s, /Phasenausfall/i), 'Es gibt keinen Phasenausfall mehr', 'Der Motor läuft nur an zwei Phasen. Ursache: ein Außenleiter ist weg (Sicherung, Schütz, Klemme). Der Schalter „Phasenausfall“ steht für diesen Fehler.');
    r(fin(f.rpm) && f.rpm >= 1440, 'Der Motor läuft an und erreicht seine volle Drehzahl', 'Drehzahl: ' + fm(f.rpm, 0) + ' 1/min. Er brummt weiter oder steht.');
    r(!faultRe(s, /Kippmoment/i), 'Er kippt nicht und bleibt nicht stehen', 'Kippmoment überschritten: Die Last ist größer als das Motormoment.');
    r(fin(f.temp) && f.temp <= 60, 'Die Wicklung bleibt kühl (höchstens 60 °C)', 'Temperatur: ' + fm(f.temp, 0) + ' °C.');
  });

  /* ====================================================================== Aufgabenzustände (Start und Lösung) */
  const S = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});
  const stairs = (key, from, to, n, t0, dt) => { const a = []; for (let i = 1; i <= n; i++) a.push({ t: t0 + (i - 1) * dt, set: { [key]: Math.round(from + (to - from) * i / n) } }); return a; };
  const AN7_BASE = { mode: 'manuell', S1: false, S2: false, S3: false, S4: false, uSupply: 12, load: 0.005 };
  const DC_PWM = { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12, motor: 'getriebe12', load: 0.005, loadType: 'bremse', freq: 5000, deadtime: true };
  const tasks = [
    /* ------------------------------------------------------------ Grundlagen */
    { id: 'an1', lab: 'ant', cat: 'Grundlagen', title: 'Leistung aus Moment und Drehzahl', level: 1, rig: 'gleichstrom',
      text: 'Du misst am Getriebemotor des Gleichstrom-Prüfstands an der Welle ein Drehmoment von M = 0,45 Nm bei einer Drehzahl von n = 600 1/min. Berechne die mechanische Leistung P, die der Motor an der Welle abgibt. Gib das Ergebnis in Watt an.',
      ask: { label: 'Mechanische Leistung P', unit: 'W' },
      hint: ['Die Leistung einer drehenden Welle ist Moment mal Winkelgeschwindigkeit. Rechne die Drehzahl zuerst in rad/s um.', 'ω = 2π · n / 60 mit n in 1/min. Danach P = M · ω. Das Ergebnis liegt unter 30 W.', 'ω = 2π · 600 / 60 = 62,83 rad/s. P = 0,45 Nm · 62,83 rad/s = 28,27 W.'],
      start: () => S('gleichstrom', {}, { value: null }), sol: () => S('gleichstrom', {}, { value: 0.45 * 2 * Math.PI * 600 / 60 }),
      check: askCheck(0.45 * 2 * Math.PI * 600 / 60, [[0.45 * 600, 'Du hast M · n gerechnet. Die Drehzahl muss erst in die Winkelgeschwindigkeit ω = 2π · n / 60 umgerechnet werden.'], [0.45 * 2 * Math.PI * 600, 'Du hast die Division durch 60 vergessen: n steht in 1/min, ω braucht 1/s.']]) },
    { id: 'an2', lab: 'ant', cat: 'Grundlagen', title: 'Nennmoment vom Typenschild', level: 1, rig: 'drehstrom',
      text: 'Auf dem Typenschild des Drehstrommotors am Prüfstand steht eine Leistung von 1,5 kW bei einer Drehzahl von 1420 1/min. Berechne das Nennmoment M_N, das der Motor an der Welle abgibt. Gib das Ergebnis in Newtonmeter an.',
      ask: { label: 'Nennmoment M_N', unit: 'Nm' },
      hint: ['Die Leistung ist Moment mal Winkelgeschwindigkeit. Stelle die Formel nach dem Moment um und rechne die Leistung in Watt, dann bekommst du das Moment in zwei Schritten.', 'M = P / ω mit ω = 2π · n / 60. Beachte: 1,5 kW sind 1500 W. Das Ergebnis liegt knapp über 10 Nm.', 'ω = 2π · 1420 / 60 = 148,7 rad/s. M = 1500 W / 148,7 rad/s = 10,09 Nm. (Faustformel: M = 9550 · 1,5 / 1420 = 10,09 Nm.)'],
      start: () => S('drehstrom', {}, { value: null }), sol: () => S('drehstrom', {}, { value: 1500 / (2 * Math.PI * 1420 / 60) }),
      check: askCheck(1500 / (2 * Math.PI * 1420 / 60), [[1.5 / (2 * Math.PI * 1420 / 60), 'Die Leistung muss in Watt eingesetzt werden (1,5 kW = 1500 W), sonst ist das Ergebnis 1000-mal zu klein.'], [1500 / 1420, 'Du hast P / n gerechnet. Die Drehzahl muss erst in ω = 2π · n / 60 umgerechnet werden.']]) },
    { id: 'an3', lab: 'ant', cat: 'Grundlagen', title: 'Wirkungsgrad des Antriebs', level: 1, rig: 'gleichstrom',
      text: 'Der Antrieb am Prüfstand nimmt elektrisch eine Leistung von 1875 W auf. An der Welle gibt er 1500 W ab. Berechne den Wirkungsgrad η des Antriebs und gib ihn in Prozent an.',
      ask: { label: 'Wirkungsgrad η', unit: '%' },
      hint: ['Der Wirkungsgrad vergleicht, was nutzbar herauskommt, mit dem, was du hineinsteckst.', 'η = P_ab / P_zu. Ab ist die Wellenleistung, zu ist die elektrische Aufnahme. Rechne das Ergebnis mal 100, um Prozent zu erhalten.', 'η = 1500 W / 1875 W = 0,8 = 80 %. Die Verlustleistung beträgt 375 W.'],
      start: () => S('gleichstrom', {}, { value: null }), sol: () => S('gleichstrom', {}, { value: 80 }),
      check: askCheck(80, [[0.8, 'Du hast den Wirkungsgrad als Anteil (0,8) angegeben. Gefragt ist die Angabe in Prozent: mal 100.'], [125, 'Du hast die Brüche vertauscht. Der Wirkungsgrad ist kleiner als 100 %: abgegebene durch zugeführte Leistung.'], [375, 'Das ist die Verlustleistung in Watt, nicht der Wirkungsgrad.']]) },
    { id: 'an4', lab: 'ant', cat: 'Grundlagen', title: 'Gesamtwirkungsgrad Motor und Getriebe', level: 2, rig: 'getriebe',
      text: 'Ein Motor mit dem Wirkungsgrad 0,85 treibt über ein Getriebe mit dem Wirkungsgrad 0,92 eine Winde an. Der Motor nimmt 600 W elektrische Leistung auf. Berechne die mechanische Leistung, die am Ausgang des Getriebes an der Winde ankommt. Gib das Ergebnis in Watt an.',
      ask: { label: 'Leistung an der Winde', unit: 'W' },
      hint: ['Bei hintereinander geschalteten Stufen verliert jede Stufe einen Teil der Leistung. Die Wirkungsgrade wirken nacheinander, du musst sie also verknüpfen.', 'Die Leistung wird erst mit dem Wirkungsgrad des Motors und dann mit dem des Getriebes multipliziert. Addieren oder Mitteln ist falsch.', 'P_ab = 600 W · 0,85 · 0,92 = 469,2 W. Der Gesamtwirkungsgrad ist 0,85 · 0,92 = 0,782.'],
      start: () => S('getriebe', {}, { value: null }), sol: () => S('getriebe', {}, { value: 600 * 0.85 * 0.92 }),
      check: askCheck(600 * 0.85 * 0.92, [[600 * 0.85, 'Du hast nur den Motorwirkungsgrad berücksichtigt. Das Getriebe verliert auch noch 8 %.'], [600 * 0.92, 'Du hast nur den Getriebewirkungsgrad berücksichtigt. Der Motor verliert auch noch 15 %.'], [600 * (0.85 + 0.92) / 2, 'Wirkungsgrade werden nicht gemittelt, sondern multipliziert.']]) },
    /* ------------------------------------------------------------ Gleichstrom und H-Brücke */
    { id: 'an5', lab: 'ant', cat: 'Gleichstrom und H-Brücke', title: 'Tastgrad für eine mittlere Spannung', level: 1, rig: 'gleichstrom',
      text: 'Das Netzteil der H-Brücke liefert 24 V. Der Motor soll im Mittel eine Spannung von 9 V bekommen. Den Spannungsabfall an den Brückenschaltern vernachlässigst du. Berechne den Tastgrad der PWM und gib ihn in Prozent an.',
      ask: { label: 'Tastgrad', unit: '%' },
      hint: ['Bei PWM sieht der Motor den Mittelwert der Spannung. Der Mittelwert hängt vom Anteil der Einschaltzeit an der Periode ab.', 'U_mittel = Tastgrad · U_Netzteil. Stelle die Formel nach dem Tastgrad um und gib das Ergebnis in Prozent an.', 'Tastgrad = 9 V / 24 V = 0,375 = 37,5 %.'],
      start: () => S('gleichstrom', {}, { value: null }), sol: () => S('gleichstrom', {}, { value: 37.5 }),
      check: askCheck(37.5, [[0.375, 'Du hast den Tastgrad als Anteil angegeben (0,375). Gefragt ist Prozent: mal 100.'], [62.5, 'Das ist der Anteil der Ausschaltzeit (100 % minus Tastgrad).'], [266.7, 'Du hast die Brüche vertauscht. Der Tastgrad ist höchstens 100 %.']]) },
    { id: 'an6', lab: 'ant', cat: 'Gleichstrom und H-Brücke', title: 'Zieldrehzahl mit PWM einstellen', level: 1, rig: 'gleichstrom',
      text: 'Der Getriebemotor am Gleichstrom-Prüfstand wird mit 12 V Betriebsspannung und seinem Nennlastmoment von 0,005 Nm betrieben. Bei vollem Tastgrad dreht er mit etwa 4700 1/min. Stelle im PWM-Betrieb den Tastgrad so ein, dass der Motor mit 3000 1/min dreht (Abweichung höchstens 5 %).',
      hint: ['Bei gleichbleibender Last ist die Drehzahl ungefähr proportional zur mittleren Spannung, also zum Tastgrad.', 'Der volle Tastgrad (100 %) gibt rund 4700 1/min. Du brauchst 3000 / 4700 davon. Probiere den Wert am Prüfstand aus und lies die Drehzahl am Messgerät ab.', 'Tastgrad ≈ 3000 / 4700 ≈ 0,64 bis 0,72. Mit 71 % läuft der Motor mit etwa 3000 1/min.'],
      start: () => S('gleichstrom', { mode: 'pwm', dir: 'vor', duty: 100, uSupply: 12, motor: 'getriebe12', load: 0.005 }), sol: () => S('gleichstrom', { mode: 'pwm', dir: 'vor', duty: 71, uSupply: 12, motor: 'getriebe12', load: 0.005 }),
      check: checkAn6 },
    { id: 'an7', lab: 'ant', cat: 'Gleichstrom und H-Brücke', title: 'Schaltfolge ohne Brückenkurzschluss', level: 2, rig: 'gleichstrom',
      text: 'Die H-Brücke wird von Hand geschaltet (Betriebsart manuell). Baue im Ablaufprogramm diese Folge auf: von 0 bis 2 s läuft der Motor vorwärts, von 2 bis 3 s wird er gebremst, von 3 bis 5 s läuft er rückwärts, ab 5 s sind alle Schalter aus. Dabei dürfen nie beide Schalter einer Seite (S1 und S2 oder S3 und S4) zugleich an sein, auch nicht für einen Augenblick. Die Startvorlage hat dort noch Fehler.',
      hint: ['Vorwärts, rückwärts und bremsen sind drei feste Schalterkombinationen. Bei jedem Wechsel musst du darauf achten, was kurz zwischendurch gleichzeitig an ist.', 'Vorwärts: S1 und S4. Bremsen: S2 und S4 (beide unten). Rückwärts: S2 und S3. Schalte beim Wechsel erst den Schalter aus, der gleich nicht mehr gebraucht wird, und erst danach den neuen ein.', 'Bei 0 s: S1 an, S4 an. Bei 2 s: S1 aus. Bei 2,1 s: S2 an (S2 und S4 = Bremsen). Bei 3 s: S4 aus. Bei 3,1 s: S3 an (S2 und S3 = rückwärts). Bei 5 s: S2 und S3 aus.'],
      start: () => S('gleichstrom', AN7_BASE, { dur: 6500, seq: [{ t: 0, set: { S1: true, S4: true } }, { t: 2000, set: { S2: true } }, { t: 3000, set: { S3: true } }, { t: 5000, set: { S1: false, S2: false, S3: false, S4: false } }] }),
      sol: () => S('gleichstrom', AN7_BASE, { dur: 6500, seq: [{ t: 0, set: { S1: true, S4: true } }, { t: 2000, set: { S1: false } }, { t: 2100, set: { S2: true } }, { t: 3000, set: { S4: false } }, { t: 3100, set: { S3: true } }, { t: 5000, set: { S2: false, S3: false } }] }),
      check: checkAn7 },
    { id: 'an8', lab: 'ant', cat: 'Gleichstrom und H-Brücke', title: 'Anlaufstrom mit Stufen begrenzen', level: 2, rig: 'gleichstrom',
      text: 'Der Getriebemotor (Nennstrom etwa 0,3 A, 12 V, Nennlast 0,005 Nm) wird im PWM-Betrieb gestartet. In der Startvorlage springt der Tastgrad sofort auf 100 %: Der Anlaufstrom ist mit über 1,2 A viel zu hoch, und die Anlage meldet Überstrom. Ändere das Ablaufprogramm so, dass die Stromspitze 0,75 A (das 2,5-fache des Nennstroms, darüber meldet die Anlage Überstrom) nicht überschreitet und der Motor spätestens nach 5 s mit 100 % Tastgrad läuft.',
      hint: ['Beim Anlauf ist die Gegenspannung noch null, deshalb begrenzt nur der Ankerwiderstand den Strom: I = U / R. Eine kleinere Spannung am Anfang gibt einen kleineren Strom.', 'Erhöhe den Tastgrad in mehreren kleinen Stufen mit etwas Zeit dazwischen (eine Rampe). Je kleiner die Stufe, desto kleiner die Stromspitze. Für 0,75 A genügen etwa vier gleich große Stufen.', 'Zum Beispiel: Tastgrad 25 % bei 0 s, 50 % bei 0,5 s, 75 % bei 1 s, 100 % bei 1,5 s. Alle Zeilen sind Steuerwert „duty“.'],
      start: () => S('gleichstrom', DC_PWM, { dur: 6000, seq: [{ t: 0, set: { duty: 100 } }] }),
      sol: () => S('gleichstrom', DC_PWM, { dur: 6000, seq: stairs('duty', 0, 100, 4, 0, 500) }),
      check: checkAn8 },
    { id: 'an9', lab: 'ant', cat: 'Gleichstrom und H-Brücke', title: 'Richtungsumkehr ohne Überstrom', level: 3, rig: 'gleichstrom',
      text: 'Ein Schlitten wird mit dem Getriebemotor (12 V, Nennlast 0,005 Nm, PWM-Betrieb) vorwärts gefahren. Die Startvorlage fährt den Motor in drei Stufen bis 60 % hoch und schaltet dann bei 2 s einfach die Richtung um: Dabei fließt ein sehr hoher Strom. Ändere das Ablaufprogramm so, dass der Motor erst anhält und danach rückwärts mit 60 % läuft, ohne dass die Anlage Überstrom meldet. Die Rückwärtsfahrt soll bis 9 s laufen.',
      hint: ['Beim Umschalten der Richtung dreht der Motor noch. Seine Gegenspannung addiert sich dann zur Betriebsspannung, und der Strom wird riesig.', 'Gehe in drei Schritten vor: Tastgrad auf 0, kurz warten, bis der Motor steht, die Richtung („dir“) auf rueck stellen und den Tastgrad wieder stufenweise hochfahren.', 'Bei 2 s: duty 0. Bei 3 s: dir = rueck. Bei 3,2 s: duty 20, bei 3,6 s: duty 40, bei 4 s: duty 60.'],
      start: () => S('gleichstrom', DC_PWM, { dur: 9000, seq: [{ t: 0, set: { duty: 20 } }, { t: 400, set: { duty: 40 } }, { t: 800, set: { duty: 60 } }, { t: 2000, set: { dir: 'rueck' } }] }),
      sol: () => S('gleichstrom', DC_PWM, { dur: 9000, seq: [{ t: 0, set: { duty: 20 } }, { t: 400, set: { duty: 40 } }, { t: 800, set: { duty: 60 } }, { t: 2000, set: { duty: 0 } }, { t: 3000, set: { dir: 'rueck' } }, { t: 3200, set: { duty: 20 } }, { t: 3600, set: { duty: 40 } }, { t: 4000, set: { duty: 60 } }] }),
      check: checkAn9 },
    /* ------------------------------------------------------------ Servo und Regelung */
    { id: 'an10', lab: 'ant', cat: 'Servo und Regelung', title: 'Überschwingen unter 10 Prozent', level: 2, rig: 'servo',
      text: 'Der Lageregler des Servos soll den Arm nach einem Sollwertsprung von 0° auf 20° fahren. Mit den Werten der Startvorlage (kp = 150, kd = 0) schießt der Arm um fast 20 % über das Ziel hinaus. Stelle kp, ki und kd so ein, dass das Überschwingen höchstens 10 % beträgt und der Arm nach 3 s auf 20° (±1°) steht. Der Arm hat keine Last.',
      hint: ['Ein reiner P-Regler mit großer Verstärkung treibt den Arm mit viel Schwung ans Ziel. Es fehlt eine Bremse, die vor dem Ziel wirkt.', 'Der D-Anteil (kd) bremst, wenn sich der Arm schnell bewegt. Erhöhe kd oder verkleinere kp. ki lässt du auf 0.', 'Zum Beispiel kp = 50, ki = 0, kd = 1: kein Überschwingen, der Arm steht nach 3 s auf 20°. Auch kp = 20 und kd = 0,2 funktioniert.'],
      start: () => S('servo', { mode: 'regler', setpoint: 0, kp: 150, ki: 0, kd: 0, load: 0 }), sol: () => S('servo', { mode: 'regler', setpoint: 0, kp: 50, ki: 0, kd: 1, load: 0 }),
      check: checkAn10 },
    { id: 'an11', lab: 'ant', cat: 'Servo und Regelung', title: 'Schnell und ruhig ausregeln', level: 2, rig: 'servo',
      text: 'Eine Kamera wird mit dem Servo in kleinen Schritten geschwenkt. Der Regler soll beim Sprung von 0° auf 20° schnell und ruhig arbeiten: Das Überschwingen soll höchstens 5 % betragen und die Ausregelzeit höchstens 0,15 s. Der Arm hat keine Last. Die Startvorlage (kp = 20, kd = 1) bleibt ruhig, ist dafür aber noch zu langsam (Ausregelzeit etwa 0,3 s).',
      hint: ['Schnell heißt: hohe Verstärkung kp. Ruhig heißt: genug Dämpfung durch kd. Beides musst du aufeinander abstimmen.', 'Erhöhe kp deutlich (zum Beispiel auf 50) und halte kd so groß, dass es nicht überschwingt. Lies Überschwingen und Ausregelzeit an den Messgeräten ab.', 'kp = 50, ki = 0, kd = 1 ergibt 0 % Überschwingen und etwa 0,1 s Ausregelzeit.'],
      start: () => S('servo', { mode: 'regler', setpoint: 0, kp: 20, ki: 0, kd: 1, load: 0 }), sol: () => S('servo', { mode: 'regler', setpoint: 0, kp: 50, ki: 0, kd: 1, load: 0 }),
      check: checkAn11 },
    { id: 'an12', lab: 'ant', cat: 'Servo und Regelung', title: 'Dauerfehler durch Gewicht beseitigen', level: 3, rig: 'servo',
      text: 'Am Arm des Servos hängt ein Gewicht, das ein Lastmoment von 0,3 Nm erzeugt. Mit dem reinen PD-Regler der Startvorlage (kp = 50, ki = 0, kd = 1) bleibt der Arm nach dem Sprung auf 20° dauerhaft um mehrere Grad daneben. Stelle den Regler so ein, dass der bleibende Fehler nach 4 s höchstens 0,5° beträgt, das Überschwingen höchstens 10 % und die Ausregelzeit höchstens 2 s.',
      hint: ['Ein P-Regler braucht einen Fehler, um überhaupt ein Moment gegen das Gewicht zu erzeugen. Dieser Fehler bleibt dauerhaft stehen.', 'Der I-Anteil summiert den Fehler auf und baut so lange Stellgröße auf, bis der Fehler null ist. Stelle ki auf einen deutlich größeren Wert (zum Beispiel über 30) und prüfe die Ausregelzeit.', 'kp = 50, ki = 60, kd = 1: Fehler unter 0,1°, Ausregelzeit etwa 1 s, kein Überschwingen. Mit ki = 30 dauert es mehr als 2 s.'],
      start: () => S('servo', { mode: 'regler', setpoint: 0, kp: 50, ki: 0, kd: 1, load: 0.3 }), sol: () => S('servo', { mode: 'regler', setpoint: 0, kp: 50, ki: 60, kd: 1, load: 0.3 }),
      check: checkAn12 },
    /* ------------------------------------------------------------ Schrittmotor */
    { id: 'an13', lab: 'ant', cat: 'Schrittmotor', title: 'Schrittfrequenz für eine Drehzahl', level: 1, rig: 'schritt',
      text: 'Der Schrittmotor hat 200 Schritte pro Umdrehung und wird im Vollschritt betrieben. Er soll mit einer Drehzahl von 300 1/min laufen. Berechne die Schrittfrequenz, die der Treiber dafür erzeugen muss. Gib das Ergebnis in Schritten pro Sekunde an.',
      ask: { label: 'Schrittfrequenz', unit: 'Schritte/s' },
      hint: ['Rechne zuerst aus, wie viele Umdrehungen der Motor pro Sekunde macht. Jede Umdrehung braucht eine feste Zahl von Schritten, die du dem Text entnimmst.', 'Umdrehungen pro Sekunde = n / 60. Multipliziere sie mit den 200 Schritten pro Umdrehung.', '300 1/min = 5 Umdrehungen pro Sekunde. Schrittfrequenz = 5 · 200 = 1000 Schritte pro Sekunde.'],
      start: () => S('schritt', {}, { value: null }), sol: () => S('schritt', {}, { value: 300 / 60 * 200 }),
      check: askCheck(1000, [[60000, 'Du hast n · 200 gerechnet. Die Drehzahl steht in 1/min: durch 60 teilen, um Umdrehungen pro Sekunde zu erhalten.'], [1.5, 'Du hast durch die Schrittzahl geteilt statt damit zu multiplizieren. Je Umdrehung brauchst du 200 Schritte.']]) },
    { id: 'an14', lab: 'ant', cat: 'Schrittmotor', title: 'Vollschritt-Muster von Hand schalten', level: 2, rig: 'schritt',
      text: 'Der Schrittmotor wird von Hand angesteuert (Betriebsart manuell, Spulen A1, A2, B1, B2). Er steht im Muster 1010 (A1 und B1 an). Baue im Ablaufprogramm die Vollschritt-Folge so auf, dass der Motor genau 4 Schritte vorwärts macht, also 7,2° dreht. Lasse zwischen den Mustern mindestens 0,3 s Zeit. Die Startvorlage geht die Muster in der falschen Richtung durch.',
      hint: ['Beim Vollschritt wechselt immer eine Spule ihre Stromrichtung. Nach vier Mustern ist eine volle elektrische Periode durchlaufen und das erste Muster kehrt wieder.', 'Die vorwärts gerichtete Folge ist 1010, 0110, 0101, 1001 und wieder 1010 (Stellung A1 A2 B1 B2). Setze für jedes Muster die vier Schalter in einer Zeile gleichzeitig.', 'Bei 0,5 s: A1 aus, A2 an (Muster 0110). Bei 1 s: B1 aus, B2 an (0101). Bei 1,5 s: A1 an, A2 aus (1001). Bei 2 s: B1 an, B2 aus (1010).'],
      start: () => S('schritt', { mode: 'manuell', stepMode: 'voll', A1: true, A2: false, B1: true, B2: false, load: 0.02 }, { dur: 4000, seq: [{ t: 500, set: { A1: true, A2: false, B1: false, B2: true } }, { t: 1000, set: { A1: false, A2: true, B1: false, B2: true } }, { t: 1500, set: { A1: false, A2: true, B1: true, B2: false } }, { t: 2000, set: { A1: true, A2: false, B1: true, B2: false } }] }),
      sol: () => S('schritt', { mode: 'manuell', stepMode: 'voll', A1: true, A2: false, B1: true, B2: false, load: 0.02 }, { dur: 4000, seq: [{ t: 500, set: { A1: false, A2: true, B1: true, B2: false } }, { t: 1000, set: { A1: false, A2: true, B1: false, B2: true } }, { t: 1500, set: { A1: true, A2: false, B1: false, B2: true } }, { t: 2000, set: { A1: true, A2: false, B1: true, B2: false } }] }),
      check: checkAn14 },
    { id: 'an15', lab: 'ant', cat: 'Schrittmotor', title: 'Positionswinkel im Halbschritt', level: 2, rig: 'schritt',
      text: 'Ein Stellglied soll vom Schrittmotor um genau 135° vorwärts gedreht werden. Der Treiber läuft 1,5 s lang (Schalter „Lauf (Takt an)“ an, danach aus). Die Startvorlage (Vollschritt, 100 Schritte pro Sekunde) dreht dabei 270°. Stelle den Treiber auf Halbschritt-Betrieb um und wähle die Schrittfrequenz so, dass die Welle nach 1,5 s auf 135° (±1°) steht, ohne Schritte zu verlieren.',
      hint: ['Im Halbschritt-Betrieb ist jeder Schritt nur halb so groß wie im Vollschritt. Das gibt die doppelte Auflösung.', 'Ein Halbschritt dreht 0,9°. Für 135° brauchst du 135 / 0,9 = 150 Schritte. Teile durch die Laufzeit 1,5 s, um die Schrittfrequenz zu erhalten.', 'Schrittart = Halbschritt, Schrittfrequenz = 150 / 1,5 s = 100 Schritte pro Sekunde.'],
      start: () => S('schritt', { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 100, current: 1, load: 0.05 }), sol: () => S('schritt', { mode: 'auto', stepMode: 'halb', dir: 'vor', rate: 100, current: 1, load: 0.05 }),
      check: checkAn15 },
    { id: 'an16', lab: 'ant', cat: 'Schrittmotor', title: 'Hohe Frequenz ohne Schrittverlust', level: 3, rig: 'schritt',
      text: 'Der Schrittmotor (NEMA 17) treibt im Vollschritt eine Last von 0,15 Nm. Er soll 3 s lang mit mindestens 400 Schritten pro Sekunde laufen, ohne dass er Schritte verliert. Der Treiber liefert höchstens 2,5 A. Die Startvorlage (400 Schritte pro Sekunde bei 1 A) verliert Schritte. Stelle Schrittfrequenz und Motorstrom richtig ein.',
      hint: ['Das Drehmoment des Schrittmotors fällt mit steigender Schrittfrequenz ab. Reicht es nicht mehr für die Last, springt der Rotor zurück.', 'Das Moment ist etwa proportional zum Strom; oberhalb des Nennstroms sättigt das Eisen und der Zuwachs wird kleiner. Mehr Strom hebt die Kurve (Pull-out) an, aber die Wicklung wird wärmer. Probiere am Prüfstand und beobachte den Zähler für verlorene Schritte.', 'Stelle die Schrittfrequenz auf 400 bis 500 Schritte pro Sekunde und den Strom auf etwa 2 A (mindestens 1,5 A, höchstens 2,5 A).'],
      start: () => S('schritt', { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 400, current: 1, load: 0.15 }), sol: () => S('schritt', { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 400, current: 2, load: 0.15 }),
      check: checkAn16 },
    /* ------------------------------------------------------------ Drehstrom */
    { id: 'an17', lab: 'ant', cat: 'Drehstrom', title: 'Schlupf vom Typenschild', level: 1, rig: 'drehstrom',
      text: 'Auf dem Typenschild eines 4-poligen Drehstrommotors steht eine Nenndrehzahl von 1420 1/min. Der Motor hängt am 50-Hz-Netz, die Drehfelddrehzahl (synchrone Drehzahl) beträgt also 1500 1/min. Berechne den Nennschlupf s und gib ihn in Prozent an.',
      ask: { label: 'Schlupf s', unit: '%' },
      hint: ['Der Läufer eilt dem Drehfeld immer etwas hinterher. Der Schlupf gibt an, um wie viel Prozent er langsamer ist. Du brauchst beide Drehzahlen.', 's = (n_s − n) / n_s. Setze die synchrone Drehzahl 1500 1/min und die Läuferdrehzahl 1420 1/min ein, und rechne mal 100 für Prozent.', 's = (1500 − 1420) / 1500 = 80 / 1500 = 0,0533 = 5,33 %.'],
      start: () => S('drehstrom', {}, { value: null }), sol: () => S('drehstrom', {}, { value: (1500 - 1420) / 1500 * 100 }),
      check: askCheck((1500 - 1420) / 1500 * 100, [[(1500 - 1420) / 1500, 'Du hast den Schlupf als Anteil angegeben. Gefragt ist Prozent: mal 100.'], [80 / 1420 * 100, 'Du hast durch die Läuferdrehzahl geteilt. Der Schlupf bezieht sich auf die synchrone Drehzahl 1500 1/min.'], [1420 / 1500 * 100, 'Das ist das Verhältnis n / n_s. Der Schlupf ist der fehlende Rest: 100 % minus dieser Wert.']]) },
    { id: 'an18', lab: 'ant', cat: 'Drehstrom', title: 'Drehzahl am Frequenzumrichter', level: 2, rig: 'drehstrom',
      text: 'Ein 4-poliger Drehstrommotor (zwei Polpaare) läuft am Frequenzumrichter mit einer Ausgangsfrequenz von 35 Hz. Bei dieser Last beträgt der Schlupf 4 %. Berechne die Drehzahl der Motorwelle in 1/min.',
      ask: { label: 'Wellendrehzahl n', unit: '1/min' },
      hint: ['Das Drehfeld dreht mit der Frequenz des Umrichters. Daraus bekommst du die synchrone Drehzahl, die Welle ist wegen des Schlupfs etwas langsamer.', 'n_s = 60 · f / p mit der Polpaarzahl p = 2. Danach n = n_s · (1 − s) mit s = 0,04.', 'n_s = 60 · 35 / 2 = 1050 1/min. n = 1050 · (1 − 0,04) = 1008 1/min.'],
      start: () => S('drehstrom', {}, { value: null }), sol: () => S('drehstrom', {}, { value: 60 * 35 / 2 * 0.96 }),
      check: askCheck(60 * 35 / 2 * 0.96, [[1050, 'Das ist die synchrone Drehzahl. Die Welle ist wegen des Schlupfs von 4 % langsamer.'], [60 * 35 * 0.96, 'Du hast durch p = 2 nicht geteilt: Die Polpaarzahl gehört in den Nenner.'], [1050 * 1.04, 'Der Schlupf macht die Welle langsamer, nicht schneller: n = n_s · (1 − s).']]) },
    { id: 'an19', lab: 'ant', cat: 'Drehstrom', title: 'Stern-Dreieck-Anlauf mit Pause', level: 2, rig: 'drehstrom',
      text: 'Der Drehstrommotor (1,5 kW, Nennstrom 3,4 A, Last 3 Nm) soll im Stern-Dreieck-Anlauf starten. Baue das Ablaufprogramm auf: Netzschütz K1 und Sternschütz K2 schalten ein, nach dem Hochlauf fällt K2 ab und nach einer kurzen Pause (mindestens 50 ms) zieht K3 an. K2 und K3 dürfen nie gleichzeitig an sein. Der Strom darf nie über das Dreifache des Nennstroms steigen. In der Startvorlage schaltet K3 ein, während K2 noch an ist.',
      hint: ['Im Stern liegt an jeder Wicklung nur die Spannung 400 V / √3. Der Anlaufstrom sinkt auf ein Drittel. Erst wenn der Motor fast Nenndrehzahl hat, schaltest du auf Dreieck.', 'Schalte zuerst K1 und K2 ein. Dann K2 aus. Dann (mit etwas Pause) K3 ein. Warte mit dem Umschalten, bis der Motor hochgelaufen ist: Dazu genügt etwa 1,5 s.', 'Bei 0 s: K1 an, K2 an. Bei 1,5 s: K2 aus. Bei 1,7 s: K3 an.'],
      start: () => S('drehstrom', { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, load: 3 }, { dur: 6000, seq: [{ t: 0, set: { K1: true, K2: true } }, { t: 1500, set: { K3: true } }] }),
      sol: () => S('drehstrom', { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, load: 3 }, { dur: 6000, seq: [{ t: 0, set: { K1: true, K2: true } }, { t: 1500, set: { K2: false } }, { t: 1700, set: { K3: true } }] }),
      check: checkAn19 },
    { id: 'an20', lab: 'ant', cat: 'Drehstrom', title: 'Frequenz für eine Zieldrehzahl', level: 2, rig: 'drehstrom',
      text: 'Ein Förderband wird mit dem Drehstrommotor (4-polig, Last 4 Nm) über den Frequenzumrichter betrieben. Das Band soll mit einer Wellendrehzahl von 900 1/min laufen (Abweichung höchstens 3 %). Wähle am Prüfstand die Speisung über den Frequenzumrichter, schalte ihn ein (K1) und stelle die passende Frequenz ein.',
      hint: ['Die Drehzahl ist fast proportional zur Frequenz. Bei 50 Hz hat das 4-polige Drehfeld 1500 1/min.', 'f = 900 / 1500 · 50 Hz = 30 Hz. Weil die Welle wegen des Schlupfs etwas langsamer ist als das Drehfeld, brauchst du ein klein wenig mehr. Schalte K1 ein und lies die Drehzahl ab.', 'Speisung = Frequenzumrichter, K1 an, Frequenz = 31 Hz: Die Welle dreht mit etwa 900 1/min.'],
      start: () => S('drehstrom', { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, freq: 50, ramp: 3, load: 4 }), sol: () => S('drehstrom', { source: 'fu', connection: 'dreieck', K1: true, K2: false, K3: false, freq: 31, ramp: 3, load: 4 }),
      check: checkAn20 },
    /* ------------------------------------------------------------ Getriebe */
    { id: 'an21', lab: 'ant', cat: 'Getriebe', title: 'Abtriebsdrehzahl eines Zahnradpaars', level: 1, rig: 'getriebe',
      text: 'Ein Stirnradgetriebe besteht aus einem treibenden Ritzel mit z1 = 18 Zähnen und einem getriebenen Rad mit z2 = 54 Zähnen. Die Eingangsdrehzahl beträgt 1500 1/min. Berechne die Drehzahl der Abtriebswelle in 1/min.',
      ask: { label: 'Abtriebsdrehzahl n_aus', unit: '1/min' },
      hint: ['Das kleine Ritzel muss sich mehrfach drehen, damit das große Rad einmal herumkommt. Das Rad dreht deshalb langsamer, das siehst du am Zähnezahlverhältnis.', 'Übersetzung i = z2 / z1. Die Abtriebsdrehzahl ist die Eingangsdrehzahl geteilt durch i.', 'i = 54 / 18 = 3. n_aus = 1500 / 3 = 500 1/min.'],
      start: () => S('getriebe', {}, { value: null }), sol: () => S('getriebe', {}, { value: 1500 / (54 / 18) }),
      check: askCheck(500, [[4500, 'Du hast mit i multipliziert. Ein größeres Abtriebsrad dreht langsamer: n_aus = n_ein / i.'], [1500 * 18 / 54 * 18 / 54, 'Du hast die Übersetzung zweimal angewendet.']]) },
    { id: 'an22', lab: 'ant', cat: 'Getriebe', title: 'Einstufiges Getriebe auslegen', level: 2, rig: 'getriebe',
      text: 'Ein Motor dreht mit 1500 1/min und soll über ein einstufiges Getriebe eine Trommel mit 500 1/min antreiben (Abweichung höchstens 2 %). Der Wirkungsgrad soll mindestens 90 % betragen. Stelle am Getriebe-Prüfstand die Getriebeart und die Zähnezahlen z1 (treibend) und z2 (getrieben) passend ein. Die Startvorlage hat die Zähnezahlen 20 und 40.',
      hint: ['Gesucht ist die Übersetzung i = n_ein / n_aus. Das Verhältnis der Zähnezahlen musst du genau so wählen.', 'i = 1500 / 500 = 3. Also muss z2 dreimal so groß sein wie z1. Ein Schneckengetriebe hat einen schlechten Wirkungsgrad, nimm Stirnrad oder Riemen.', 'Zum Beispiel Stirnrad mit z1 = 20 und z2 = 60 oder z1 = 18 und z2 = 54. Dann ist i = 3 und n_aus = 500 1/min.'],
      start: () => S('getriebe', { type: 'stirnrad', stages: 1, z1: 20, z2: 40, nIn: 1500, mIn: 2, load: 0 }), sol: () => S('getriebe', { type: 'stirnrad', stages: 1, z1: 20, z2: 60, nIn: 1500, mIn: 2, load: 0 }),
      check: checkAn22 },
    { id: 'an23', lab: 'ant', cat: 'Getriebe', title: 'Abtriebsmoment mit Wirkungsgrad', level: 2, rig: 'getriebe',
      text: 'Ein Getriebe hat die Übersetzung i = 4,5 und einen Wirkungsgrad von η = 0,95. Der Motor liefert am Getriebeeingang ein Drehmoment von 3,2 Nm. Berechne das Drehmoment an der Abtriebswelle in Newtonmeter.',
      ask: { label: 'Abtriebsmoment M_aus', unit: 'Nm' },
      hint: ['Ein Untersetzungsgetriebe tauscht Drehzahl gegen Moment. Die Verluste verringern das Moment am Ausgang etwas, das musst du einrechnen.', 'M_aus = M_ein · i · η. Alle drei Werte stehen in der Aufgabe.', 'M_aus = 3,2 Nm · 4,5 · 0,95 = 13,68 Nm.'],
      start: () => S('getriebe', {}, { value: null }), sol: () => S('getriebe', {}, { value: 3.2 * 4.5 * 0.95 }),
      check: askCheck(3.2 * 4.5 * 0.95, [[3.2 * 4.5, 'Du hast den Wirkungsgrad vergessen. Die Verluste verringern das Abtriebsmoment: mal η.'], [3.2 / 4.5 * 0.95, 'Du hast durch i geteilt. Bei einer Untersetzung (i größer als 1) steigt das Moment.']]) },
    /* ------------------------------------------------------------ Fehlersuche */
    { id: 'an24', lab: 'ant', cat: 'Fehlersuche', title: 'Motor dreht falsch herum', level: 1, rig: 'drehstrom',
      text: 'Ein neu angeschlossener Drehstrommotor treibt eine Pumpe an (Last 3 Nm). Er läuft, aber in die falsche Richtung: Die Pumpe fördert nichts, weil sie linksherum dreht. Am Prüfstand ist das der Schalter „Drehrichtung links“. Behebe den Fehler so, dass der Motor rechtsherum (positive Drehzahl) mit voller Drehzahl läuft und die Anlage keinen Fehler meldet.',
      hint: ['Beim Drehstrommotor bestimmt die Reihenfolge der Außenleiter die Drehrichtung des Drehfelds. Das Vorzeichen der Drehzahl am Messgerät zeigt dir die Richtung.', 'Zum Umkehren der Drehrichtung vertauscht man zwei beliebige Außenleiter. Am Prüfstand entspricht das dem Schalter „Drehrichtung links“. Er steht in der Startvorlage fälschlich an.', 'Schalte „Drehrichtung links“ aus, K1 bleibt an. Der Motor läuft dann mit etwa 1476 1/min rechts herum.'],
      start: () => S('drehstrom', { source: 'netz', connection: 'dreieck', K1: true, K2: false, K3: false, reverse: true, load: 3 }), sol: () => S('drehstrom', { source: 'netz', connection: 'dreieck', K1: true, K2: false, K3: false, reverse: false, load: 3 }),
      check: checkAn24 },
    { id: 'an25', lab: 'ant', cat: 'Fehlersuche', title: 'Motor brummt und läuft nicht an', level: 2, rig: 'drehstrom',
      text: 'Ein Drehstrommotor an einer Lüftung (Last 3 Nm) brummt laut, läuft nicht an und wird schnell heiß. Ein Prüfer misst an den Klemmen nur zwei Phasen mit Spannung, die dritte Sicherung ist durchgebrannt. Am Prüfstand heißt der Fehler „Phasenausfall“. Behebe die Ursache so, dass der Motor normal anläuft, seine Nenndrehzahl erreicht und kühl bleibt.',
      hint: ['Ein Drehstrommotor braucht alle drei Außenleiter, damit ein Drehfeld entsteht. Fehlt eine Phase, gibt es nur ein Wechselfeld und kein Anlaufmoment.', 'Der Strom steigt, weil die Wicklung kein Drehfeld bekommt, und das Brummen kommt vom Wechselfeld. Beseitige den Fehler an der Ursache, nicht an den Folgen.', 'Schalte den Fehler „Phasenausfall“ aus (neue Sicherung eingesetzt), K1 bleibt an. Der Motor läuft dann an und hält seine Nenndrehzahl.'],
      start: () => S('drehstrom', { source: 'netz', connection: 'dreieck', K1: true, K2: false, K3: false, reverse: false, phaseLoss: true, load: 3 }), sol: () => S('drehstrom', { source: 'netz', connection: 'dreieck', K1: true, K2: false, K3: false, reverse: false, phaseLoss: false, load: 3 }),
      check: checkAn25 },
    { id: 'an26', lab: 'ant', cat: 'Fehlersuche', title: 'Getriebe wird heiß', level: 2, rig: 'getriebe',
      text: 'Ein Stirnradgetriebe (20 zu 40 Zähne) läuft im Dauerbetrieb mit 1500 1/min am Eingang und 10 Nm Eingangsmoment. Nach einer halben Minute riecht es verbrannt, das Gehäuse ist über 90 °C heiß und die Anlage meldet Überhitzung. Finde die Ursache und behebe sie so, dass das Getriebe im Dauerbetrieb (40 s) kühl bleibt. Eingangsdrehzahl und Eingangsmoment bleiben unverändert.',
      hint: ['Wenn ein Getriebe bei normaler Last zu heiß wird, entsteht zu viel Reibung. Beobachte Temperatur und Wirkungsgrad am Prüfstand und prüfe die Einstellungen des Getriebes.', 'Es fehlt die Schmierung. Ohne Schmierfilm reiben die Zahnflanken aufeinander, die Verluste steigen stark.', 'Schalte den Schalter „Schmierung“ ein. Das Getriebe bleibt dann unter 50 °C.'],
      start: () => S('getriebe', { type: 'stirnrad', stages: 1, z1: 20, z2: 40, nIn: 1500, mIn: 10, load: 0, lube: false }), sol: () => S('getriebe', { type: 'stirnrad', stages: 1, z1: 20, z2: 40, nIn: 1500, mIn: 10, load: 0, lube: true }),
      check: checkAn26 },
    { id: 'an27', lab: 'ant', cat: 'Fehlersuche', title: 'Schrittmotor verliert Schritte', level: 2, rig: 'schritt',
      text: 'Ein Schrittmotor (NEMA 17) bewegt einen Schlitten mit einer Last von 0,2 Nm. Die Positionierung stimmt nach einigen Fahrten nicht mehr, der Zähler für verlorene Schritte läuft. Der Treiber ist auf 400 Schritte pro Sekunde und 1 A eingestellt. Behebe den Fehler so, dass der Motor 2 s lang mit mindestens 100 Schritten pro Sekunde läuft und keinen Schritt verliert. Der Treiber liefert höchstens 2,5 A.',
      hint: ['Das Drehmoment eines Schrittmotors sinkt mit der Schrittfrequenz. Ist die Last größer als das verfügbare Moment, rutscht der Rotor und Schritte gehen verloren.', 'Es gibt zwei Wege: die Frequenz verringern oder den Strom erhöhen (mehr Strom gibt mehr Moment). Die Wicklung darf dabei nicht zu heiß werden.', 'Zum Beispiel Schrittfrequenz 100 Schritte pro Sekunde bei 1 A. Oder Strom 2 A bei 300 Schritten pro Sekunde.'],
      start: () => S('schritt', { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 400, current: 1, load: 0.2 }), sol: () => S('schritt', { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 100, current: 1, load: 0.2 }),
      check: checkAn27 },
    /* ------------------------------------------------------------ Prüfungsstil */
    { id: 'an28', lab: 'ant', cat: 'Prüfungsstil', title: 'Typenschild lesen: Wirkungsgrad', level: 2, rig: 'drehstrom',
      text: 'Auf dem Typenschild eines Drehstrommotors steht: 3 ~ Motor, 400 V (Dreieck) / 690 V (Stern), 4,6 A (bei 400 V), 2,2 kW, cos φ 0,81, 1435 1/min, 50 Hz. Berechne den Wirkungsgrad η bei Nennbetrieb am 400-V-Netz. Gib ihn in Prozent an.',
      ask: { label: 'Wirkungsgrad η', unit: '%' },
      hint: ['Die Leistung auf dem Typenschild ist die abgegebene mechanische Leistung. Die aufgenommene elektrische Leistung musst du aus Spannung, Strom und cos φ berechnen.', 'P_zu = √3 · U · I · cos φ (Drehstrom, Leiterspannung 400 V, Leiterstrom 4,6 A). Danach η = P_ab / P_zu · 100 %.', 'P_zu = 1,732 · 400 V · 4,6 A · 0,81 = 2581 W. η = 2200 W / 2581 W = 0,852 = 85,2 %.'],
      start: () => S('drehstrom', {}, { value: null }), sol: () => S('drehstrom', {}, { value: 2200 / (Math.sqrt(3) * 400 * 4.6 * 0.81) * 100 }),
      check: askCheck(2200 / (Math.sqrt(3) * 400 * 4.6 * 0.81) * 100, [[2200 / (400 * 4.6 * 0.81) * 100, 'Du hast den Verkettungsfaktor √3 vergessen. Die Leistung im Drehstromnetz ist P = √3 · U · I · cos φ.'], [2200 / (Math.sqrt(3) * 400 * 4.6) * 100, 'Du hast den Leistungsfaktor cos φ vergessen. Nur der Wirkanteil der Scheinleistung ist die Wirkleistung.'], [Math.sqrt(3) * 400 * 4.6 * 0.81 / 2200 * 100, 'Du hast die Brüche vertauscht. Der Wirkungsgrad ist abgegebene durch aufgenommene Leistung.']]) },
    { id: 'an29', lab: 'ant', cat: 'Prüfungsstil', title: 'Typenschild lesen: Nennmoment', level: 2, rig: 'drehstrom',
      text: 'Ein Drehstrommotor hat laut Typenschild eine Nennleistung von 2,2 kW bei 1435 1/min. Er soll eine Maschine antreiben, die im Dauerbetrieb 15 Nm benötigt. Berechne das Nennmoment M_N des Motors und gib es in Newtonmeter an. Entscheide danach selbst, ob der Motor für die Maschine ausreicht.',
      ask: { label: 'Nennmoment M_N', unit: 'Nm' },
      hint: ['Die Nennleistung ist die Wellenleistung bei der Nenndrehzahl. Aus beiden Werten bekommst du das Moment.', 'M_N = P_N / (2π · n_N / 60). Rechne die Leistung in Watt und die Drehzahl in 1/min ein.', 'ω = 2π · 1435 / 60 = 150,3 rad/s. M_N = 2200 W / 150,3 rad/s = 14,64 Nm. Das ist etwas weniger als die geforderten 15 Nm: Der Motor wäre im Dauerbetrieb leicht überlastet.'],
      start: () => S('drehstrom', {}, { value: null }), sol: () => S('drehstrom', {}, { value: 2200 / (2 * Math.PI * 1435 / 60) }),
      check: askCheck(2200 / (2 * Math.PI * 1435 / 60), [[2.2 / (2 * Math.PI * 1435 / 60), 'Die Leistung muss in Watt eingesetzt werden (2,2 kW = 2200 W).'], [2200 / 1435, 'Du hast P / n gerechnet. Die Drehzahl muss erst in ω = 2π · n / 60 umgerechnet werden.']]) },
    { id: 'an30', lab: 'ant', cat: 'Prüfungsstil', title: 'Hubwerk: zweistufiges Getriebe auslegen', level: 3, rig: 'getriebe',
      text: 'Für ein Hubwerk dreht ein Motor mit 1500 1/min und liefert 1,5 Nm. Die Seiltrommel soll mit 100 1/min (±5 %) laufen und ein Moment von mindestens 20 Nm abgeben. Der Gesamtwirkungsgrad des Getriebes soll mindestens 90 % betragen. Lege das Getriebe am Prüfstand aus: Getriebeart, Stufenzahl und die Zähnezahlen z1 bis z4. Beachte, dass die Zähnezahlen nur zwischen 8 und 80 liegen können.',
      hint: ['Aus den Drehzahlen bekommst du die Gesamtübersetzung. Bei zwei Stufen multiplizieren sich die Einzelübersetzungen. Eine Stufe allein schafft bei Zähnezahlen von 8 bis 80 höchstens i = 10.', 'i_ges = 1500 / 100 = 15 = i1 · i2 mit i1 = z2 / z1 und i2 = z4 / z3. Teile zum Beispiel 15 in 3 · 5. Schnecke fällt wegen des Wirkungsgrads weg: nimm Stirnräder.', 'Stirnrad, 2 Stufen, z1 = 20, z2 = 60 (i1 = 3), z3 = 16, z4 = 80 (i2 = 5). Dann ist n_aus = 100 1/min und M_aus ≈ 1,5 Nm · 15 · 0,94 = 21 Nm.'],
      start: () => S('getriebe', { type: 'stirnrad', stages: 1, z1: 20, z2: 60, z3: 20, z4: 40, nIn: 1500, mIn: 1.5, load: 0 }), sol: () => S('getriebe', { type: 'stirnrad', stages: 2, z1: 20, z2: 60, z3: 16, z4: 80, nIn: 1500, mIn: 1.5, load: 0 }),
      check: checkAn30 }
  ];

  /* ====================================================================== Beispiele */
  const E = (id, name, cat, rig, desc, controls, extra) => Object.assign({ id, name, cat, rig, desc, controls }, extra || {});
  const SD_SEQ = [{ t: 200, set: { K1: true, K2: true } }, { t: 2000, set: { K2: false } }, { t: 2200, set: { K3: true } }];
  const examples = [
    /* Gleichstrom */
    E('dc-pwm', 'PWM: Tastgrad und Drehzahl', 'Gleichstrom', 'gleichstrom',
      'Der Tastgrad steigt alle 2 Sekunden um eine Stufe von 25 auf 100 %. Der Motor sieht im Mittel nur den entsprechenden Anteil der 12 V, die Drehzahl wächst fast gleichmäßig mit. Lies Drehzahl und mittlere Motorspannung an den Messgeräten ab.',
      { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12, motor: 'getriebe12', load: 0, freq: 5000 },
      { dur: 8000, seq: [{ t: 0, set: { duty: 25 } }, { t: 2000, set: { duty: 50 } }, { t: 4000, set: { duty: 75 } }, { t: 6000, set: { duty: 100 } }] }),
    E('dc-hbruecke', 'H-Brücke von Hand: vor, bremsen, zurück', 'Gleichstrom', 'gleichstrom',
      'Die vier Schalter werden nacheinander so geschaltet, dass der Motor vorwärts läuft, gebremst wird und rückwärts läuft. Zwischen den Kombinationen wird immer erst ein Schalter ausgeschaltet, dann der nächste eingeschaltet, damit nie ein Brückenkurzschluss entsteht. Beim Start aus dem Stand warnt die Anlage vor dem hohen Anlaufstrom.',
      { mode: 'manuell', S1: false, S2: false, S3: false, S4: false, uSupply: 12, load: 0.005 },
      { dur: 6500, seq: [{ t: 0, set: { S1: true, S4: true } }, { t: 2000, set: { S1: false } }, { t: 2100, set: { S2: true } }, { t: 3000, set: { S4: false } }, { t: 3100, set: { S3: true } }, { t: 5000, set: { S2: false, S3: false } }] }),
    E('dc-rampe', 'H-Brücke mit Rampe: sanfter Anlauf', 'Gleichstrom', 'gleichstrom',
      'Der Tastgrad wird in zehn Stufen von 10 auf 100 % erhöht. Dadurch bleibt der Anlaufstrom klein, und die Anlage meldet keinen Überstrom. Vergleiche das mit dem Beispiel, in dem der Tastgrad sofort auf 100 % springt.',
      { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12, motor: 'getriebe12', load: 0.005, freq: 5000 },
      { dur: 6000, seq: stairs('duty', 0, 100, 10, 0, 300) }),
    E('dc-umkehr', 'Richtungsumkehr mit Pause', 'Gleichstrom', 'gleichstrom',
      'Der Motor fährt in drei Stufen auf 60 % hoch, wird auf 0 zurückgenommen und kommt zum Stillstand. Dann wird die Richtung gewechselt und er fährt wieder in Stufen hoch. So bleibt der Strom beim Umkehren klein.',
      { mode: 'pwm', dir: 'vor', duty: 0, uSupply: 12, motor: 'getriebe12', load: 0.005, freq: 5000 },
      { dur: 9000, seq: [{ t: 0, set: { duty: 20 } }, { t: 400, set: { duty: 40 } }, { t: 800, set: { duty: 60 } }, { t: 2000, set: { duty: 0 } }, { t: 3000, set: { dir: 'rueck' } }, { t: 3200, set: { duty: 20 } }, { t: 3600, set: { duty: 40 } }, { t: 4000, set: { duty: 60 } }] }),
    E('dc-kurz', 'Fehler: Brückenkurzschluss', 'Gleichstrom', 'gleichstrom',
      'S1 und S2 sind gleichzeitig geschlossen: Die beiden Schalter einer Seite schließen das Netzteil kurz. Das Netzteil bricht zusammen und begrenzt den Strom, die Anlage zeigt eine Fehlermeldung.',
      { mode: 'manuell', S1: true, S2: true, S3: false, S4: false, uSupply: 12, load: 0 }, { dur: 3000 }),
    E('dc-heiss', 'Blockiert: der Motor wird heiß', 'Gleichstrom', 'gleichstrom',
      'Die Last ist größer als das Anlaufmoment, der Motor steht und zieht dauernd den hohen Blockierstrom. Die Wicklung erwärmt sich, bis nach etwa 10 Sekunden der Thermoschalter bei 130 °C abschaltet. Lies Temperatur und Strom am Messgerät ab.',
      { mode: 'pwm', dir: 'vor', duty: 100, uSupply: 12, motor: 'getriebe12', load: 0.031 }, { dur: 15000 }),
    /* Servo */
    E('servo-rc', 'Modellbau-Servo: Pulsbreite und Winkel', 'Servo', 'servo',
      'Das Steuersignal des Servos ist ein Puls alle 20 Millisekunden. Die Pulsbreite 0,5 ms gibt etwa −90°, 1,5 ms die Mitte und 2,5 ms etwa +90°. Der Ablauf fährt die drei Stellungen nacheinander an.',
      { mode: 'rc', pulse: 1.5, period: 20, load: 0 },
      { dur: 8000, seq: [{ t: 0, set: { pulse: 1.5 } }, { t: 2000, set: { pulse: 0.5 } }, { t: 4000, set: { pulse: 2.5 } }, { t: 6000, set: { pulse: 1.5 } }] }),
    E('servo-pd', 'Lageregler: gute Sprungantwort', 'Servo', 'servo',
      'Der Sollwinkel springt von 0° auf 30°. Mit kp = 20 und kd = 1 erreicht der Arm das Ziel ohne Überschwingen. Beobachte Überschwingen und Ausregelzeit an den Messgeräten.',
      { mode: 'regler', setpoint: 0, kp: 20, ki: 0, kd: 1, load: 0 },
      { dur: 4000, seq: [{ t: 500, set: { setpoint: 30 } }] }),
    E('servo-schwing', 'Zu hohes kp: Überschwingen', 'Servo', 'servo',
      'Mit sehr hohem kp und ohne D-Anteil schießt der Arm über das Ziel hinaus und schwingt nach. Die Anlage meldet, dass der Regelkreis schwingt. Erhöhe kd oder verkleinere kp, dann beruhigt sich der Arm.',
      { mode: 'regler', setpoint: 0, kp: 200, ki: 0, kd: 0, load: 0 },
      { dur: 4000, seq: [{ t: 500, set: { setpoint: 20 } }] }),
    E('servo-last', 'Last und I-Anteil: Dauerfehler verschwindet', 'Servo', 'servo',
      'Ein Gewicht von 0,3 Nm zieht am Arm. Zuerst regelt nur der P- und D-Anteil, und der Arm bleibt dauerhaft rund 3,5° vom Ziel entfernt. Bei 3 s kommt der I-Anteil dazu und beseitigt den Fehler fast vollständig.',
      { mode: 'regler', setpoint: 0, kp: 50, ki: 0, kd: 1, load: 0.3 },
      { dur: 7000, seq: [{ t: 500, set: { setpoint: 20 } }, { t: 3000, set: { ki: 60 } }] }),
    /* Schrittmotor */
    E('step-modi', 'Vollschritt, Halbschritt und Wave-Drive', 'Schrittmotor', 'schritt',
      'Der Motor läuft nacheinander dreimal eine Sekunde lang mit 100 Schritten pro Sekunde, jeweils in einer anderen Schrittart. Im Vollschritt entspricht das einer halben Umdrehung, im Halbschritt nur einer Viertelumdrehung. Beim Wave-Drive ist das Haltemoment kleiner.',
      { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 100, current: 1, load: 0.05, run: false },
      { dur: 6500, seq: [{ t: 0, set: { run: true } }, { t: 1000, set: { run: false } }, { t: 1500, set: { stepMode: 'halb' } }, { t: 2000, set: { run: true } }, { t: 3000, set: { run: false } }, { t: 3500, set: { stepMode: 'wave' } }, { t: 4000, set: { run: true } }, { t: 5000, set: { run: false } }] }),
    E('step-pos', 'Positionierung: 270 Grad anfahren', 'Schrittmotor', 'schritt',
      'Ein Schrittmotor fährt im Vollschritt mit 100 Schritten pro Sekunde 1,5 Sekunden lang. Das sind 150 Schritte zu je 1,8°, also genau 270°. Danach hält er die Position, solange der Strom fließt.',
      { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 100, current: 1, load: 0.05, run: false },
      { dur: 4000, seq: [{ t: 500, set: { run: true } }, { t: 2000, set: { run: false } }] }),
    E('step-verlust', 'Fehler: Schrittverlust bei hoher Frequenz', 'Schrittmotor', 'schritt',
      'Bei 600 Schritten pro Sekunde und 0,15 Nm Last reicht das Moment des Motors nicht mehr, der Rotor kommt nicht mehr mit dem Drehfeld mit. Der Zähler für verlorene Schritte läuft, und die Lage stimmt nicht mehr. Senke die Frequenz oder erhöhe den Strom.',
      { mode: 'auto', stepMode: 'voll', dir: 'vor', rate: 600, current: 1, load: 0.15, run: false },
      { dur: 3000, seq: [{ t: 200, set: { run: true } }] }),
    /* Drehstrom */
    E('ac-direkt', 'Direktanlauf: hohe Stromspitze', 'Drehstrom', 'drehstrom',
      'Der Motor wird im Dreieck direkt ans Netz geschaltet. Im Moment des Einschaltens fließt etwa das Sechsfache des Nennstroms, dann sinkt der Strom beim Hochlauf. Vergleiche die Spitze mit dem Stern-Dreieck-Anlauf.',
      { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, load: 3 },
      { dur: 4000, seq: [{ t: 200, set: { K1: true } }] }),
    E('ac-sd', 'Stern-Dreieck-Anlauf mit Ablaufprogramm', 'Drehstrom', 'drehstrom',
      'K1 und K2 schalten den Motor im Stern ein, der Anlaufstrom ist nur etwa ein Drittel des Direktanlaufstroms (hier rund 7 A statt 20 A). Nach dem Hochlauf fällt K2 ab, und kurz danach zieht K3 an: Der Motor läuft im Dreieck weiter. K2 und K3 sind nie gleichzeitig an.',
      { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, load: 3 }, { dur: 6000, seq: SD_SEQ }),
    E('ac-fu', 'Frequenzumrichter: Rampe und Drehzahl', 'Drehstrom', 'drehstrom',
      'Der Umrichter fährt den Motor erst auf 25 Hz, bei 5 Sekunden dann auf 50 Hz. Die Drehzahl folgt der Frequenz, der Strom bleibt dabei klein. Das Messgerät für die Frequenz am Motor zeigt die Rampe.',
      { source: 'fu', connection: 'dreieck', K1: false, K2: false, K3: false, freq: 25, ramp: 3, load: 3 },
      { dur: 10000, seq: [{ t: 200, set: { K1: true } }, { t: 5000, set: { freq: 50 } }] }),
    E('ac-kipp', 'Fehler: Kippmoment überschritten', 'Drehstrom', 'drehstrom',
      'Die Last von 25 Nm ist größer als das Kippmoment dieses 1,5-kW-Motors. Er läuft nicht an, brummt und nimmt dauernd den hohen Anlaufstrom auf, bis die Wicklung zu heiß wird. Ein größerer Motor oder weniger Last behebt das.',
      { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, load: 25 },
      { dur: 10000, seq: [{ t: 200, set: { K1: true } }] }),
    E('ac-phase', 'Fehler: Phasenausfall', 'Drehstrom', 'drehstrom',
      'Eine der drei Phasen fehlt (zum Beispiel durch eine durchgebrannte Sicherung). Der Motor bekommt nur ein Wechselfeld, brummt, läuft nicht an und zieht einen hohen Strom. Schalte „Phasenausfall“ aus, dann läuft er normal.',
      { source: 'netz', connection: 'dreieck', K1: false, K2: false, K3: false, load: 3, phaseLoss: true },
      { dur: 8000, seq: [{ t: 200, set: { K1: true } }] }),
    /* Getriebe */
    E('gear-stirn', 'Stirnradpaar 20 zu 60', 'Getriebe', 'getriebe',
      'Ritzel mit 20 Zähnen und Rad mit 60 Zähnen ergeben die Übersetzung i = 3. Die Drehzahl sinkt von 1500 auf 500 1/min, das Moment steigt auf etwa das Dreifache (abzüglich der Verluste). Die Drehrichtung kehrt sich um.',
      { type: 'stirnrad', stages: 1, z1: 20, z2: 60, nIn: 1500, mIn: 2, load: 0, lube: true }, { dur: 3000 }),
    E('gear-schnecke', 'Schneckengetriebe: große Untersetzung', 'Getriebe', 'getriebe',
      'Eine eingängige Schnecke mit einem Rad aus 30 Zähnen ergibt die Übersetzung 30 auf kleinem Raum. Der Wirkungsgrad ist aber nur etwa 50 %, ein großer Teil der Leistung wird in Wärme umgesetzt. Dafür ist das Getriebe selbsthemmend.',
      { type: 'schnecke', stages: 1, z1: 1, z2: 30, nIn: 3000, mIn: 2, load: 0, lube: true }, { dur: 5000 }),
    E('gear-zweistufig', 'Auslegung: zweistufig mit i = 15', 'Getriebe', 'getriebe',
      'Zwei Stirnradstufen mit i = 3 und i = 5 ergeben die Gesamtübersetzung 15: Aus 1500 1/min werden 100 1/min, aus 1,5 Nm werden über 20 Nm. Der Wirkungsgrad ist das Produkt der beiden Stufen, hier etwa 94 %.',
      { type: 'stirnrad', stages: 2, z1: 20, z2: 60, z3: 16, z4: 80, nIn: 1500, mIn: 1.5, load: 0, lube: true }, { dur: 3000 }),
    E('gear-trocken', 'Fehler: Getriebe ohne Schmierung', 'Getriebe', 'getriebe',
      'Ohne Schmierfilm steigt die Reibung stark an und der Wirkungsgrad sinkt. Das Getriebe erwärmt sich im Dauerbetrieb, bis nach etwa einer halben Minute die Überhitzungsmeldung kommt. Schalte die Schmierung ein, dann bleibt es kühl.',
      { type: 'stirnrad', stages: 1, z1: 20, z2: 40, nIn: 1500, mIn: 10, load: 0, lube: false }, { dur: 40000 })
  ];

  /* ====================================================================== Ausführung, Selbsttest */
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));
  const ANT_TASKS = {
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
    return { rig: o.rig || task.rig, controls: o.controls || {}, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, value: fin(o.value) ? o.value : null, text: '' };
  }
  root.ANT_DATA = { examples };
  root.ANT_TASKS = ANT_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await ANT_TASKS.run(t, answerOf(t, t.start()))), L = await ANT_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };
  if (typeof module !== 'undefined') module.exports = { examples, tasks, run, answerOf, clean };
})(typeof window !== 'undefined' ? window : globalThis);
