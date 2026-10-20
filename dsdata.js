/* dsdata.js - Datenblatt-Lab: Beispiele und Aufgaben mit automatischer Prüfung (ohne Browser lauffähig)
 * window.DS_DATA  = { examples: [ { id, name, cat, desc, ds, tab?, focus?, calc?, mode?, steps[], rechne() } ] }
 * window.DS_TASKS = { tasks: [ { id, lab:'ds', cat, title, level, ds, text, hint[3], ask?, start(), sol(), check(answer) } ], run(task, answer) }
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 * Benötigt: dscore.js (DS_CORE) und beide Bibliotheken (dslib-semi.js, dslib-ic.js). Alle Zielwerte werden beim Prüfen aus den
 * Übungsdatenblättern berechnet (nichts ist fest verdrahtet); die Prüfung läuft headless mit DS_CORE und DS_LIB.
 * answer (wie dsui.js collectAnswer): { ds, tab, value:(Zahl|null), text, choice:(Index|null), choiceText, calc:{id,vals,res[{label,value,unit}]},
 *   marks:[{ds,section,key}], reads:[{graphId,series,x,y}], lastRead, readsN }
 * start() und sol() liefern den Oberflächenzustand { ds, tab?, focus?, calc?, mode? } (sol() zusätzlich value, choice, marks, reads, calcAns für den Selbsttest).
 * Zahlenaufgaben: ask = { label, unit }, Auswahlaufgaben: ask = { label, choices:[...] }. Prüfzeilen { ok, text, why }. */
(function (root) {
  'use strict';

  /* ====================================================================== Hilfen */
  const CORE = () => root.DS_CORE, LIB = () => root.DS_LIB;
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const fm = (x, d) => { if (!fin(x)) return '?'; const s = String(Number(x.toPrecision(d || 4))); return s.replace('.', ','); };
  const dsOf = id => { const l = LIB(); return l && l.byId && Object.prototype.hasOwnProperty.call(l.byId, id) ? l.byId[id] : null; };
  const rowOf = (d, sec, key) => (d && Array.isArray(d[sec]) ? d[sec].find(r => r && r.key === key) : null) || null;
  const graphOf = (d, id) => (d && Array.isArray(d.graphs) ? d.graphs.find(g => g && g.id === id) : null) || null;
  const graphIdx = (dsId, gid) => { const d = dsOf(dsId); return d && d.graphs ? Math.max(0, d.graphs.findIndex(g => g.id === gid)) : 0; };
  const si = (v, unit) => CORE().toSI(v, unit);
  const siRow = (d, sec, key, f) => { const r = rowOf(d, sec, key); if (!r || !fin(r[f])) throw new Error('Zeile ' + sec + '.' + key + '.' + f + ' fehlt'); return si(r[f], r.unit); };
  const val = (d, sec, key, f) => { const r = rowOf(d, sec, key); if (!r || !fin(r[f])) throw new Error('Zeile ' + sec + '.' + key + '.' + f + ' fehlt'); return r[f]; };
  const need = id => { const d = dsOf(id); if (!d) throw new Error('Datenblatt ' + id + ' fehlt'); return d; };
  const readC = (dsId, gid, ser, x) => { const g = graphOf(need(dsId), gid), v = CORE().readCurve(g, ser, x); if (!fin(v)) throw new Error('Kennlinie nicht lesbar'); return v; };
  const invC = (dsId, gid, ser, y) => { const g = graphOf(need(dsId), gid), v = CORE().inverse(g, ser, y); if (!fin(v)) throw new Error('Kennlinie nicht umkehrbar'); return v; };
  const parseNum = s => { const m = String(s).replace(/\s/g, '').replace(/[−–]/g, '-').replace(',', '.').match(/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i); return m ? parseFloat(m[0]) : NaN; };
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

  /* Zahl aus der Antwort: bevorzugt der Text (mit Einheit, k, M ...), sonst das Zahlenfeld */
  function numAns(a, unit) {
    if (!isObj(a)) return null;
    const t = typeof a.text === 'string' ? a.text.trim() : '';
    if (t) {
      let p = null;
      try { p = CORE().parseWithUnit(t); } catch (e) { p = null; }
      if (p && fin(p.value)) {
        let f = 1, base = '';
        if (unit) { try { const s = CORE().splitUnit(unit, true); if (s) { base = s.base; f = CORE().toSI(1, unit); } } catch (e) { f = 1; } }
        if (unit && base && p.unit && p.unit === base && fin(f) && f > 0) return p.value / f;
        if (unit && base && !p.unit && /[kKMGmµμunp]\s*$/.test(t) && fin(f) && f > 0) return p.value / f;
        if (!p.unit || !unit || !base) return p.value;
      }
      const n = parseNum(t);
      if (fin(n)) return n;
    }
    if (fin(a.value)) return a.value;
    if (typeof a.value === 'string') { const n = parseNum(a.value); if (fin(n)) return n; }
    return null;
  }
  function choiceIdx(a, choices) {
    if (!isObj(a) || !Array.isArray(choices)) return -1;
    if (fin(a.choice) && a.choice % 1 === 0 && a.choice >= 0 && a.choice < choices.length) return a.choice;
    const t = norm(a.choiceText || a.text);
    return t ? choices.findIndex(c => norm(c) === t) : -1;
  }
  const marksOf = a => (isObj(a) && Array.isArray(a.marks) ? a.marks : []).filter(m => isObj(m) && typeof m.section === 'string' && m.key != null).map(m => ({ ds: m.ds, section: m.section, key: String(m.key) }));
  const readsOf = a => {
    if (!isObj(a)) return [];
    const l = Array.isArray(a.reads) ? a.reads.slice() : [];
    if (isObj(a.lastRead)) l.push(a.lastRead);
    return l.filter(r => isObj(r) && fin(r.x) && fin(r.y));
  };
  const serMatch = (r, si_) => (fin(r.series) ? r.series === si_ : isObj(r.series) && r.series.index === si_);
  /* Wert aus dem Kennlinien-Leser: find 'x' = gesuchte Größe liegt auf der x-Achse, find 'y' = bei gegebenem x die y-Größe */
  function readAlt(a, o) {
    const hit = readsOf(a).filter(r => r.graphId === o.graph && serMatch(r, o.series));
    if (o.find === 'y') { const h = hit.filter(r => Math.abs(r.x - o.given) <= 0.06 * Math.abs(o.given)); return h.length ? h[h.length - 1].y : null; }
    const h = hit.filter(r => fin(r.x)); return h.length ? h[h.length - 1].x : null;
  }
  function calcAlt(a, id, re) {
    if (!isObj(a) || !isObj(a.calc) || a.calc.id !== id || !Array.isArray(a.calc.res)) return null;
    const x = a.calc.res.find(q => isObj(q) && re.test(String(q.label)));
    return x && fin(x.value) ? x.value : null;
  }

  /* Prüfzeilen sammeln; wirft nie */
  function mk(fn) {
    return function (a) {
      const rows = [];
      try {
        const r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || '') }); };
        fn(r, isObj(a) ? a : {});
      } catch (e) { rows.length = 0; rows.push({ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }); }
      return rows;
    };
  }
  /* Zahlenaufgabe: spec { unit, want(), tol (relativ), absTol?, alts?() [zusätzlich richtige Werte], mistakes?() [[Wert, Erklärung]], readAlt?, calcAlt?, extra?(r, a, v) } */
  function numCheck(spec) {
    return mk((r, a) => {
      let v = numAns(a, spec.unit);
      if (v === null && spec.readAlt) { const q = readAlt(a, spec.readAlt()); if (q !== null) v = q; }
      if (v === null && spec.calcAlt) { const q = calcAlt(a, spec.calcAlt.id, spec.calcAlt.re); if (q !== null) v = q; }
      r(v !== null, 'Du hast eine Zahl in das Antwortfeld eingetragen', 'Tippe das Ergebnis als Zahl in das Feld (Komma oder Punkt, Einheit siehe Feldbeschriftung).');
      const want = spec.want(), tolTxt = spec.absTol != null ? 'auf ±' + fm(spec.absTol) : Math.round(spec.tol * 1000) / 10 + ' %';
      if (v === null) r(false, 'Das Ergebnis stimmt (Toleranz ' + tolTxt + ')', 'Ohne Zahl kann nichts geprüft werden.');
      else {
        const goods = [want].concat(spec.alts ? spec.alts() : []);
        const near = w => (spec.absTol != null ? Math.abs(v - w) <= spec.absTol : Math.abs(v - w) <= spec.tol * Math.abs(w) + 1e-12);
        const ok = goods.some(near);
        let why = '';
        if (!ok) {
          const dist = m => (spec.absTol != null ? Math.abs(v - m[0]) : Math.abs(v - m[0]) / (Math.abs(m[0]) || 1)), lim = spec.absTol != null ? spec.absTol : 0.02;
          const hit = (spec.mistakes ? spec.mistakes() : []).filter(m => fin(m[0]) && dist(m) <= lim).sort((a, b) => dist(a) - dist(b))[0];
          why = hit ? hit[1] : 'Dein Wert ' + fm(v, 4) + ' liegt außerhalb der Toleranz. Rechne mit den Zahlen aus dem Datenblatt noch einmal nach und achte auf die Einheit (' + (spec.unit || 'ohne Einheit') + ').';
        }
        r(ok, 'Das Ergebnis stimmt (Toleranz ' + tolTxt + ')', why);
      }
      if (spec.extra) spec.extra(r, a, v);
    });
  }
  /* Auswahlaufgabe: spec { choices, want() [Index], reasons?: [Text je Auswahl für falsche Antworten] } */
  function choiceCheck(spec) {
    return mk((r, a) => {
      const i = choiceIdx(a, spec.choices);
      r(i >= 0, 'Du hast eine Antwort ausgewählt', 'Tippe eine der Antworten an.');
      const want = spec.want();
      r(i === want, 'Die gewählte Antwort ist richtig', i < 0 ? 'Ohne Auswahl kann nichts geprüft werden.' : (spec.reasons && spec.reasons[i]) || 'Schau noch einmal in die angegebene Tabelle des Datenblatts und prüfe jede Aussage gegen die Zahlen.');
      if (spec.extra) spec.extra(r, a, i);
    });
  }
  const hasMark = (ms, dsId, sec, key) => ms.some(m => (m.ds === dsId || m.ds == null) && m.section === sec && m.key === key);

  /* ====================================================================== Berechnete Zielwerte (eine Quelle für Prüfung und Musterlösung) */
  const W = {
    /* ds1 */ ifKeys() { const d = need('tf-1n4148'), a = d.abs.find(x => x.sym === 'IF'), b = d.rec.find(x => x.sym === 'IF'); if (!a || !b) throw new Error('IF-Zeile fehlt'); return { abs: a.key, rec: b.key, absAll: d.abs.map(x => x.key), recAll: d.rec.map(x => x.key) }; },
    /* ds2 */ bd139C() { const p = need('tf-bd139').pins.pins.find(x => x.name === 'C'); if (!p) throw new Error('Pin C fehlt'); return p.n; },
    /* ds3 */ bc547_40V() { const l = CORE().check(need('tf-bc547'), { vce: 40 }).find(x => x.key === 'vce'); if (!l) throw new Error('check ohne vce'); return l.level === 'ok' ? 0 : l.level === 'warn' ? 1 : 2; },
    /* ds4 */ vicm() { return val(need('tf-lm358'), 'rec', 'vicm', 'max'); },
    /* ds5 */ bd139Viol() { const l = CORE().check(need('tf-bd139'), { vce: 70, ic: 1.2, tamb: 60 }); const bad = l.filter(x => x.key !== '_hinweis' && !x.ok).map(x => x.key); return { bad, all: need('tf-bd139').rec.map(x => x.key) }; },
    /* ds6 */ hfeBmin() { return val(need('tf-bc547'), 'elec', 'hfeB', 'min'); },
    /* ds7 */ irFactor() { const d = need('tf-1n4148'); return siRow(d, 'elec', 'ir20hot', 'max') / siRow(d, 'elec', 'ir20', 'max'); },
    /* ds8 */ vf10() { return invC('tf-1n4148', 'if_vf', 1, 0.01); },
    /* ds9 */ hfeB30() { return readC('tf-bc547', 'hfe_ic', 1, 30); },
    /* ds10 */ vinMin() { return 5 + readC('tf-lm317', 'dropout', 2, 1.2); },
    /* ds11 */ rb1k() { return invC('tf-ne555', 'f_rb', 1, 1000); },
    /* ds12 */ led() { const vf = val(need('tf-led-r'), 'elec', 'vf20', 'typ'); return CORE().ledResistor(12, vf, 0.02); },
    /* ds13 */ rbBc() { const vbe = readC('tf-bc547', 'vbe_ic', 0, 30), ib = 0.030 / 10; return { vbe, r: (5 - vbe) / ib, alt: [(5 - val(need('tf-bc547'), 'elec', 'vbeon', 'typ')) / ib, (5 - 0.8) / ib] }; },
    /* ds14 */ zdRs() { const vz = val(need('tf-zd'), 'elec', 'vz', 'typ'); return { vz, r: (12 * 0.9 - vz) / (0.005 + 0.015), noLoad: (12 * 0.9 - vz) / 0.005, vin: (12 - vz) / 0.02 }; },
    /* ds15 */ lm317R2() { const vref = val(need('tf-lm317'), 'elec', 'vref', 'typ'); return 240 * (9 / vref - 1); },
    /* ds16 */ f555() { return 1.44 / ((4700 + 2 * 47000) * 100e-9); },
    /* ds17 */ lm317Wc() {
      const d = need('tf-lm317'), vr = rowOf(d, 'elec', 'vref'), ia = siRow(d, 'elec', 'iadj', 'max');
      const w = CORE().worstCase('vref*(1+r2/r1)+ia*r2', { vref: { min: vr.min, nom: vr.typ, max: vr.max }, r1: { nom: 240, tol: 1 }, r2: { nom: 720, tol: 1 }, ia: { min: 0, nom: ia / 2, max: ia } });
      if (!w.ok) throw new Error(w.error); return w;
    },
    /* ds18 */ tj7805() { const d = need('tf-7805'), p = (12 - 5) * 0.35, x = CORE().derate(d, { tAmb: 40, ptot: p }); if (x.error) throw new Error(x.error); return { p, tj: x.tj, tjMax: x.tjMax, withIq: x.tj + 12 * val(d, 'elec', 'iq', 'typ') / 1000 * need('tf-7805').thermal.rthJA }; },
    /* ds19 */ rthSA() {
      const d = need('tf-bd139'), t = d.thermal, p = (15 - 5) * 0.4, tot = (125 - 40) / p, sa = tot - t.rthJC - 1, x = CORE().derate(d, { tAmb: 40, ptot: p, rthSA: sa, rthCS: 1 });
      if (x.error || Math.abs(x.tj - 125) > 1e-6) throw new Error('Rth-Probe stimmt nicht'); return { p, tot, sa, jc: t.rthJC };
    },
    /* ds20 */ pickTO92() { const L = LIB(), p = CORE().pick(L, { family: ['Transistor', 'MOSFET'], voltage: 40, current: 0.15, pkg: 'TO-92' }); if (p.length !== 1) throw new Error('pick eindeutig erwartet'); return p[0]; },
    /* ds21 */ pickDiode() { const p = CORE().pick(LIB(), { family: 'Diode', voltage: 230 * Math.SQRT2 * 1.2, current: 0.8 }); if (p.length !== 1) throw new Error('pick eindeutig erwartet'); return p[0]; },
    /* ds22 */ nandY() { const t = need('tf-74hc00').truth, row = t.rows.find(x => x[0] === 1 && x[1] === 0); if (!row) throw new Error('Zeile fehlt'); return row[2]; },
    /* ds23 */ tpd() {
      const tm = need('tf-74hc00').timing[0], A = tm.signals.find(s => s.name === 'A').wave, Y = tm.signals.find(s => s.name === 'Y').wave;
      const ra = A.search(/01/) + 1, fy = Y.search(/10/) + 1, m = String(tm.note).match(/One tick = (\d+(?:[.,]\d+)?) ns/);
      if (ra < 1 || fy < 1 || !m) throw new Error('Zeitdiagramm nicht lesbar'); return (fy - ra) * parseNum(m[1]);
    },
    /* ds24 */ pcfWrite() { const row = need('tf-pcf8574').regs.find(x => x.addr === '0x25'), m = row && String(row.desc).match(/write (0x[0-9A-Fa-f]{2})/); if (!m) throw new Error('Adresszeile fehlt'); return m[1].toUpperCase().replace('0X', '0x'); },
    /* ds25 */ lm75() { const raw = 0xF380; let n = raw >> 7; if (n >= 256) n -= 512; return { raw, n, t: n * 0.5 }; },
    /* ds27 */ iqWord() { const g = CORE().glossary().find(x => x.en === 'quiescent current'); if (!g || !/Ruhestrom/.test(g.de)) throw new Error('Glossareintrag quiescent current fehlt'); if (!rowOf(need('tf-7805'), 'elec', 'iq')) throw new Error('Zeile iq fehlt'); return 0; },
    /* ds28 */ tsol() { const g = CORE().glossary().find(x => x.en === 'lead temperature'); if (!g || !/Löttemperatur/.test(g.de)) throw new Error('Glossareintrag lead temperature fehlt'); const d = need('tf-7805'); return { t: val(d, 'abs', 'tsol', 'max'), tstg: val(d, 'abs', 'tstg', 'max'), tj: val(d, 'abs', 'tj', 'max'), cond: rowOf(d, 'abs', 'tsol').cond }; },
    /* ds29 */ cmGround() { const d = need('tf-lm358'); if (!d.features.some(f => f === 'Input common-mode range includes ground')) throw new Error('Merkmal fehlt'); if (val(d, 'elec', 'vicr', 'min') !== 0) throw new Error('VICR min ist nicht 0'); return 2; },
    /* ds30 */ heatCheck() {
      const d = need('tf-7805'), a = (d.app || []).find(x => x.title === 'Heat check'); if (!a || !/= 133 °C, above the limit\. A heat sink or a lower Vin is required\./.test(a.text)) throw new Error('Heat-check-Text fehlt');
      const x = CORE().derate(d, { tAmb: 25, ptot: 2.16 }); if (x.error || x.ok !== false || Math.round(x.tj) !== 133) throw new Error('Heat-check-Rechnung stimmt nicht'); return 1;
    },
    /* ds31 */ relayFail() { const l = CORE().check(need('tf-bc547'), { vce: 12, ic: 0.15 }); const b = l.filter(x => x.key !== '_hinweis' && !x.ok).map(x => x.key); return b[0] === 'ic' ? 1 : b[0] === 'vce' ? 0 : 2; },
    /* ds32 */ regFail() {
      const d = need('tf-7805'), p = (15 - 5) * 0.9, l = CORE().check(d, { vi: 15, io: 0.9 }), x = CORE().derate(d, { tAmb: 30, ptot: p });
      if (l.some(q => q.key !== '_hinweis' && !q.ok)) return l.find(q => q.key === 'vi' && !q.ok) ? 0 : 1;
      return x.ok ? 3 : 2;
    },
    /* ds33 */ pcfR() { const d = need('tf-pcf8574'), vol = val(d, 'elec', 'vol', 'typ'), volMax = val(d, 'elec', 'vol', 'max'); return { r: (5 - 2 - vol) / 0.01, rMax: (5 - 2 - volMax) / 0.01, none: (5 - 2) / 0.01 }; },
    /* ds34 */ mcpN() { const d = need('tf-mcp4151'), rw = val(d, 'elec', 'rw_55', 'typ'), rab = val(d, 'elec', 'rab_10', 'typ') * 1000, n = (3300 - rw) * 128 / rab; return { n: Math.round(n), exact: n, rw, rab }; }
  };

  /* ====================================================================== Aufgaben */
  const tasks = [
    /* ---------------------------------------------------------------- Datenblatt-Aufbau */
    { id: 'ds1', lab: 'ds', cat: 'Datenblatt-Aufbau', title: 'Grenzwert und Betriebswert finden', level: 1, ds: 'tf-1n4148',
      text: 'Öffne das Datenblatt TF-1N4148 in der Bibliothek. Du suchst den Dauer-Durchlassstrom IF zweimal: in den Absolute Maximum Ratings und in den Recommended Operating Conditions. Markiere beide Zeilen mit dem Stern; deine Markierungen sollen nur diese zwei Zeilen treffen, Spitzen- und Stoßströme bleiben unmarkiert. Dann tippe auf „Lösung prüfen“.',
      hint: ['Die Absolute Maximum Ratings stehen auf der Seite mit dem roten Warnband, die empfohlenen Betriebswerte gleich danach.', 'Gesucht ist das Symbol IF (ohne weitere Buchstaben). IFRM und IFSM sind Spitzen- und Stoßströme, kein Dauerstrom.', 'Markiere in „Absolute Maximum Ratings“ die Zeile „Continuous forward current“ (200 mA) und in „Recommended Operating Conditions“ die Zeile „Forward current“ (150 mA). Merke: Der empfohlene Wert liegt unter dem Grenzwert.'],
      start() { return { ds: 'tf-1n4148', focus: { section: 'abs' } }; },
      sol() { const k = W.ifKeys(); return { ds: 'tf-1n4148', focus: { section: 'rec', key: k.rec }, marks: [{ ds: 'tf-1n4148', section: 'abs', key: k.abs }, { ds: 'tf-1n4148', section: 'rec', key: k.rec }] }; },
      check: mk((r, a) => {
        const k = W.ifKeys(), ms = marksOf(a).filter(m => m.ds === 'tf-1n4148' || m.ds == null);
        r(ms.length > 0, 'Du hast mindestens eine Zeile im Datenblatt TF-1N4148 markiert', 'Tippe in der Tabelle auf den Stern der Zeile, dann auf „Lösung prüfen“.');
        r(hasMark(ms, 'tf-1n4148', 'abs', k.abs), 'In den Absolute Maximum Ratings ist der Dauer-Durchlassstrom IF markiert', 'Gesucht ist die Zeile „Continuous forward current“ mit dem Symbol IF in den Absolute Maximum Ratings.');
        r(hasMark(ms, 'tf-1n4148', 'rec', k.rec), 'In den Recommended Operating Conditions ist der Durchlassstrom IF markiert', 'Der empfohlene Betriebsbereich steht in einer eigenen Tabelle: Zeile „Forward current“.');
        const wrong = ms.filter(m => (m.section === 'abs' && m.key !== k.abs) || (m.section === 'rec' && m.key !== k.rec));
        r(wrong.length === 0, 'Es sind keine anderen Zeilen der beiden Tabellen markiert', 'Zu viel markiert: IFRM, IFSM, Ptot und die übrigen Zeilen sind nicht der Dauer-Durchlassstrom.');
      }) },
    { id: 'ds2', lab: 'ds', cat: 'Datenblatt-Aufbau', title: 'Pinbelegung im TO-126', level: 1, ds: 'tf-bd139',
      text: 'Du baust einen BD139 als Leistungsschalter in eine Platine ein. Öffne das Datenblatt TF-BD139 und lies die Pinbelegung ab (Ansicht von vorn, Pin 1 links). Gib die Pinnummer des Kollektors an. Vorsicht: Die Belegung ist anders als beim kleinen TF-BC547.',
      ask: { label: 'Pinnummer des Kollektors', unit: '' },
      hint: ['Die Pinbelegung steht in der Tabelle „Pin configuration“ und im Gehäusebild.', 'Suche in der Spalte „Name“ den Eintrag C (Collector) und lies die Pinnummer daneben ab.', 'TF-BD139, Pin configuration: Pin 1 = E, Pin 2 = C, Pin 3 = B. Der Kollektor ist also Pin 2. Beim TF-BC547 wäre es Pin 1.'],
      start() { return { ds: 'tf-bd139', focus: { section: 'pins' } }; },
      sol() { return { ds: 'tf-bd139', focus: { section: 'pins', key: String(W.bd139C()) }, value: W.bd139C() }; },
      check: numCheck({ unit: '', want: () => W.bd139C(), absTol: 0.01, mistakes: () => [[1, 'Pin 1 ist beim BD139 der Emitter. Beim BC547 wäre Pin 1 der Kollektor, aber hier gilt eine andere Reihenfolge.'], [3, 'Pin 3 ist beim BD139 die Basis.']] }) },

    /* ---------------------------------------------------------------- Grenzwerte und Betriebsbedingungen */
    { id: 'ds3', lab: 'ds', cat: 'Grenzwerte und Betriebsbedingungen', title: 'Darf der BC547 an 40 V?', level: 1, ds: 'tf-bc547',
      text: 'Ein Kollege will einen TF-BC547 im Dauerbetrieb an einer Kollektor-Emitter-Spannung von 40 V einsetzen und sagt: „Im Datenblatt stehen 45 V, das passt.“ Du sollst im Datenblatt TF-BC547 die Absolute Maximum Ratings und die Recommended Operating Conditions prüfen und die richtige Antwort wählen.',
      ask: { label: 'Deine Beurteilung', choices: ['Ja, 40 V liegen unter VCEO = 45 V, das passt für den Dauerbetrieb.', 'Nein, die empfohlene Obergrenze ist 30 V; die 45 V sind nur ein Grenzwert und kein Betriebswert.', 'Nein, 40 V liegen über dem Absolute Maximum Rating von 45 V.'] },
      hint: ['Absolute Maximum Ratings sind Zerstörungsgrenzen, keine Betriebswerte. Entscheidend sind die Recommended Operating Conditions.', 'Vergleiche 40 V mit zwei Zahlen: VCEO max in den Absolute Maximum Ratings und VCE max in den Recommended Operating Conditions.', 'VCEO max = 45 V (Grenzwert), empfohlen sind aber nur 0 bis 30 V. 40 V liegen darüber: Die Kenndaten sind dort nicht garantiert, im Dauerbetrieb ist das nicht zulässig.'],
      start() { return { ds: 'tf-bc547', focus: { section: 'abs' } }; },
      sol() { return { ds: 'tf-bc547', focus: { section: 'rec', key: 'vce' }, choice: W.bc547_40V() }; },
      check: choiceCheck({ choices: ['Ja, 40 V liegen unter VCEO = 45 V, das passt für den Dauerbetrieb.', 'Nein, die empfohlene Obergrenze ist 30 V; die 45 V sind nur ein Grenzwert und kein Betriebswert.', 'Nein, 40 V liegen über dem Absolute Maximum Rating von 45 V.'], want: () => W.bc547_40V(),
        reasons: ['Das ist die klassische Falle: Die 45 V sind das Absolute Maximum Rating, aber der empfohlene Betriebsbereich endet bei 30 V.', null, '40 V sind kleiner als 45 V. Das Absolute Maximum Rating ist also nicht überschritten; der Fehler liegt bei den empfohlenen Betriebswerten.'] }) },
    { id: 'ds4', lab: 'ds', cat: 'Grenzwerte und Betriebsbedingungen', title: 'Eingangsspannung des LM358 bei 5 V', level: 2, ds: 'tf-lm358',
      text: 'Ein TF-LM358 wird mit VCC = 5 V betrieben und soll eine Sensorspannung verstärken. Wie hoch darfst du die Gleichtakt-Eingangsspannung (common-mode input voltage) nach den Recommended Operating Conditions höchstens wählen? Lies die Zeile für VCC = 5 V im Datenblatt TF-LM358 ab.',
      ask: { label: 'Größte Gleichtakt-Eingangsspannung', unit: 'V' },
      hint: ['Die Zahl steht nicht bei den Absolute Maximum Ratings, sondern bei den Recommended Operating Conditions.', 'Suche die Zeile „Common-mode input voltage (VCC = 5 V)“ und lies den Max-Wert ab.', 'VICM max = 3,5 V bei VCC = 5 V, das ist VCC − 1,5 V. Die 32 V bei „Input voltage“ sind ein Grenzwert, kein Arbeitsbereich.'],
      start() { return { ds: 'tf-lm358', focus: { section: 'rec' } }; },
      sol() { return { ds: 'tf-lm358', focus: { section: 'rec', key: 'vicm' }, value: W.vicm() }; },
      check: numCheck({ unit: 'V', want: () => W.vicm(), tol: 0.02, mistakes: () => [[val(need('tf-lm358'), 'abs', 'vi', 'max'), 'Das ist das Absolute Maximum Rating der Eingangsspannung. Gefragt ist der empfohlene Bereich bei VCC = 5 V.'], [5, 'Der Eingang reicht nicht bis VCC: Der Eingangsbereich endet etwa 1,5 V darunter.']] }) },
    { id: 'ds5', lab: 'ds', cat: 'Grenzwerte und Betriebsbedingungen', title: 'Welche Betriebsbedingung ist verletzt?', level: 3, ds: 'tf-bd139',
      text: 'Du willst einen TF-BD139 mit VCE = 70 V, IC = 1,2 A und einer Umgebungstemperatur von 60 °C betreiben. Öffne das Datenblatt TF-BD139 und markiere im Abschnitt Recommended Operating Conditions genau die Zeilen, die dieser Betriebspunkt verletzt. Zeilen, die eingehalten werden, bleiben unmarkiert. Beachte: Auch wenn die Absolute Maximum Ratings noch nicht überschritten sind, kann ein Betriebspunkt unzulässig sein.',
      hint: ['Vergleiche jeden Wert mit der Spalte Max der Recommended Operating Conditions, nicht mit den Absolute Maximum Ratings.', 'Es sind zwei Zeilen: eine Spannung und ein Strom. Die Umgebungstemperatur von 60 °C liegt im Bereich.', 'Recommended: VCE max 60 V (70 V sind zu viel), IC max 1 A (1,2 A sind zu viel), Tamb bis 85 °C (60 °C passt). Markiere die Zeilen „Collector-emitter voltage“ und „Collector current“ in den Recommended Operating Conditions.'],
      start() { return { ds: 'tf-bd139', focus: { section: 'rec' } }; },
      sol() { const v = W.bd139Viol(); return { ds: 'tf-bd139', focus: { section: 'rec' }, marks: v.bad.map(k => ({ ds: 'tf-bd139', section: 'rec', key: k })) }; },
      check: mk((r, a) => {
        const v = W.bd139Viol(), ms = marksOf(a).filter(m => m.ds === 'tf-bd139' || m.ds == null), rm = ms.filter(m => m.section === 'rec').map(m => m.key);
        r(rm.length > 0, 'Du hast mindestens eine Zeile der Recommended Operating Conditions markiert', 'Tippe in der Tabelle „Recommended Operating Conditions“ auf den Stern der verletzten Zeile.');
        v.bad.forEach(k => { const row = rowOf(need('tf-bd139'), 'rec', k); r(rm.includes(k), 'Verletzt und markiert: ' + (row ? row.param : k), 'Prüfe ' + (row ? row.param : k) + ' gegen die Spalte Max der Recommended Operating Conditions.'); });
        const extra = rm.filter(k => !v.bad.includes(k));
        r(extra.length === 0, 'Es sind keine eingehaltenen Zeilen markiert', 'Zu viel markiert: ' + extra.map(k => { const row = rowOf(need('tf-bd139'), 'rec', k); return row ? row.param : k; }).join(', ') + ' wird eingehalten.');
      }) },

    /* ---------------------------------------------------------------- Kennwerte lesen */
    { id: 'ds6', lab: 'ds', cat: 'Kennwerte lesen', title: 'Kleinste Stromverstärkung der Gruppe B', level: 1, ds: 'tf-bc547',
      text: 'Für eine Schaltung brauchst du die kleinste Stromverstärkung hFE, die ein TF-BC547B (Gruppe B) bei VCE = 5 V und IC = 2 mA sicher mitbringt. Schau in die Electrical Characteristics des Datenblatts TF-BC547 und gib den garantierten Mindestwert an.',
      ask: { label: 'hFE Mindestwert Gruppe B', unit: '' },
      hint: ['Es gibt drei Zeilen für hFE, eine je Gruppe (A, B, C). Achte auf die Gruppe.', 'In der Gruppe-B-Zeile gibt es drei Spalten: Min, Typ und Max. Du brauchst die Spalte Min.', 'Gruppe B: Min 200, Typ 290, Max 450. Für eine sichere Auslegung rechnest du mit dem Mindestwert 200.'],
      start() { return { ds: 'tf-bc547', focus: { section: 'elec', key: 'hfeB' } }; },
      sol() { return { ds: 'tf-bc547', focus: { section: 'elec', key: 'hfeB' }, value: W.hfeBmin() }; },
      check: numCheck({ unit: '', want: () => W.hfeBmin(), tol: 0.02, mistakes: () => { const d = need('tf-bc547'); return [[val(d, 'elec', 'hfeB', 'typ'), 'Das ist der Typwert. Für die sichere Auslegung brauchst du den Mindestwert (Spalte Min).'], [val(d, 'elec', 'hfeB', 'max'), 'Das ist der Maximalwert der Gruppe B.'], [val(d, 'elec', 'hfeA', 'min'), 'Das ist der Mindestwert der Gruppe A, nicht der Gruppe B.'], [val(d, 'elec', 'hfeC', 'min'), 'Das ist der Mindestwert der Gruppe C, nicht der Gruppe B.']]; } }) },
    { id: 'ds7', lab: 'ds', cat: 'Kennwerte lesen', title: 'Sperrstrom kalt und heiß', level: 2, ds: 'tf-1n4148',
      text: 'Der Sperrstrom IR einer Diode wächst mit der Temperatur stark an. Lies im Datenblatt TF-1N4148 die Maximalwerte von IR bei VR = 20 V ab, einmal bei Tj = 25 °C und einmal bei Tj = 150 °C. Achte auf die Einheiten (nA und µA). Um welchen Faktor ist der Maximalwert bei 150 °C größer, wenn du ihn mit dem bei 25 °C vergleichst?',
      ask: { label: 'Faktor (heiß durch kalt)', unit: '' },
      hint: ['Die beiden Zeilen unterscheiden sich in den Testbedingungen: Tj steht klein unter den Bedingungen.', 'Verwende die Spalte Max beider Zeilen und rechne beide Werte zuerst in dieselbe Einheit um (1 µA = 1000 nA).', 'IR max (25 °C) = 25 nA, IR max (150 °C) = 50 µA = 50 000 nA. Faktor = 50 000 nA / 25 nA = 2000.'],
      start() { return { ds: 'tf-1n4148', focus: { section: 'elec', key: 'ir20hot' } }; },
      sol() { return { ds: 'tf-1n4148', focus: { section: 'elec', key: 'ir20' }, value: W.irFactor() }; },
      check: numCheck({ unit: '', want: () => W.irFactor(), tol: 0.02, mistakes: () => { const d = need('tf-1n4148'); return [[siRow(d, 'elec', 'ir20hot', 'typ') / siRow(d, 'elec', 'ir20', 'typ'), 'Du hast die Typwerte verglichen (2 µA durch 5 nA). Gefragt sind die Maximalwerte.'], [2, 'Du hast die Einheiten nicht umgerechnet: nA und µA unterscheiden sich um den Faktor 1000.']]; } }) },

    /* ---------------------------------------------------------------- Kennlinien ablesen */
    { id: 'ds8', lab: 'ds', cat: 'Kennlinien ablesen', title: 'Durchlassspannung bei 10 mA', level: 1, ds: 'tf-1n4148',
      text: 'Lies im Datenblatt TF-1N4148 aus der Kennlinie „Forward current vs. forward voltage“ (Kurve Tj = 25 °C) die Durchlassspannung VF bei einem Strom von 10 mA ab. Die y-Achse ist logarithmisch. Du kannst im Betrachter den Ablesemodus benutzen oder den Wert eintippen.',
      ask: { label: 'VF bei IF = 10 mA', unit: 'V' },
      hint: ['Wähle die Kurve Tj = 25 °C. Auf der logarithmischen y-Achse liegen 10 mA genau auf einem Hauptstrich (zwischen 1 mA und 100 mA).', 'Gehe waagerecht von 10 mA bis zur Kurve und senkrecht hinunter zur x-Achse (Volt).', 'Bei 10 mA und Tj = 25 °C liest du etwa 0,73 V ab. Zur Kontrolle: Die Tabelle nennt typ. 0,74 V (Min 0,6 V, Max 1,0 V).'],
      start() { return { ds: 'tf-1n4148', focus: { section: 'graphs', index: graphIdx('tf-1n4148', 'if_vf') }, mode: 'ablesen' }; },
      sol() { const x = W.vf10(); return { ds: 'tf-1n4148', focus: { section: 'graphs', index: graphIdx('tf-1n4148', 'if_vf') }, mode: 'ablesen', value: x, reads: [{ graphId: 'if_vf', series: 1, x, y: 0.01 }] }; },
      check: numCheck({ unit: 'V', want: () => W.vf10(), tol: 0.04, readAlt: () => ({ graph: 'if_vf', series: 1, find: 'x' }),
        mistakes: () => [[invC('tf-1n4148', 'if_vf', 0, 0.01), 'Das ist die Kurve für Tj = −40 °C. Für Tj = 25 °C ist VF kleiner.'], [invC('tf-1n4148', 'if_vf', 2, 0.01), 'Das ist die Kurve für Tj = 100 °C. Gefragt ist Tj = 25 °C.']] }) },
    { id: 'ds9', lab: 'ds', cat: 'Kennlinien ablesen', title: 'hFE bei 30 mA ablesen', level: 2, ds: 'tf-bc547',
      text: 'Dein TF-BC547B (Gruppe B) schaltet einen Strom von IC = 30 mA. Lies im Datenblatt TF-BC547 aus der Kennlinie „DC current gain vs. collector current“ die typische Stromverstärkung hFE der Gruppe B bei IC = 30 mA ab. Die x-Achse ist logarithmisch, 30 mA liegt zwischen 20 mA und 50 mA.',
      ask: { label: 'hFE (Gruppe B) bei IC = 30 mA', unit: '' },
      hint: ['Die x-Achse ist logarithmisch: 30 mA liegt nicht in der Mitte zwischen 20 und 50 mA, sondern näher an 20 mA.', 'Wähle die Kurve „group B“. Gehe bei 30 mA senkrecht nach oben bis zur Kurve und dann waagerecht zur y-Achse.', 'Zwischen 20 mA (etwa 284) und 50 mA (etwa 247) fällt die Kurve leicht. Bei 30 mA liest du etwa 268 ab. Der Tabellenwert bei 2 mA (typ. 290) gilt für einen anderen Strom.'],
      start() { return { ds: 'tf-bc547', focus: { section: 'graphs', index: graphIdx('tf-bc547', 'hfe_ic') }, mode: 'ablesen' }; },
      sol() { return { ds: 'tf-bc547', focus: { section: 'graphs', index: graphIdx('tf-bc547', 'hfe_ic') }, mode: 'ablesen', value: W.hfeB30(), reads: [{ graphId: 'hfe_ic', series: 1, x: 30, y: W.hfeB30() }] }; },
      check: numCheck({ unit: '', want: () => W.hfeB30(), tol: 0.05, readAlt: () => ({ graph: 'hfe_ic', series: 1, find: 'y', given: 30 }),
        mistakes: () => [[val(need('tf-bc547'), 'elec', 'hfeB', 'typ'), 'Das ist der Tabellenwert bei IC = 2 mA. Die Kennlinie zeigt, dass die Verstärkung bei 30 mA kleiner ist.'], [readC('tf-bc547', 'hfe_ic', 2, 30), 'Das ist die Kurve der Gruppe C. Gefragt ist Gruppe B.'], [readC('tf-bc547', 'hfe_ic', 0, 30), 'Das ist die Kurve der Gruppe A. Gefragt ist Gruppe B.']] }) },
    { id: 'ds10', lab: 'ds', cat: 'Kennlinien ablesen', title: 'Mindest-Eingangsspannung des LM317 bei 125 °C', level: 2, ds: 'tf-lm317',
      text: 'Dein TF-LM317 soll 5 V bei IO = 1,2 A liefern und wird dabei sehr warm (Tj = 125 °C). Lies in der Kennlinie „Dropout voltage vs. output current“ des Datenblatts TF-LM317 die Dropout-Spannung der Kurve Tj = 125 °C bei 1,2 A ab. Gib an, wie groß die Eingangsspannung mindestens sein muss.',
      ask: { label: 'Mindest-Eingangsspannung', unit: 'V' },
      hint: ['Die Eingangsspannung ist die Ausgangsspannung plus die Dropout-Spannung.', 'Wähle die Kurve Tj = 125 °C (die oberste) und lies bei 1,2 A auf der x-Achse die Dropout-Spannung ab.', 'Bei 1,2 A und 125 °C liest du etwa 2,03 V ab. Vin,min = 5 V + 2,03 V = 7,03 V. Bei 25 °C wäre die Dropout-Spannung etwas kleiner (etwa 1,9 V).'],
      start() { return { ds: 'tf-lm317', focus: { section: 'graphs', index: graphIdx('tf-lm317', 'dropout') }, mode: 'ablesen' }; },
      sol() { return { ds: 'tf-lm317', focus: { section: 'graphs', index: graphIdx('tf-lm317', 'dropout') }, mode: 'ablesen', value: W.vinMin(), reads: [{ graphId: 'dropout', series: 2, x: 1.2, y: W.vinMin() - 5 }] }; },
      check: numCheck({ unit: 'V', want: () => W.vinMin(), tol: 0.03,
        mistakes: () => [[readC('tf-lm317', 'dropout', 2, 1.2), 'Das ist nur die Dropout-Spannung. Die Eingangsspannung ist VO plus Dropout: 5 V + Dropout.'], [5 + readC('tf-lm317', 'dropout', 1, 1.2), 'Das ist die Kurve für Tj = 25 °C. Gefragt ist die heiße Kurve, Tj = 125 °C.'], [5 + val(need('tf-lm317'), 'elec', 'vdo', 'max'), 'Das ist der Tabellen-Maximalwert bei 1,5 A. Gefragt ist die Kennlinie bei 1,2 A und 125 °C.']] }) },
    { id: 'ds11', lab: 'ds', cat: 'Kennlinien ablesen', title: 'RB für 1 kHz mit dem NE555', level: 3, ds: 'tf-ne555',
      text: 'Dein TF-NE555 soll astabil mit f = 1 kHz schwingen. Du hast C = 100 nF und RA = 1 kΩ gewählt. Lies in der Kennlinie „Astable frequency vs. RB“ des Datenblatts TF-NE555 (Kurve C = 100 nF, beide Achsen logarithmisch) den Widerstand RB für 1 kHz ab.',
      ask: { label: 'RB für f = 1 kHz', unit: 'Ω' },
      hint: ['Beide Achsen sind logarithmisch. Starte auf der y-Achse (Frequenz) bei 1 kHz und gehe waagerecht bis zur Kurve C = 100 nF.', 'Von dort geht es senkrecht nach unten zur x-Achse (RB in Ω). Der Wert liegt zwischen 4,7 kΩ und 10 kΩ.', 'Aus der Kurve: etwa 6,7 kΩ. Zur Kontrolle mit der Formel f = 1,44 / ((RA + 2·RB)·C): RB = (1,44 / (1 kHz · 100 nF) − 1 kΩ) / 2 = 6,7 kΩ.'],
      start() { return { ds: 'tf-ne555', focus: { section: 'graphs', index: graphIdx('tf-ne555', 'f_rb') }, mode: 'ablesen' }; },
      sol() { return { ds: 'tf-ne555', focus: { section: 'graphs', index: graphIdx('tf-ne555', 'f_rb') }, mode: 'ablesen', value: W.rb1k(), reads: [{ graphId: 'f_rb', series: 1, x: W.rb1k(), y: 1000 }] }; },
      check: numCheck({ unit: 'Ω', want: () => W.rb1k(), tol: 0.08, readAlt: () => ({ graph: 'f_rb', series: 1, find: 'x' }), alts: () => [(1.44 / (1000 * 100e-9) - 1000) / 2],
        mistakes: () => [[invC('tf-ne555', 'f_rb', 0, 1000), 'Das ist die Kurve für C = 10 nF. Für C = 100 nF brauchst du einen kleineren Widerstand.'], [1440 / (1000 * 100e-9) / 1000, 'Die Formel enthält RA + 2·RB. Rechne den Widerstand aus (RA + 2·RB) heraus und teile durch 2.']] }) },

    /* ---------------------------------------------------------------- Berechnungen */
    { id: 'ds12', lab: 'ds', cat: 'Berechnungen', title: 'LED-Vorwiderstand an 12 V', level: 1, ds: 'tf-led-r',
      text: 'Deine rote LED TF-LED-R5 soll mit ihrem Test-Strom IF = 20 mA an 12 V leuchten. Nimm die typische Durchlassspannung VF bei 20 mA aus den Electrical Characteristics des Datenblatts TF-LED-R5. Rechne den Vorwiderstand und gib den nächsten E12-Wert nach oben an (aufrunden schützt die LED).',
      ask: { label: 'Vorwiderstand (E12-Wert)', unit: 'Ω' },
      hint: ['R = (Us − VF) / IF. Die Durchlassspannung steht in der Zeile „Forward voltage“ bei IF = 20 mA.', 'VF = 2,0 V (typ.). Spannung am Widerstand: 12 V − 2,0 V = 10 V. Dann durch 20 mA teilen.', 'R = 10 V / 20 mA = 500 Ω. Die E12-Reihe hat 470 Ω und 560 Ω; aufgerundet ergibt das 560 Ω (E24 hätte 510 Ω). Mit 560 Ω fließen 17,9 mA.'],
      start() { return { ds: 'tf-led-r', focus: { section: 'elec', key: 'vf20' }, calc: { id: 'led', vals: { us: 5, uf: 2, if: 15 } } }; },
      sol() { const l = W.led(); return { ds: 'tf-led-r', focus: { section: 'elec', key: 'vf20' }, calc: { id: 'led', vals: { us: 12, uf: 2, if: 20 } }, value: l.rE12, calcAns: { id: 'led', res: [{ label: 'E12 (aufgerundet)', value: l.rE12, unit: 'Ω' }] } }; },
      check: numCheck({ unit: 'Ω', want: () => W.led().rE12, tol: 0.02, calcAlt: { id: 'led', re: /E12/ },
        mistakes: () => { const l = W.led(); return [[l.r, 'Das ist der rechnerische Wert. Gefragt ist der nächste E12-Wert nach oben (560 Ω statt 500 Ω).'], [l.rE24, 'Das ist der E24-Wert. Gefragt ist E12.'], [(12 - 0) / 0.02, 'Du hast VF vergessen: Am Widerstand fallen nur 12 V − VF ab.']]; } }) },
    { id: 'ds13', lab: 'ds', cat: 'Berechnungen', title: 'Basiswiderstand für 30 mA', level: 2, ds: 'tf-bc547',
      text: 'Dein TF-BC547 soll als Schalter 30 mA übernehmen, angesteuert aus 5 V. Rechne mit dem erzwungenen Stromverstärkungsfaktor 10 aus dem Anwendungsbeispiel des Datenblatts TF-BC547 (IB = IC / 10) und lies VBE bei IC = 30 mA aus der Kennlinie „Base-emitter voltage vs. collector current“ ab (Tamb = 25 °C). Wie groß ist der Basiswiderstand rechnerisch?',
      ask: { label: 'Basiswiderstand RB (rechnerisch)', unit: 'Ω' },
      hint: ['Zuerst den Basisstrom: IB = IC / 10. Dann der Spannungsabfall am Widerstand: Us − VBE.', 'VBE bei 30 mA liegt laut Kennlinie bei etwa 0,72 V. IB = 30 mA / 10 = 3 mA.', 'RB = (5 V − 0,72 V) / 3 mA = 1,43 kΩ. Normwert nach unten: 1,2 kΩ (E12), dann ist die Sättigung sicher.'],
      start() { return { ds: 'tf-bc547', focus: { section: 'graphs', index: graphIdx('tf-bc547', 'vbe_ic') }, mode: 'ablesen', calc: { id: 'rb', vals: { ic: 30, ust: 5 } } }; },
      sol() { const w = W.rbBc(); return { ds: 'tf-bc547', focus: { section: 'graphs', index: graphIdx('tf-bc547', 'vbe_ic') }, mode: 'ablesen', value: w.r, reads: [{ graphId: 'vbe_ic', series: 0, x: 30, y: w.vbe }] }; },
      check: numCheck({ unit: 'Ω', want: () => W.rbBc().r, tol: 0.05, alts: () => W.rbBc().alt,
        mistakes: () => [[(5 - 0.72) / (0.030 / val(need('tf-bc547'), 'elec', 'hfeA', 'min')), 'Du hast mit hFE gerechnet. Im Schaltbetrieb nimmst du einen kleinen erzwungenen Faktor von 10, damit der Transistor sicher sättigt.'], [5 / 0.003, 'Die Basis-Emitter-Spannung fehlt: Am Widerstand fallen nur Us − VBE ab.']] }) },
    { id: 'ds14', lab: 'ds', cat: 'Berechnungen', title: 'Vorwiderstand der Z-Diode', level: 2, ds: 'tf-zd',
      text: 'Deine 5,1-V-Z-Diode TF-ZD5V1 stabilisiert die Spannung eines Sensors an einer Versorgung von 12 V ±10 %. Der Laststrom beträgt höchstens 15 mA, der Z-Strom soll mindestens 5 mA betragen (Prüfstrom der Tabelle). Berechne den Vorwiderstand RS nach der Formel aus dem Anwendungsbeispiel des Datenblatts TF-ZD5V1 mit dem Typwert VZ und der kleinsten Versorgungsspannung.',
      ask: { label: 'Vorwiderstand RS (rechnerisch)', unit: 'Ω' },
      hint: ['Die Formel steht im Anwendungsbeispiel: RS = (Vin,min − VZ) / (IZ,min + IL,max). Rechne mit der kleinsten Versorgungsspannung.', 'Vin,min = 12 V − 10 % = 10,8 V. VZ (typ., bei 5 mA) = 5,1 V. Strom durch RS: 5 mA + 15 mA = 20 mA.', 'RS = (10,8 V − 5,1 V) / 20 mA = 285 Ω. Nächster E12-Wert nach unten: 270 Ω. Prüfe danach PZ bei der größten Versorgung.'],
      start() { return { ds: 'tf-zd', focus: { section: 'elec', key: 'vz' } }; },
      sol() { return { ds: 'tf-zd', focus: { section: 'app', key: '0' }, value: W.zdRs().r }; },
      check: numCheck({ unit: 'Ω', want: () => W.zdRs().r, tol: 0.02,
        mistakes: () => [[W.zdRs().vin, 'Du hast mit 12 V statt mit der kleinsten Versorgungsspannung 10,8 V gerechnet. Die Z-Diode muss auch im ungünstigsten Fall noch genug Strom bekommen.'], [W.zdRs().noLoad, 'Du hast den Laststrom vergessen: Durch RS fließen IZ,min und der Laststrom zusammen.']] }) },
    { id: 'ds15', lab: 'ds', cat: 'Berechnungen', title: 'LM317: R2 für 9 V', level: 2, ds: 'tf-lm317',
      text: 'Ein TF-LM317 soll 9 V am Ausgang liefern, R1 beträgt 240 Ω. Lies die Referenzspannung Vref (typ.) aus den Electrical Characteristics des Datenblatts TF-LM317 ab und berechne R2 mit der Formel aus dem Anwendungsbeispiel. Den kleinen Adjust-Strom darfst du hier vernachlässigen.',
      ask: { label: 'R2 (rechnerisch)', unit: 'Ω' },
      hint: ['Im Anwendungsbeispiel steht Vout = Vref · (1 + R2 / R1) + Iadj · R2. Ohne Iadj stellst du nach R2 um.', 'R2 = R1 · (Vout / Vref − 1). Vref (typ.) = 1,25 V.', 'R2 = 240 Ω · (9 V / 1,25 V − 1) = 240 Ω · 6,2 = 1488 Ω. Normwert: 1,5 kΩ (E12), dann stellt sich etwa 9,06 V ein.'],
      start() { return { ds: 'tf-lm317', focus: { section: 'elec', key: 'vref' }, calc: { id: 'lm317', vals: { uo: 9, r1: 240 } } }; },
      sol() { return { ds: 'tf-lm317', focus: { section: 'app', key: '0' }, calc: { id: 'lm317', fromDs: true, vals: { uo: 9, r1: 240 } }, value: W.lm317R2() }; },
      check: numCheck({ unit: 'Ω', want: () => W.lm317R2(), tol: 0.03,
        mistakes: () => { const vr = val(need('tf-lm317'), 'elec', 'vref', 'typ'); return [[240 * 9 / vr, 'Du hast die 1 in der Klammer vergessen: R2 = R1 · (Vout / Vref − 1).'], [240 * (9 - vr), 'Das ist nicht die Formel. Es gilt R2 / R1 = Vout / Vref − 1.']]; } }) },
    { id: 'ds16', lab: 'ds', cat: 'Berechnungen', title: 'Blinkfrequenz des NE555', level: 2, ds: 'tf-ne555',
      text: 'Dein TF-NE555 schwingt astabil mit RA = 4,7 kΩ, RB = 47 kΩ und C = 100 nF. Berechne die Ausgangsfrequenz mit der Formel aus dem Anwendungsbeispiel des Datenblatts TF-NE555 und gib sie in Hz an. (Ob eine LED dabei noch sichtbar blinkt, verrät dir der dritte Tipp.)',
      ask: { label: 'Frequenz', unit: 'Hz' },
      hint: ['Die Formel steht im Anwendungsbeispiel „Astable multivibrator“: f = 1,44 / ((RA + 2·RB) · C).', 'RA + 2·RB = 4,7 kΩ + 2 · 47 kΩ = 98,7 kΩ. Rechne in Ω und F: 98 700 Ω und 0,0000001 F.', 'f = 1,44 / (98 700 Ω · 100 nF) = 1,44 / 0,00987 = 145,9 Hz, Periodendauer T = 1/f ≈ 6,9 ms. Mit 146 Hz sieht das Auge kein Blinken mehr, sondern Dauerlicht (ab etwa 50 Hz verschmilzt es). Für ein sichtbares Blinken brauchst du einen 100-mal größeren Kondensator: 10 µF ergibt etwa 1,5 Hz.'],
      start() { return { ds: 'tf-ne555', focus: { section: 'app', key: '0' }, calc: { id: 't555', vals: { mode: 'a', r1: '4,7k', r2: '47k', c: '100n' } } }; },
      sol() { return { ds: 'tf-ne555', focus: { section: 'app', key: '0' }, calc: { id: 't555', vals: { mode: 'a', r1: '4,7k', r2: '47k', c: '100n' } }, value: W.f555() }; },
      check: numCheck({ unit: 'Hz', want: () => W.f555(), tol: 0.02,
        mistakes: () => [[1.44 / ((4700 + 47000) * 100e-9), 'Im Nenner steht RA + 2·RB, nicht RA + RB: Der Kondensator wird über RB geladen und entladen.']] }) },
    { id: 'ds17', lab: 'ds', cat: 'Berechnungen', title: 'LM317: größte Ausgangsspannung (Worst Case)', level: 3, ds: 'tf-lm317',
      text: 'Dein TF-LM317 ist mit R1 = 240 Ω und R2 = 720 Ω beschaltet, beide Widerstände haben ±1 % Toleranz. Berechne die größtmögliche Ausgangsspannung im ungünstigsten Fall: größte Referenzspannung Vref (Spalte Max), größter Adjust-Strom Iadj (Spalte Max) und die Widerstandstoleranzen so, dass der Ausgang möglichst hoch wird. Daten aus dem Datenblatt TF-LM317.',
      ask: { label: 'Größte Ausgangsspannung', unit: 'V' },
      hint: ['Worst Case heißt: jede Größe steht gleichzeitig im ungünstigsten Eckwert. Formel: Vout = Vref · (1 + R2 / R1) + Iadj · R2.', 'Für das Maximum: Vref = 1,3 V (Max), Iadj = 100 µA (Max), R2 um 1 % größer (727,2 Ω), R1 um 1 % kleiner (237,6 Ω).', 'Vout,max = 1,3 V · (1 + 727,2 / 237,6) + 100 µA · 727,2 Ω = 1,3 V · 4,061 + 0,073 V = 5,35 V. Der Nennwert wäre nur etwa 5,04 V.'],
      start() { return { ds: 'tf-lm317', focus: { section: 'elec', key: 'vref' }, calc: { id: 'wc317', fromDs: true, vals: { r1: 240, r2: 720, t: 1 } } }; },
      sol() { return { ds: 'tf-lm317', focus: { section: 'elec', key: 'vref' }, calc: { id: 'wc317', fromDs: true, vals: { r1: 240, r2: 720, t: 1 } }, value: W.lm317Wc().max }; },
      check: numCheck({ unit: 'V', want: () => W.lm317Wc().max, tol: 0.02,
        mistakes: () => { const w = W.lm317Wc(); return [[w.nom, 'Das ist der Nennwert mit typischen Größen. Gefragt ist der ungünstigste Fall mit allen Größen am Eckwert.'], [w.min, 'Das ist der kleinste mögliche Wert. Für das Maximum nimmst du die größte Vref und R2 groß, R1 klein.']]; } }) },

    /* ---------------------------------------------------------------- Thermik und Derating */
    { id: 'ds18', lab: 'ds', cat: 'Thermik und Derating', title: 'Sperrschichttemperatur des 7805 ohne Kühlkörper', level: 2, ds: 'tf-7805',
      text: 'Dein TF-7805 macht aus 12 V stabile 5 V und liefert dabei 0,35 A. Die Umgebungstemperatur beträgt 40 °C, es gibt keinen Kühlkörper. Berechne die Verlustleistung (den Ruhestrom darfst du vernachlässigen) und mit dem Wärmewiderstand Rth(j-a) aus dem Datenblatt TF-7805 die Sperrschichttemperatur Tj.',
      ask: { label: 'Sperrschichttemperatur Tj', unit: '°C' },
      hint: ['Die Verlustleistung eines Linearreglers ist (Vin − Vout) · IO. Danach gilt Tj = Tamb + P · Rth(j-a).', 'P = (12 V − 5 V) · 0,35 A = 2,45 W. Den Rth(j-a) findest du im Abschnitt Thermal information.', 'Rth(j-a) = 50 K/W: Tj = 40 °C + 2,45 W · 50 K/W = 162,5 °C. Das liegt über Tj max = 125 °C: Der Regler braucht einen Kühlkörper oder weniger Spannungsabfall.'],
      start() { return { ds: 'tf-7805', focus: { section: 'thermal' }, calc: { id: 'pd', fromDs: true, vals: { ta: 40 } } }; },
      sol() { return { ds: 'tf-7805', focus: { section: 'thermal' }, calc: { id: 'pd', fromDs: true, vals: { p: 2.45, ta: 40 } }, value: W.tj7805().tj }; },
      check: numCheck({ unit: '°C', want: () => W.tj7805().tj, tol: 0.025, alts: () => [W.tj7805().withIq], calcAlt: { id: 'pd', re: /Sperrschichttemperatur/ },
        mistakes: () => [[W.tj7805().p, 'Das ist nur die Verlustleistung in W. Gefragt ist die Temperatur: Tj = Tamb + P · Rth(j-a).'], [40 + W.tj7805().p * need('tf-7805').thermal.rthJC, 'Du hast den Wärmewiderstand Sperrschicht-Gehäuse genommen. Ohne Kühlkörper gilt Rth(j-a).']] }) },
    { id: 'ds19', lab: 'ds', cat: 'Thermik und Derating', title: 'Kühlkörper für den BD139', level: 3, ds: 'tf-bd139',
      text: 'Dein TF-BD139 arbeitet als Längsregler und wandelt 15 V in 5 V bei 0,4 A. Die Umgebung hat 40 °C, die Sperrschicht soll mit Reserve höchstens 125 °C erreichen. Die isolierte Montage hat Rth(c-s) = 1 K/W. Berechne mit den Thermik-Angaben des Datenblatts TF-BD139 den größten zulässigen Wärmewiderstand Rth(s-a) des Kühlkörpers.',
      ask: { label: 'Größter Rth(s-a) des Kühlkörpers', unit: 'K/W' },
      hint: ['Rth,gesamt = (Tj − Tamb) / P. Davon gehen Rth(j-c) und Rth(c-s) ab, der Rest darf der Kühlkörper haben.', 'P = (15 V − 5 V) · 0,4 A = 4 W. Rth(j-c) steht im Abschnitt Thermal information.', 'Rth,gesamt = (125 − 40) K / 4 W = 21,25 K/W. Rth(s-a) = 21,25 − 10 (Rth(j-c)) − 1 (Rth(c-s)) = 10,25 K/W. Der Kühlkörper darf also höchstens 10,25 K/W haben.'],
      start() { return { ds: 'tf-bd139', focus: { section: 'thermal' } }; },
      sol() { return { ds: 'tf-bd139', focus: { section: 'thermal', key: 'rthJC' }, value: W.rthSA().sa }; },
      check: numCheck({ unit: 'K/W', want: () => W.rthSA().sa, tol: 0.03,
        mistakes: () => { const w = W.rthSA(); return [[w.tot, 'Das ist der gesamte Wärmewiderstand von der Sperrschicht zur Umgebung. Rth(j-c) und Rth(c-s) gehören nicht zum Kühlkörper und müssen abgezogen werden.'], [w.tot - w.jc, 'Es fehlt noch der Übergangswiderstand Rth(c-s) = 1 K/W der isolierten Montage.'], [need('tf-bd139').thermal.rthJA, 'Das ist Rth(j-a) ohne Kühlkörper in freier Luft.']]; } }) },

    /* ---------------------------------------------------------------- Bauteilwahl */
    { id: 'ds20', lab: 'ds', cat: 'Bauteilwahl', title: 'Schalttransistor im TO-92', level: 2, ds: 'tf-2n7000',
      text: 'Du suchst einen bedrahteten Schalttransistor im Gehäuse TO-92 für 40 V und 0,15 A Dauerstrom. Prüfe die Absolute Maximum Ratings der Datenblätter TF-BC547, TF-2N7000, TF-BD139 und TF-IRLZ34 gegen diese Anforderung und wähle das Bauteil, das alle drei Bedingungen erfüllt.',
      ask: { label: 'Dein Bauteil', choices: ['TF-BC547', 'TF-2N7000', 'TF-BD139', 'TF-IRLZ34'] },
      hint: ['Prüfe drei Dinge: Gehäuse, größte Spannung und größten Dauerstrom. Ein einziger Verstoß schließt das Bauteil aus.', 'Das Gehäuse TO-92 haben nur zwei der vier Typen. Bei diesen beiden vergleichst du den Dauerstrom (IC bzw. ID) mit 0,15 A.', 'TF-BC547: TO-92, aber IC max nur 100 mA, also ausgeschieden. TF-2N7000: TO-92, 60 V, 200 mA, passt. TF-BD139 steckt im TO-126, TF-IRLZ34 im TO-220.'],
      start() { return { ds: 'tf-2n7000', tab: 'pick' }; },
      sol() { const p = W.pickTO92(); return { ds: p.id, tab: 'lib', focus: { section: 'abs' }, choice: ['TF-BC547', 'TF-2N7000', 'TF-BD139', 'TF-IRLZ34'].indexOf(p.part) }; },
      check: choiceCheck({ choices: ['TF-BC547', 'TF-2N7000', 'TF-BD139', 'TF-IRLZ34'], want: () => ['TF-BC547', 'TF-2N7000', 'TF-BD139', 'TF-IRLZ34'].indexOf(W.pickTO92().part),
        reasons: ['Der TF-BC547 ist ein TO-92, verträgt aber nur IC = 100 mA Dauerstrom. Gefordert sind 0,15 A.', null, 'Der TF-BD139 hält Spannung und Strom aus, steckt aber im Gehäuse TO-126, nicht im TO-92.', 'Der TF-IRLZ34 hält Spannung und Strom aus, steckt aber im Gehäuse TO-220, nicht im TO-92.'] }) },
    { id: 'ds21', lab: 'ds', cat: 'Bauteilwahl', title: 'Gleichrichterdiode für das Netzteil', level: 3, ds: 'tf-1n4007',
      text: 'Du baust aus vier Dioden eine Brücke für 230 V Wechselspannung (Spitzenwert 325 V). Laut Anwendungsbeispiel im Datenblatt TF-1N4007 soll die Sperrspannung mindestens das 1,2-fache der Spitzenspannung betragen; der mittlere Strom beträgt 0,8 A. Prüfe die Absolute Maximum Ratings der vier Datenblätter und wähle die einzige geeignete Diode.',
      ask: { label: 'Deine Diode', choices: ['TF-1N4148 (DO-35)', 'TF-1N4007 (DO-41)', 'TF-ZD5V1 (DO-35)', 'TF-LED-R5 (LED 5 mm)'] },
      hint: ['Rechne zuerst die geforderte Sperrspannung: Spitzenwert mal 1,2. Vergleiche sie mit VRRM bzw. VR der Dioden.', 'Gefordert: 325 V · 1,2 = 390 V und 0,8 A im Mittel. Bei der Signaldiode ist schon VRRM zu klein.', 'TF-1N4148: VRRM 100 V, IF 200 mA, zu schwach. TF-ZD5V1 ist eine Z-Diode, TF-LED-R5 eine LED mit VR = 5 V. TF-1N4007: VRRM 1000 V und IF(AV) = 1 A erfüllen beide Anforderungen.'],
      start() { return { ds: 'tf-1n4007', tab: 'pick' }; },
      sol() { const p = W.pickDiode(); return { ds: p.id, tab: 'lib', focus: { section: 'abs' }, choice: 1 }; },
      check: choiceCheck({ choices: ['TF-1N4148 (DO-35)', 'TF-1N4007 (DO-41)', 'TF-ZD5V1 (DO-35)', 'TF-LED-R5 (LED 5 mm)'], want: () => (W.pickDiode().part === 'TF-1N4007' ? 1 : -1),
        reasons: ['Die Signaldiode sperrt höchstens 100 V (VRRM) und trägt nur 200 mA. Für 390 V und 0,8 A reicht sie nicht.', null, 'Eine Z-Diode ist für den Durchbruchbetrieb gebaut und hat keine Sperrspannung von 390 V.', 'Die LED sperrt nur 5 V und verträgt 30 mA.'] }) },

    /* ---------------------------------------------------------------- Zeitdiagramm und Register */
    { id: 'ds22', lab: 'ds', cat: 'Zeitdiagramm und Register', title: 'Pegel am NAND-Ausgang', level: 1, ds: 'tf-74hc00',
      text: 'Am Gatter 1 des TF-74HC00 (Pins 1, 2 und 3) legst du Pin 1 (1A) auf High und Pin 2 (1B) auf Low. Lies die Wahrheitstabelle im Datenblatt TF-74HC00 und gib an, welchen Pegel Pin 3 (1Y) annimmt.',
      ask: { label: 'Pegel an Pin 3 (1Y)', choices: ['Low (0)', 'High (1)', 'Undefiniert (hochohmig)'] },
      hint: ['Ein NAND-Gatter ist ein UND-Gatter mit invertiertem Ausgang. Die Wahrheitstabelle zeigt alle vier Kombinationen.', 'Suche in der Tabelle die Zeile A = 1 und B = 0 und lies Y ab.', 'Y ist nur dann Low, wenn beide Eingänge High sind. Bei A = 1 und B = 0 ist Y = High (1).'],
      start() { return { ds: 'tf-74hc00', focus: { section: 'truth' } }; },
      sol() { return { ds: 'tf-74hc00', focus: { section: 'truth', key: 'row2' }, choice: W.nandY() === 1 ? 1 : 0 }; },
      check: choiceCheck({ choices: ['Low (0)', 'High (1)', 'Undefiniert (hochohmig)'], want: () => (W.nandY() === 1 ? 1 : 0),
        reasons: ['Das wäre der Fall bei A = 1 und B = 1. Hier ist B = 0, deshalb bleibt der Ausgang High.', null, 'Ein Gatter mit Gegentaktausgang liefert immer einen definierten Pegel, wenn die Eingänge definiert sind.'] }) },
    { id: 'ds23', lab: 'ds', cat: 'Zeitdiagramm und Register', title: 'Laufzeit im Zeitdiagramm ablesen', level: 2, ds: 'tf-74hc00',
      text: 'Im Zeitdiagramm „Propagation delay of one gate“ des Datenblatts TF-74HC00 sind die Signale A, B und Y gezeichnet. Ein Zeitschritt ist so lang, wie in der Anmerkung unter dem Diagramm steht. Du sollst bestimmen, wie viele Zeitschritte nach der steigenden Flanke von A die Flanke von Y fällt, und diese Zeit in Nanosekunden angeben.',
      ask: { label: 'Laufzeit von A nach Y', unit: 'ns' },
      hint: ['Suche die steigende Flanke von A (0 nach 1) und die danach folgende fallende Flanke von Y (1 nach 0).', 'Zähle die Zeitschritte zwischen beiden Flanken. Die Länge eines Schritts steht in der Anmerkung unter dem Diagramm.', 'Y fällt zwei Schritte nach A. Ein Schritt sind 4 ns, also tpd = 2 · 4 ns = 8 ns. Das passt zur Tabelle: tpd typ. 8 ns bei VCC = 4,5 V.'],
      start() { return { ds: 'tf-74hc00', focus: { section: 'timing' } }; },
      sol() { return { ds: 'tf-74hc00', focus: { section: 'timing' }, value: W.tpd() }; },
      check: numCheck({ unit: 'ns', want: () => W.tpd(), tol: 0.02,
        mistakes: () => [[W.tpd() / 2, 'Das ist die Zahl der Zeitschritte. Multipliziere sie mit der Länge eines Schritts in ns.'], [W.tpd() * 2, 'Du hast einen Schritt doppelt gezählt: Zähle nur die Schritte zwischen den beiden Flanken.']] }) },
    { id: 'ds24', lab: 'ds', cat: 'Zeitdiagramm und Register', title: 'I²C-Adressbyte des PCF8574', level: 2, ds: 'tf-pcf8574',
      text: 'Du legst beim TF-PCF8574 A0 und A2 an VDD und A1 an Masse. Lies im Datenblatt TF-PCF8574 in der Adresstabelle die 7-Bit-Adresse ab und bestimme das Adressbyte, das ein Master zum Schreiben auf den Bus legt (7-Bit-Adresse, dann R/W = 0).',
      ask: { label: 'Adressbyte zum Schreiben', choices: ['0x4A', '0x4B', '0x25', '0x94'] },
      hint: ['Die Pins A2 A1 A0 ergeben hier das Muster 101. Im Datenblatt steht zu jeder Pinkombination eine eigene Adresszeile.', 'Suche die Zeile „A2 A1 A0 = 101“. Das Adressbyte entsteht aus der 7-Bit-Adresse, um ein Bit nach links geschoben, plus das R/W-Bit.', '7-Bit-Adresse 0x25 (0100 101). Schreiben: 0100 1010 = 0x4A, Lesen: 0100 1011 = 0x4B. 0x25 ist die 7-Bit-Adresse, nicht das Adressbyte.'],
      start() { return { ds: 'tf-pcf8574', focus: { section: 'regs' } }; },
      sol() { return { ds: 'tf-pcf8574', focus: { section: 'regs', key: '0x25' }, choice: ['0x4A', '0x4B', '0x25', '0x94'].indexOf(W.pcfWrite()) }; },
      check: choiceCheck({ choices: ['0x4A', '0x4B', '0x25', '0x94'], want: () => ['0x4A', '0x4B', '0x25', '0x94'].indexOf(W.pcfWrite()),
        reasons: [null, '0x4B ist das Adressbyte zum Lesen (R/W = 1). Gefragt ist Schreiben.', '0x25 ist die 7-Bit-Adresse. Auf dem Bus wird sie um ein Bit nach links geschoben und mit R/W ergänzt.', '0x94 gehört zum LM75 (Adressbyte 0x94 bei A2 A1 A0 = 010), nicht zum PCF8574.'] }) },
    { id: 'ds25', lab: 'ds', cat: 'Zeitdiagramm und Register', title: 'LM75: Temperatur aus dem Register', level: 3, ds: 'tf-lm75',
      text: 'Du liest das Temperaturregister des TF-LM75 aus und erhältst die beiden Bytes 0xF3 und 0x80 (MSB zuerst). Lies im Datenblatt TF-LM75 in der Registertabelle nach, wie das Format aufgebaut ist (9 Bit Zweierkomplement, 0,5 °C je Schritt), und gib die Temperatur in °C an. Achte auf das Vorzeichen.',
      ask: { label: 'Temperatur', unit: '°C' },
      hint: ['Die oberen 9 Bit der 16 Bit sind der Messwert. Die unteren 7 Bit sind immer 0 und werden weggeschoben.', 'Rechne 0xF380 nach rechts um 7 Bit: Das ergibt den 9-Bit-Wert. Ist das oberste Bit (Wert 256 oder mehr) gesetzt, ziehe 512 ab (Zweierkomplement).', '0xF380 >> 7 = 487. Weil 487 ≥ 256, ist N = 487 − 512 = −25. Temperatur = −25 · 0,5 °C = −12,5 °C. Zur Kontrolle: 0xE700 wäre −25 °C.'],
      start() { return { ds: 'tf-lm75', focus: { section: 'regs' } }; },
      sol() { return { ds: 'tf-lm75', focus: { section: 'regs' }, value: W.lm75().t }; },
      check: numCheck({ unit: '°C', want: () => W.lm75().t, tol: 0.02,
        mistakes: () => { const w = W.lm75(); return [[-w.t, 'Das Vorzeichen stimmt nicht: Das oberste der 9 Bit ist gesetzt, der Wert ist negativ.'], [(w.n + 512) * 0.5, 'Du hast das Zweierkomplement nicht aufgelöst: Bei gesetztem obersten Bit ziehst du 512 ab.']]; } }) },

    /* ---------------------------------------------------------------- Fachenglisch */
    { id: 'ds26', lab: 'ds', cat: 'Fachenglisch', title: 'Was ist die Dropout voltage?', level: 1, ds: 'tf-lm317',
      text: 'In den Electrical Characteristics des Datenblatts TF-LM317 steht eine Zeile „Dropout voltage“ mit dem Symbol VDO. Was bedeutet der Begriff, wenn du ihn ins Deutsche übersetzt? Wähle die passende deutsche Erklärung.',
      ask: { label: 'Deine Übersetzung', choices: ['Ausgangsspannung des Reglers im Leerlauf', 'Mindestdifferenz zwischen Eingangs- und Ausgangsspannung, damit der Regler noch regelt', 'Spannung, bei der der Regler thermisch abschaltet', 'Spannungsabfall am Kondensator beim Ausschalten'] },
      hint: ['„Dropout“ heißt Ausfall oder Abfall. Hier ist die Spannung gemeint, die der Regler selbst zum Arbeiten verbraucht.', 'Schau in die Anwendung: Vin(min) = Vout + VDO. Was muss am Regler mindestens abfallen?', 'Die Dropout voltage ist die kleinste Spannungsdifferenz zwischen Eingang und Ausgang, bei der der Regler die Ausgangsspannung noch halten kann (beim TF-LM317 etwa 2 V bei 1,5 A).'],
      start() { return { ds: 'tf-lm317', focus: { section: 'elec', key: 'vdo' } }; },
      sol() { return { ds: 'tf-lm317', focus: { section: 'elec', key: 'vdo' }, choice: 1 }; },
      check: choiceCheck({ choices: ['Ausgangsspannung des Reglers im Leerlauf', 'Mindestdifferenz zwischen Eingangs- und Ausgangsspannung, damit der Regler noch regelt', 'Spannung, bei der der Regler thermisch abschaltet', 'Spannungsabfall am Kondensator beim Ausschalten'], want: () => {
        const g = CORE().glossary().find(x => x.en === 'dropout voltage'); if (!g || !/Spannungsdifferenz/.test(g.de)) throw new Error('Glossareintrag dropout voltage fehlt'); return 1;
      }, reasons: ['Die Leerlaufspannung ist etwas ganz anderes. „Dropout“ beschreibt den Spannungsverlust des Reglers selbst.', null, 'Das wäre die Abschalttemperatur, keine Spannung. Dropout bezieht sich auf die Differenz zwischen Ein- und Ausgang.', 'Mit einem Kondensator hat die Dropout voltage nichts zu tun: Sie ist eine Eigenschaft des Reglers.'] }) },

    { id: 'ds27', lab: 'ds', cat: 'Fachenglisch', title: 'Was ist der Quiescent current?', level: 1, ds: 'tf-7805',
      text: 'In den Electrical Characteristics des Datenblatts TF-7805 steht die Zeile „Quiescent current“ mit dem Symbol IQ (typisch 5 mA bei IO = 0). Was bedeutet der Begriff auf Deutsch? Hilfe findest du auch in der Glossar-Randleiste des Betrachters: Tippe dort auf den Begriff.',
      ask: { label: 'Deine Übersetzung', choices: ['Ruhestrom: der Strom, den der Regler selbst ohne Last aufnimmt', 'Kurzschlussstrom: der Strom bei kurzgeschlossenem Ausgang', 'Spitzenstrom: der kurzzeitig erlaubte Höchststrom', 'Einschaltstrom: der Stromstoß beim Anlegen der Eingangsspannung'] },
      hint: ['Das englische Wort „quiescent“ bedeutet ruhend. Gesucht ist also ein Strom im Ruhezustand.', 'Der Test steht in der Bedingung: VI = 10 V, IO = 0. Der Ausgang ist unbelastet, trotzdem fließt der Strom IQ.', 'IQ ist der Ruhestrom: Er fließt durch den Regler selbst, auch wenn am Ausgang nichts hängt. Kurzschluss- und Spitzenstrom haben im Datenblatt eigene Zeilen (Short-circuit output current, Peak output current).'],
      start() { return { ds: 'tf-7805', focus: { section: 'elec', key: 'iq' } }; },
      sol() { return { ds: 'tf-7805', focus: { section: 'elec', key: 'iq' }, choice: W.iqWord() }; },
      check: choiceCheck({ choices: ['Ruhestrom: der Strom, den der Regler selbst ohne Last aufnimmt', 'Kurzschlussstrom: der Strom bei kurzgeschlossenem Ausgang', 'Spitzenstrom: der kurzzeitig erlaubte Höchststrom', 'Einschaltstrom: der Stromstoß beim Anlegen der Eingangsspannung'], want: () => W.iqWord(),
        reasons: [null, 'Der Kurzschlussstrom heißt „Short-circuit output current“ und steht im Datenblatt in einer eigenen Zeile. IQ wird bei IO = 0 gemessen, also ohne Last.', 'Der Spitzenstrom heißt „Peak output current“ und steht in einer eigenen Zeile. IQ ist ein Dauerwert ohne Last.', 'Ein Einschaltstrom ist ein kurzer Stoß. IQ ist der dauernde Strom im Ruhezustand bei IO = 0.'] }) },
    { id: 'ds28', lab: 'ds', cat: 'Fachenglisch', title: 'Lead temperature beim Löten', level: 2, ds: 'tf-7805',
      text: 'Du willst den TF-7805 auf eine Platine löten. In den Absolute Maximum Ratings steht die Zeile „Lead temperature“ mit der Bedingung „1.6 mm from case, 10 s“. „Lead“ heißt hier Anschlussdraht, nicht Blei. Gib die höchste erlaubte Löttemperatur in °C an und markiere die Zeile im Datenblatt.',
      ask: { label: 'Lead temperature (max.)', unit: '°C' },
      hint: ['„Lead“ spricht man hier wie „liid“ und meint die Anschlussbeine. Suche die Zeile in den Absolute Maximum Ratings.', 'Es gibt drei Temperaturzeilen: Junction temperature, Storage temperature und Lead temperature. Gesucht ist die dritte.', 'Lead temperature max = 260 °C, gemessen 1,6 mm vom Gehäuse und höchstens 10 s lang. Die Lagertemperatur (150 °C) und die Sperrschichttemperatur (125 °C) sind andere Zeilen.'],
      start() { return { ds: 'tf-7805', focus: { section: 'abs' } }; },
      sol() { return { ds: 'tf-7805', focus: { section: 'abs', key: 'tsol' }, value: W.tsol().t, marks: [{ ds: 'tf-7805', section: 'abs', key: 'tsol' }] }; },
      check: numCheck({ unit: '°C', want: () => W.tsol().t, tol: 0.01,
        mistakes: () => [[W.tsol().tstg, 'Das ist die Lagertemperatur „Storage temperature“. Beim Löten gilt die Zeile „Lead temperature“.'], [W.tsol().tj, 'Das ist die Sperrschichttemperatur Tj. Gefragt ist die Temperatur an den Anschlüssen beim Löten.']],
        extra: (r, a) => { r(hasMark(marksOf(a), 'tf-7805', 'abs', 'tsol'), 'Die Zeile „Lead temperature“ ist markiert', 'Markiere die Zeile, aus der du den Wert entnimmst: „Lead temperature“ in den Absolute Maximum Ratings.'); } }) },
    { id: 'ds29', lab: 'ds', cat: 'Fachenglisch', title: 'Common-mode range includes ground', level: 2, ds: 'tf-lm358',
      text: 'Im Datenblatt TF-LM358 steht unter Features der Satz „Input common-mode range includes ground“. Welche deutsche Übersetzung trifft zu? Prüfe sie an der Zeile „Common-mode input voltage range“ in den Electrical Characteristics (Min-Spalte).',
      ask: { label: 'Deine Übersetzung', choices: ['Die Eingänge müssen fest mit Masse verbunden werden.', 'Der Ausgang liegt im Ruhezustand auf Massepotenzial.', 'Die Eingangsspannung darf bis hinunter auf Masse (0 V) reichen.', 'Die Masseleitung wird als Gleichtaktstörung unterdrückt.'] },
      hint: ['„Common-mode“ heißt Gleichtakt, „range“ Bereich. „Includes ground“ heißt: Masse gehört dazu.', 'Schau in die Zeile „Common-mode input voltage range“: Welche Zahl steht in der Spalte Min?', 'Min = 0 V: Der Gleichtakt-Eingangsspannungsbereich beginnt bei Masse. Du kannst also einen Sensor an 0 V anschließen und mit nur einer Versorgungsspannung arbeiten.'],
      start() { return { ds: 'tf-lm358', focus: { section: 'elec', key: 'vicr' } }; },
      sol() { return { ds: 'tf-lm358', focus: { section: 'elec', key: 'vicr' }, choice: W.cmGround() }; },
      check: choiceCheck({ choices: ['Die Eingänge müssen fest mit Masse verbunden werden.', 'Der Ausgang liegt im Ruhezustand auf Massepotenzial.', 'Die Eingangsspannung darf bis hinunter auf Masse (0 V) reichen.', 'Die Masseleitung wird als Gleichtaktstörung unterdrückt.'], want: () => W.cmGround(),
        reasons: ['Von festem Anschluss an Masse steht nichts im Datenblatt. Es geht um den erlaubten Bereich der Eingangsspannung, und der beginnt bei Min = 0 V.', 'Hier geht es um die Eingänge, nicht um den Ausgang. Der Ausgang hat eigene Zeilen (Output voltage low/high).', null, 'Mit „ground“ ist hier der Pegel 0 V gemeint, nicht eine Störgröße. Die Gleichtaktunterdrückung (CMRR) ist eine andere Zeile.'] }) },
    { id: 'ds30', lab: 'ds', cat: 'Fachenglisch', title: 'Heat check im Anwendungsteil', level: 3, ds: 'tf-7805',
      text: 'Im Anwendungsteil des Datenblatts TF-7805 steht unter „Heat check“: „In free air Tj = 25 °C + 2.16 W · 50 K/W = 133 °C, above the limit. A heat sink or a lower Vin is required.“ Was folgt aus diesem Satz für dich? Vergleiche die 133 °C mit Tj max in den Absolute Maximum Ratings.',
      ask: { label: 'Deine Folgerung', choices: ['Der Regler ist in Ordnung, weil 133 °C unter dem Limit liegen.', 'Ohne Kühlkörper wird der Regler zu heiß: Nötig ist ein Kühlkörper oder eine kleinere Eingangsspannung.', 'Die Eingangsspannung muss erhöht werden, damit der Regler kühler bleibt.', 'Die Umgebungstemperatur muss auf 133 °C steigen, damit der Regler arbeitet.'] },
      hint: ['„Above the limit“ heißt über dem Grenzwert. Suche das Limit: die Zeile „Junction temperature“ in den Absolute Maximum Ratings.', 'Tj max = 125 °C. Die Rechnung im Satz ergibt 133 °C und liegt damit 8 K darüber. Überlege, was die Verlustleistung (VI − VO) · IO verkleinert.', 'Der Chip wird ohne Kühlkörper 8 K zu heiß. „A heat sink or a lower Vin is required“ heißt: Es ist ein Kühlkörper nötig oder eine kleinere Eingangsspannung, denn dann sinkt die Verlustleistung.'],
      start() { return { ds: 'tf-7805', focus: { section: 'app', key: '2' } }; },
      sol() { return { ds: 'tf-7805', focus: { section: 'app', key: '2' }, choice: W.heatCheck() }; },
      check: choiceCheck({ choices: ['Der Regler ist in Ordnung, weil 133 °C unter dem Limit liegen.', 'Ohne Kühlkörper wird der Regler zu heiß: Nötig ist ein Kühlkörper oder eine kleinere Eingangsspannung.', 'Die Eingangsspannung muss erhöht werden, damit der Regler kühler bleibt.', 'Die Umgebungstemperatur muss auf 133 °C steigen, damit der Regler arbeitet.'], want: () => W.heatCheck(),
        reasons: ['Tj max ist 125 °C. 133 °C liegen darüber („above the limit“), der Regler wäre also zu heiß.', null, 'Eine höhere Eingangsspannung vergrößert die Verlustleistung (VI − VO) · IO und damit die Erwärmung. „Lower Vin“ heißt kleinere Eingangsspannung.', '133 °C ist die berechnete Chiptemperatur, nicht die Umgebungstemperatur. Die Umgebung ist mit 25 °C angesetzt.'] }) },

    /* ---------------------------------------------------------------- Fehlersuche */
    { id: 'ds31', lab: 'ds', cat: 'Fehlersuche', title: 'Der Relaistreiber stirbt', level: 2, ds: 'tf-bc547',
      text: 'Schaltungsbeispiel: Du lässt einen TF-BC547 ein 12-V-Relais mit 150 mA Spulenstrom schalten (Emitter an Masse, Spule am Kollektor, Freilaufdiode vorhanden). Das Relais zieht kurz an, danach ist der Transistor defekt. Prüfe die Absolute Maximum Ratings des Datenblatts TF-BC547 und finde die Ursache.',
      ask: { label: 'Ursache', choices: ['Die Kollektor-Emitter-Spannung von 12 V ist zu hoch.', 'Der Kollektorstrom von 150 mA überschreitet den Grenzwert IC = 100 mA.', 'Die Sperrschichttemperatur wird durch die Sättigungsspannung überschritten.', 'Das Gehäuse TO-92 darf nicht an ein Relais angeschlossen werden.'] },
      hint: ['Vergleiche jede Größe der Schaltung mit der Spalte Max der Absolute Maximum Ratings: Spannung, Strom und Leistung.', '12 V liegen unter VCEO = 45 V. Beim Strom lohnt der genaue Blick auf die Zeile „Collector current“.', 'IC max = 100 mA, die Spule zieht 150 mA: Der Dauerstrom liegt 50 % über dem Grenzwert. Die Verlustleistung im durchgesteuerten Transistor ist klein (VCEsat · IC). Abhilfe: einen BD139 oder einen MOSFET verwenden.'],
      start() { return { ds: 'tf-bc547', focus: { section: 'abs' } }; },
      sol() { return { ds: 'tf-bc547', focus: { section: 'abs', key: 'ic' }, choice: W.relayFail() }; },
      check: choiceCheck({ choices: ['Die Kollektor-Emitter-Spannung von 12 V ist zu hoch.', 'Der Kollektorstrom von 150 mA überschreitet den Grenzwert IC = 100 mA.', 'Die Sperrschichttemperatur wird durch die Sättigungsspannung überschritten.', 'Das Gehäuse TO-92 darf nicht an ein Relais angeschlossen werden.'], want: () => W.relayFail(),
        reasons: ['12 V sind weit unter VCEO = 45 V. Die Spannung ist hier nicht das Problem.', null, 'Im durchgesteuerten Zustand fällt nur VCEsat (etwa 0,2 V) ab: Die Verlustleistung bleibt klein.', 'Das Gehäuse ist unkritisch. Entscheidend sind die Zahlen der Grenzwerte.'] }) },
    { id: 'ds32', lab: 'ds', cat: 'Fehlersuche', title: 'Der 7805 wird glühend heiß', level: 3, ds: 'tf-7805',
      text: 'Schaltungsbeispiel: Dein TF-7805 versorgt eine Schaltung mit 5 V und 0,9 A aus einem 15-V-Netzteil. Die Umgebung hat 30 °C, einen Kühlkörper gibt es nicht. Nach wenigen Minuten wird der Regler heiß und regelt ab. Prüfe Spannung, Strom und Temperatur anhand des Datenblatts TF-7805 und finde die Ursache.',
      ask: { label: 'Ursache', choices: ['Die Eingangsspannung von 15 V überschreitet das Maximum.', 'Der Ausgangsstrom von 0,9 A ist größer als der erlaubte Strom.', 'Die Verlustleistung von 9 W erhitzt die Sperrschicht ohne Kühlkörper weit über Tj max.', 'Der Regler braucht bei 5 V Ausgangsspannung eine andere Pinbelegung.'] },
      hint: ['Prüfe drei Dinge der Reihe nach: Eingangsspannung gegen die Recommended Operating Conditions, Strom gegen IO max und die Temperatur über die Verlustleistung.', 'Eingang: 15 V liegt im Bereich 7,5 V bis 25 V. Strom: 0,9 A liegt unter 1 A. Bleibt die Wärme: Verlustleistung (15 V − 5 V) · 0,9 A.', 'P = 9 W. Mit Rth(j-a) = 50 K/W wäre Tj = 30 °C + 9 W · 50 K/W = 480 °C, erlaubt sind 125 °C. Der Regler braucht einen Kühlkörper, besser einen Vorregler oder einen Schaltregler.'],
      start() { return { ds: 'tf-7805', focus: { section: 'thermal' } }; },
      sol() { return { ds: 'tf-7805', focus: { section: 'thermal' }, choice: W.regFail() }; },
      check: choiceCheck({ choices: ['Die Eingangsspannung von 15 V überschreitet das Maximum.', 'Der Ausgangsstrom von 0,9 A ist größer als der erlaubte Strom.', 'Die Verlustleistung von 9 W erhitzt die Sperrschicht ohne Kühlkörper weit über Tj max.', 'Der Regler braucht bei 5 V Ausgangsspannung eine andere Pinbelegung.'], want: () => W.regFail(),
        reasons: ['15 V liegen innerhalb der empfohlenen 7,5 V bis 25 V und unter dem Grenzwert 35 V.', '0,9 A liegen unter dem empfohlenen Höchstwert von 1 A.', null, 'Die Pinbelegung ist fest. Das Problem ist thermisch und steht in den Thermik-Angaben.'] }) },

    /* ---------------------------------------------------------------- Prüfungsstil */
    { id: 'ds33', lab: 'ds', cat: 'Prüfungsstil', title: 'LED am PCF8574 (Prüfungsaufgabe)', level: 2, ds: 'tf-pcf8574',
      text: 'Prüfungsaufgabe: An Port P0 deines TF-PCF8574 (VDD = 5 V) soll eine LED (UF = 2,0 V, IF = 10 mA) leuchten. Der Port ist quasi-bidirektional und kann kaum Strom liefern, deshalb liegt die LED mit der Anode an VDD und der Port zieht über den Vorwiderstand nach Masse (Low = LED an). Entnimm VOL (typ.) bei IOL = 10 mA den Electrical Characteristics des Datenblatts TF-PCF8574, markiere die Zeile und berechne den Vorwiderstand.',
      ask: { label: 'Vorwiderstand (rechnerisch)', unit: 'Ω' },
      hint: ['Die LED wird vom Port nach Masse geschaltet (Senke). Am Pin bleibt im Zustand Low noch die Spannung VOL stehen.', 'Suche die Zeile „Port output voltage low“ bei IOL = 10 mA und markiere sie. VOL (typ.) = 0,2 V.', 'R = (VDD − UF − VOL) / IF = (5 V − 2,0 V − 0,2 V) / 10 mA = 280 Ω. Mit dem Maximalwert VOL = 0,4 V ergäben sich 260 Ω. Der Datenblatt-Tipp: 270 Ω (E12).'],
      start() { return { ds: 'tf-pcf8574', focus: { section: 'elec' } }; },
      sol() { const w = W.pcfR(); return { ds: 'tf-pcf8574', focus: { section: 'elec', key: 'vol' }, value: w.r, marks: [{ ds: 'tf-pcf8574', section: 'elec', key: 'vol' }] }; },
      check: numCheck({ unit: 'Ω', want: () => W.pcfR().r, tol: 0.02, alts: () => [W.pcfR().rMax],
        mistakes: () => [[W.pcfR().none, 'Du hast VOL vergessen: Auch im Zustand Low bleibt am Port noch die Spannung VOL stehen.']],
        extra: (r, a) => { const ms = marksOf(a); r(hasMark(ms, 'tf-pcf8574', 'elec', 'vol'), 'Die Zeile „Port output voltage low“ (VOL) ist markiert', 'Markiere die Zeile, aus der du VOL entnimmst: „Port output voltage low“ in den Electrical Characteristics.'); } }) },
    { id: 'ds34', lab: 'ds', cat: 'Prüfungsstil', title: 'Digitalpoti auf 3,3 kΩ einstellen (Prüfungsaufgabe)', level: 3, ds: 'tf-mcp4151',
      text: 'Prüfungsaufgabe: Das Digitalpotentiometer TF-MCP4151 (Version 10 kΩ, 7 Bit) wird als einstellbarer Widerstand zwischen Wiper (Pin 6) und Anschluss B (Pin 7) verwendet. Er soll 3,3 kΩ haben. Lies den Wiper-Widerstand RW (typ., Code 0) aus den Electrical Characteristics ab und rechne mit der Formel aus dem Anwendungsbeispiel des Datenblatts TF-MCP4151. Welchen Wiper-Code (ganze Zahl) musst du schreiben?',
      ask: { label: 'Wiper-Code (ganze Zahl)', unit: '' },
      hint: ['Der Widerstand zwischen Wiper und B ist RWB = RW + n · RAB / 128. Stelle nach dem Code n um.', 'RW (typ.) = 75 Ω, RAB = 10 kΩ. Von den 3300 Ω gehen zuerst die 75 Ω des Wipers ab.', 'n = (3300 Ω − 75 Ω) · 128 / 10 000 Ω = 41,28. Gerundet ist der Code 41. Er liegt im gültigen Bereich 0 bis 128 und wird mit dem Befehlsbyte 0x00 und dem Datenbyte 0x29 übertragen.'],
      start() { return { ds: 'tf-mcp4151', focus: { section: 'elec' } }; },
      sol() { return { ds: 'tf-mcp4151', focus: { section: 'app', key: '0' }, value: W.mcpN().n }; },
      check: numCheck({ unit: '', want: () => W.mcpN().n, absTol: 0.5,
        mistakes: () => { const w = W.mcpN(); return [[3300 * 128 / w.rab, 'Du hast den Wiper-Widerstand RW nicht abgezogen. Der Wiper selbst hat bei Code 0 schon etwa 75 Ω.'], [w.rab / 128, 'Das ist die Schrittweite in Ω, nicht der Code.'], [Math.round(w.exact) + 1, 'Rechne genau und runde auf den nächsten ganzen Code.']]; },
        extra: (r, a, v) => { r(v !== null && v >= 0 && v <= 128, 'Der Code liegt im gültigen Bereich 0 bis 128', 'Das 7-Bit-Poti hat die Codes 0 bis 128 (129 Stufen).'); } }) }
  ];

  /* ====================================================================== Beispiele */
  const stepsSafe = fn => { try { return fn(); } catch (e) { return []; } };
  const EX = (o, steps, rechne) => {
    Object.defineProperty(o, 'steps', { enumerable: true, get() { return stepsSafe(steps); } });
    o.rechne = () => { try { return rechne(); } catch (e) { return null; } };
    return o;
  };
  const examples = [
    EX({ id: 'ds-aufbau', name: 'Aufbau eines Datenblatts: TF-LM317', cat: 'Grundlagen', ds: 'tf-lm317', focus: { section: 'abs' },
      desc: 'Jedes Datenblatt ist gleich aufgebaut: Titel mit Merkmalen, Pinbelegung, Grenzwerte, empfohlene Betriebsbedingungen, Kennwerte, Kennlinien, Thermik, Gehäuse und Anwendung. Beim TF-LM317 steht die größte Spannungsdifferenz von 40 V in den Absolute Maximum Ratings, die gleiche Obergrenze nennen auch die Recommended Operating Conditions, dort aber zusammen mit dem Mindestwert 3 V. Gehe die Abschnitte der Reihe nach durch und suche in jedem eine Zahl.' },
      () => { const d = need('tf-lm317'); return ['1. Titelseite: Typ ' + d.part + ', Merkmale, Gehäuse ' + d.pins.pkg + '.', '2. Pin configuration: Pin 1 = ADJ, Pin 2 = OUT, Pin 3 = IN.', '3. Absolute Maximum Ratings: VI−VO max = ' + fm(val(d, 'abs', 'vdiff', 'max')) + ' V (Zerstörungsgrenze).', '4. Recommended Operating Conditions: VI−VO von ' + fm(val(d, 'rec', 'vdiff', 'min')) + ' V bis ' + fm(val(d, 'rec', 'vdiff', 'max')) + ' V.', '5. Electrical Characteristics: Vref = ' + fm(val(d, 'elec', 'vref', 'min')) + ' / ' + fm(val(d, 'elec', 'vref', 'typ')) + ' / ' + fm(val(d, 'elec', 'vref', 'max')) + ' V (Min / Typ / Max).']; },
      () => { const d = need('tf-lm317'); return [{ label: 'VI−VO max', value: val(d, 'abs', 'vdiff', 'max'), unit: 'V', txt: '40 V' }, { label: 'Vref typ', value: val(d, 'elec', 'vref', 'typ'), unit: 'V', txt: '1,25' }]; }),
    EX({ id: 'ds-grenzwert', name: 'Grenzwerte lesen: TF-BC547', cat: 'Grundlagen', ds: 'tf-bc547', focus: { section: 'rec' },
      desc: 'Beim TF-BC547 sind 45 V als VCEO das Absolute Maximum Rating, empfohlen sind aber nur 0 bis 30 V. Mit 40 V läge der Transistor zwar unter dem Grenzwert, aber außerhalb des garantierten Betriebsbereichs. Absolute Maximum Ratings sind keine Betriebswerte, plane also immer Reserve ein.' },
      () => { const l = CORE().check(need('tf-bc547'), { vce: 40 }); return ['Betriebspunkt: VCE = 40 V.', 'Absolute Maximum Rating: VCEO max = ' + fm(val(need('tf-bc547'), 'abs', 'vceo', 'max')) + ' V (nicht überschritten).', 'Recommended Operating Conditions: VCE max = ' + fm(val(need('tf-bc547'), 'rec', 'vce', 'max')) + ' V (überschritten).', 'Ergebnis der Prüfung: ' + l[0].text]; },
      () => { const d = need('tf-bc547'); return [{ label: 'VCEO max', value: val(d, 'abs', 'vceo', 'max'), unit: 'V', txt: '45 V' }, { label: 'VCE rec max', value: val(d, 'rec', 'vce', 'max'), unit: 'V', txt: '30 V' }]; }),
    EX({ id: 'ds-minmax', name: 'Min, Typ, Max: hFE beim TF-BC547', cat: 'Kennwerte', ds: 'tf-bc547', focus: { section: 'elec', key: 'hfeB' },
      desc: 'Die Stromverstärkung streut stark, deshalb gibt es im TF-BC547 die Gruppen A, B und C. Für Gruppe B nennt das Datenblatt hFE = 200 (Min), 290 (Typ) und 450 (Max) bei VCE = 5 V und IC = 2 mA. Bei der Auslegung rechnest du mit dem Mindestwert, damit die Schaltung auch mit dem schlechtesten Exemplar funktioniert.' },
      () => { const d = need('tf-bc547'); return ['Zeile: DC current gain, group B, Testbedingungen VCE = 5 V, IC = 2 mA, Tj = 25 °C.', 'Min = ' + fm(val(d, 'elec', 'hfeB', 'min')) + ', Typ = ' + fm(val(d, 'elec', 'hfeB', 'typ')) + ', Max = ' + fm(val(d, 'elec', 'hfeB', 'max')) + '.', 'Für den Basisstrom eines Schalters wird mit dem Min-Wert gerechnet: IB = IC / hFE(min).']; },
      () => { const d = need('tf-bc547'); return [{ label: 'hFE B min', value: val(d, 'elec', 'hfeB', 'min'), unit: '', txt: '200' }, { label: 'hFE B max', value: val(d, 'elec', 'hfeB', 'max'), unit: '', txt: '450' }]; }),
    EX({ id: 'ds-kennlinie-vf', name: 'Kennlinie ablesen: Durchlassspannung des TF-1N4148', cat: 'Kennlinien', ds: 'tf-1n4148', focus: { section: 'graphs', index: 0 }, mode: 'ablesen',
      desc: 'Die Kennlinie zeigt den Durchlassstrom über der Durchlassspannung, die y-Achse ist logarithmisch geteilt. Bei 10 mA liest du für Tj = 25 °C etwa 0,73 V ab, bei Tj = 100 °C nur etwa 0,57 V. Die Kurve verschiebt sich mit der Temperatur um etwa 2 mV pro Kelvin nach links.' },
      () => ['1. Kurve Tj = 25 °C wählen.', '2. Auf der logarithmischen y-Achse den Strom 10 mA suchen (Hauptstrich zwischen 1 mA und 100 mA).', '3. Waagerecht bis zur Kurve und senkrecht zur x-Achse: VF = ' + fm(invC('tf-1n4148', 'if_vf', 1, 0.01), 3) + ' V.', '4. Zum Vergleich Kurve Tj = 100 °C: VF = ' + fm(invC('tf-1n4148', 'if_vf', 2, 0.01), 3) + ' V.', '5. Kontrolle mit der Tabelle: VF typ. = ' + fm(val(need('tf-1n4148'), 'elec', 'vf10', 'typ')) + ' V.'],
      () => [{ label: 'VF 25 °C', value: invC('tf-1n4148', 'if_vf', 1, 0.01), unit: 'V', txt: '0,731' }, { label: 'VF 100 °C', value: invC('tf-1n4148', 'if_vf', 2, 0.01), unit: 'V', txt: '0,574' }]),
    EX({ id: 'ds-kennlinie-555', name: 'Logarithmische Achsen: Frequenz des TF-NE555', cat: 'Kennlinien', ds: 'tf-ne555', focus: { section: 'graphs', index: 0 }, mode: 'ablesen',
      desc: 'Beide Achsen der Kennlinie „Astable frequency vs. RB“ sind logarithmisch: Gleiche Abstände bedeuten gleiche Faktoren, nicht gleiche Differenzen. Für C = 100 nF und RB = 10 kΩ liest du etwa 686 Hz ab. Die Formel f = 1,44 / ((RA + 2·RB)·C) mit RA = 1 kΩ bestätigt das.' },
      () => { const f = readC('tf-ne555', 'f_rb', 1, 10000); return ['1. Kurve C = 100 nF wählen, x-Achse ist der Widerstand RB.', '2. Bei RB = 10 kΩ senkrecht nach oben bis zur Kurve: f = ' + fm(f, 3) + ' Hz.', '3. Kontrolle mit der Formel: f = 1,44 / ((1 kΩ + 2 · 10 kΩ) · 100 nF) = ' + fm(1.44 / ((1000 + 20000) * 100e-9), 3) + ' Hz.']; },
      () => [{ label: 'f bei 10 kΩ', value: readC('tf-ne555', 'f_rb', 1, 10000), unit: 'Hz', txt: '686' }]),
    EX({ id: 'ds-dropout', name: 'Dropout-Spannung des TF-LM317 ablesen', cat: 'Kennlinien', ds: 'tf-lm317', focus: { section: 'graphs', index: 0 }, mode: 'ablesen',
      desc: 'Die Dropout-Spannung steigt mit dem Laststrom und mit der Temperatur. Bei 1,5 A und Tj = 25 °C liest du 2,0 V ab, bei 125 °C etwa 2,14 V. Für 5 V am Ausgang braucht der Regler bei 1,5 A und 25 °C also mindestens 7 V am Eingang.' },
      () => ['1. Kurve Tj = 25 °C wählen.', '2. Bei IO = 1,5 A senkrecht nach oben bis zur Kurve: VDO = ' + fm(readC('tf-lm317', 'dropout', 1, 1.5), 3) + ' V.', '3. Mindest-Eingangsspannung für 5 V: Vin = 5 V + ' + fm(readC('tf-lm317', 'dropout', 1, 1.5), 3) + ' V = ' + fm(5 + readC('tf-lm317', 'dropout', 1, 1.5), 3) + ' V.', '4. Bei Tj = 125 °C: VDO = ' + fm(readC('tf-lm317', 'dropout', 2, 1.5), 3) + ' V.'],
      () => [{ label: 'VDO 25 °C', value: readC('tf-lm317', 'dropout', 1, 1.5), unit: 'V', txt: '2,0 V' }, { label: 'VDO 125 °C', value: readC('tf-lm317', 'dropout', 2, 1.5), unit: 'V', txt: '2,14 V' }]),
    EX({ id: 'ds-led', name: 'LED-Vorwiderstand aus dem Datenblatt', cat: 'Auslegung', ds: 'tf-led-r', focus: { section: 'elec', key: 'vf20' }, calc: { id: 'led', vals: { us: 5, uf: 2, if: 20 } },
      desc: 'Aus der Tabelle des TF-LED-R5 liest du VF = 2,0 V bei IF = 20 mA ab. An 5 V ergibt sich ein Vorwiderstand von 150 Ω, der zugleich ein E12-Wert ist. Die Leistung im Widerstand beträgt nur 60 mW, ein 0,25-W-Widerstand reicht.' },
      () => { const l = CORE().ledResistor(5, 2, 0.02); return ['1. VF aus der Tabelle: ' + fm(val(need('tf-led-r'), 'elec', 'vf20', 'typ')) + ' V bei IF = 20 mA.', '2. Spannung am Widerstand: 5 V − 2,0 V = ' + fm(l.uR) + ' V.', '3. R = ' + fm(l.uR) + ' V / 20 mA = ' + fm(l.r) + ' Ω, E12 aufgerundet: ' + fm(l.rE12) + ' Ω.', '4. Leistung: P = ' + fm(l.uR * 0.02 * 1000) + ' mW. Grenzwert der LED nicht überschritten: IF max = ' + fm(val(need('tf-led-r'), 'abs', 'if', 'max')) + ' mA.']; },
      () => { const l = CORE().ledResistor(5, 2, 0.02); return [{ label: 'R', value: l.r, unit: 'Ω', txt: '150 Ω' }, { label: 'P', value: l.uR * 0.02 * 1000, unit: 'mW', txt: '60 mW' }]; }),
    EX({ id: 'ds-basis', name: 'Basiswiderstand für den Schalttransistor TF-BC547', cat: 'Auslegung', ds: 'tf-bc547', focus: { section: 'elec', key: 'hfeA' }, calc: { id: 'rb', fromDs: true, vals: { ic: 40, ust: 5, ue: 3 } },
      desc: 'Ein Relais mit 40 mA soll aus 5 V geschaltet werden. Der Schalter wird übersteuert: mit dem Mindestwert hFE = 110 und dem Faktor 3 ergibt sich ein Basisstrom von etwa 1,09 mA. Daraus folgt ein Basiswiderstand von rund 3,94 kΩ; der nächste E12-Wert nach unten ist 3,9 kΩ.' },
      () => { const hfe = val(need('tf-bc547'), 'elec', 'hfeA', 'min'), ib = 3 * 0.04 / hfe, rb = (5 - 0.7) / ib; return ['1. Kleinstes hFE (Gruppe A): ' + fm(hfe) + '.', '2. Basisstrom mit Übersteuerung 3: IB = 3 · 40 mA / ' + fm(hfe) + ' = ' + fm(ib * 1000, 3) + ' mA.', '3. RB = (5 V − 0,7 V) / ' + fm(ib * 1000, 3) + ' mA = ' + fm(rb, 3) + ' Ω.', '4. E12 nach unten: ' + fm(CORE().eSeries('E12', rb, 'down')) + ' Ω.']; },
      () => { const hfe = val(need('tf-bc547'), 'elec', 'hfeA', 'min'), ib = 3 * 0.04 / hfe, rb = (5 - 0.7) / ib; return [{ label: 'IB', value: ib * 1000, unit: 'mA', txt: '1,09 mA' }, { label: 'RB', value: rb, unit: 'Ω', txt: '3,9 kΩ' }]; }),
    EX({ id: 'ds-lm317-wc', name: 'Toleranzen: Ausgangsspannung des TF-LM317', cat: 'Auslegung', ds: 'tf-lm317', focus: { section: 'elec', key: 'vref' }, calc: { id: 'wc317', fromDs: true, vals: { r1: 240, r2: 720, t: 1 } },
      desc: 'Mit R1 = 240 Ω und R2 = 720 Ω ergibt der TF-LM317 typisch etwa 5,04 V. Weil Vref zwischen 1,2 V und 1,3 V streut und beide Widerstände ±1 % haben, liegt der Ausgang im ungünstigsten Fall zwischen etwa 4,73 V und 5,35 V. Eine Schaltung für 5 V darf also nicht auf 5,00 V genau angewiesen sein.' },
      () => { const w = W.lm317Wc(); return ['1. Formel: Vout = Vref · (1 + R2 / R1) + Iadj · R2.', '2. Nennwert: ' + fm(w.nom, 3) + ' V.', '3. Minimum: kleinste Vref, R2 klein, R1 groß, Iadj = 0: ' + fm(w.min, 3) + ' V.', '4. Maximum: größte Vref, R2 groß, R1 klein, Iadj max: ' + fm(w.max, 3) + ' V.']; },
      () => { const w = W.lm317Wc(); return [{ label: 'Nenn', value: w.nom, unit: 'V', txt: '5,04' }, { label: 'Min', value: w.min, unit: 'V', txt: '4,73' }, { label: 'Max', value: w.max, unit: 'V', txt: '5,35' }]; }),
    EX({ id: 'ds-555', name: 'NE555: Frequenz und Tastgrad', cat: 'Auslegung', ds: 'tf-ne555', focus: { section: 'app', key: '0' }, calc: { id: 't555', vals: { mode: 'a', r1: '4,7k', r2: '47k', c: '100n' } },
      desc: 'Mit RA = 4,7 kΩ, RB = 47 kΩ und C = 100 nF schwingt der TF-NE555 mit etwa 146 Hz. Der Ausgang ist 52 % der Zeit high, weil der Kondensator über RA und RB geladen, aber nur über RB entladen wird. Die Formeln stehen im Anwendungsbeispiel des Datenblatts.' },
      () => { const f = W.f555(), d = (4700 + 47000) / (4700 + 94000); return ['1. f = 1,44 / ((RA + 2·RB) · C) = 1,44 / (98,7 kΩ · 100 nF) = ' + fm(f, 3) + ' Hz.', '2. Tastgrad = (RA + RB) / (RA + 2·RB) = ' + fm(d * 100, 3) + ' %.', '3. Perioden: tH = 0,693 · (RA + RB) · C = ' + fm(0.693 * 51700 * 100e-9 * 1000, 3) + ' ms, tL = 0,693 · RB · C = ' + fm(0.693 * 47000 * 100e-9 * 1000, 3) + ' ms.']; },
      () => [{ label: 'f', value: W.f555(), unit: 'Hz', txt: '146' }, { label: 'Tastgrad', value: (4700 + 47000) / (4700 + 94000) * 100, unit: '%', txt: '52,4' }]),
    EX({ id: 'ds-7805', name: 'Verlustleistung und Tj: TF-7805', cat: 'Thermik', ds: 'tf-7805', focus: { section: 'thermal' }, calc: { id: 'pd', fromDs: true, vals: { p: 2.45, ta: 40 } },
      desc: 'Ein TF-7805 macht aus 12 V stabile 5 V bei 0,35 A und setzt dabei 2,45 W in Wärme um. Mit Rth(j-a) = 50 K/W steigt die Sperrschicht bei 40 °C Umgebung auf 162,5 °C. Das liegt über Tj max = 125 °C: Ohne Kühlkörper ist diese Schaltung nicht zulässig.' },
      () => { const t = W.tj7805(); return ['1. Verlustleistung: P = (12 V − 5 V) · 0,35 A = ' + fm(t.p, 3) + ' W.', '2. Wärmewiderstand aus Thermal information: Rth(j-a) = ' + fm(need('tf-7805').thermal.rthJA) + ' K/W.', '3. Tj = 40 °C + ' + fm(t.p, 3) + ' W · 50 K/W = ' + fm(t.tj, 4) + ' °C.', '4. Vergleich: Tj max = ' + fm(t.tjMax) + ' °C. Überschritten, also Kühlkörper oder kleineren Spannungsabfall wählen.']; },
      () => { const t = W.tj7805(); return [{ label: 'P', value: t.p, unit: 'W', txt: '2,45 W' }, { label: 'Tj', value: t.tj, unit: '°C', txt: '162,5' }]; }),
    EX({ id: 'ds-derate', name: 'Derating beim Leistungstransistor TF-BD139', cat: 'Thermik', ds: 'tf-bd139', focus: { section: 'thermal' }, calc: { id: 'derate', fromDs: true, vals: { ta: 70 } },
      desc: 'Der TF-BD139 darf in freier Luft bei 25 °C 1,25 W umsetzen. Bei 70 °C Umgebungstemperatur sinkt die zulässige Verlustleistung auf 0,8 W, weil Tj max = 150 °C und Rth(j-a) = 100 K/W gelten. Der Tabellenwert Ptot gilt also nur bei 25 °C.' },
      () => { const d = CORE().derate(need('tf-bd139'), { tAmb: 70 }); return ['1. Aus Thermal information: Rth(j-a) = ' + fm(need('tf-bd139').thermal.rthJA) + ' K/W, Tj max = ' + fm(need('tf-bd139').thermal.tjMax) + ' °C.', '2. Ptot(70 °C) = (150 °C − 70 °C) / 100 K/W = ' + fm(d.ptotAllowed, 3) + ' W.', '3. Zum Vergleich bei 25 °C: ' + fm(CORE().derate(need('tf-bd139'), { tAmb: 25 }).ptotAllowed, 3) + ' W.']; },
      () => [{ label: 'Ptot 70', value: CORE().derate(need('tf-bd139'), { tAmb: 70 }).ptotAllowed, unit: 'W', txt: '0,8 W' }, { label: 'Ptot 25', value: CORE().derate(need('tf-bd139'), { tAmb: 25 }).ptotAllowed, unit: 'W', txt: '1,25 W' }]),
    EX({ id: 'ds-i2c', name: 'PCF8574: Adresse und Pull-up am I²C-Bus', cat: 'Bussysteme', ds: 'tf-pcf8574', focus: { section: 'pins' }, calc: { id: 'i2c', vals: { vcc: 3.3, cb: 100, mode: 's', iol: 3, vol: 0.4 } },
      desc: 'Der TF-PCF8574 hat drei Adresspins A0 bis A2 und liegt damit auf den 7-Bit-Adressen 0x20 bis 0x27. Die Pull-up-Widerstände am Bus müssen so klein sein, dass die Flanken schnell genug sind, aber groß genug, damit der Low-Pegel mit 3 mA erreicht wird. Bei 3,3 V und 100 pF liegen sie zwischen etwa 0,97 kΩ und 11,8 kΩ.' },
      () => { const lo = (3.3 - 0.4) / 0.003, hi = 1e-6 / (0.8473 * 100e-12); return ['1. Pin configuration: SDA = Pin 15, SCL = Pin 14, A0 bis A2 = Pins 1 bis 3.', '2. Adresse = 0x20 + (A2 A1 A0); bei allen Adresspins an Masse 0x20.', '3. Rp(min) = (VDD − VOL) / IOL = (3,3 V − 0,4 V) / 3 mA = ' + fm(lo, 3) + ' Ω.', '4. Rp(max) = tr / (0,8473 · Cb) = 1 µs / (0,8473 · 100 pF) = ' + fm(hi, 3) + ' Ω.']; },
      () => [{ label: 'Rp min', value: (3.3 - 0.4) / 0.003, unit: 'Ω', txt: '967' }, { label: 'Rp max', value: 1e-6 / (0.8473 * 100e-12), unit: 'Ω', txt: '11800' }]),
    EX({ id: 'ds-lm75', name: 'Register lesen: TF-LM75', cat: 'Bussysteme', ds: 'tf-lm75', focus: { section: 'regs' },
      desc: 'Das Temperaturregister des TF-LM75 enthält 9 Bit im Zweierkomplement, jedes Bit steht für 0,5 °C. Aus den Bytes 0x19 und 0x00 wird 25 °C, aus 0xE7 und 0x00 wird −25 °C. Die Slave-Adresse ist 0x48 bei A2 A1 A0 = 000.' },
      () => ['1. Zwei Bytes lesen, MSB zuerst: 0x1900.', '2. Rechts schieben um 7 Bit: 0x1900 >> 7 = 50.', '3. Temperatur = 50 · 0,5 °C = ' + fm((0x1900 >> 7) * 0.5, 3) + ' °C.', '4. Negativ: 0xE700 >> 7 = 462, 462 − 512 = −50, also ' + fm((462 - 512) * 0.5, 3) + ' °C.'],
      () => [{ label: 'T 0x1900', value: (0x1900 >> 7) * 0.5, unit: '°C', txt: '25 °C' }, { label: 'T 0xE700', value: ((0xE700 >> 7) - 512) * 0.5, unit: '°C', txt: '−25' }])
  ];

  /* ====================================================================== Ausführung, Selbsttest */
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));
  const DS_TASKS = {
    tasks,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie dsui.js collectAnswer, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    const ch = task.ask && Array.isArray(task.ask.choices) ? task.ask.choices : null, c = fin(o.choice) ? o.choice : null;
    return { ds: o.ds || task.ds, tab: o.tab || 'lib', value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : fin(o.value) ? String(o.value).replace('.', ',') : (c !== null && ch ? ch[c] : ''), choice: c, choiceText: c !== null && ch ? ch[c] : '',
      calc: o.calcAns || null, calcId: o.calcAns ? o.calcAns.id : null, marks: Array.isArray(o.marks) ? o.marks : [], reads: Array.isArray(o.reads) ? o.reads : [], lastRead: isObj(o.lastRead) ? o.lastRead : null, readsN: Array.isArray(o.reads) ? o.reads.length : 0, question: null, simTime: 0 };
  }
  root.DS_DATA = { examples };
  root.DS_TASKS = DS_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await DS_TASKS.run(t, answerOf(t, t.start()))), L = await DS_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { examples, tasks, run: DS_TASKS.run, answerOf, W, numAns, choiceIdx };
})(typeof window !== 'undefined' ? window : globalThis);
