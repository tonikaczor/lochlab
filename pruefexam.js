'use strict';
/* Tonfunk Prüfungs-Lab: Ziehlogik und Auswertung des Prüfungsmodus (reine Funktionen, laufen im Browser und in Node).
   Siehe quelle/SPEC-PRUEFUNG-COACH-FABLE.md, Abschnitte 3.2 und 3.3. Es gibt hier keine Aufgaben und keine Fachwerte: die Funktionen bekommen den Pool
   (pruefpool.js) als Parameter und ändern ihn nicht. Der IHK-Notenschlüssel steht nur in pruefwerk.js (NOTE); report() bekommt ihn als Parameter.
   draw(pool, cfg, seed): zieht Aufgaben nach Themengruppe (Gewicht = Anteil im Pool, schwache Themen bis 1,5-fach, nie 0), Niveau-Quote und Rechenanteil.
   Gleicher Seed + gleiche Konfiguration = gleiche Auswahl. */
(function (root) {
  const QUOTA = { mix: [0.3, 0.5, 0.2], leicht: [0.7, 0.3, 0], schwer: [0, 0.5, 0.5] };   // Anteil Niveau 1 / 2 / 3
  const NIVEAU_T = { mix: 'wie Prüfung (leicht, mittel, schwer gemischt)', leicht: 'leicht (Niveau 1 vor 2)', schwer: 'schwer (Niveau 2 und 3)' };
  /* Themenpakete: vorläufige Zuordnung der 13 Pool-Gruppen zu Lernfeld-Bereichen (Abstimmung mit den Ausbildern offen, siehe NACHTRAG-PRUEFUNG.md).
     Nur ein Auswahl-Hilfsmittel in der Maske; gespeichert wird immer die Liste der Gruppen. */
  const PAKETE = [
    { k: 'ana', t: 'Analoge Schaltungen', groups: ['grund', 'halb', 'opv', 'netz'] },
    { k: 'dig', t: 'Digitaltechnik, Programmieren, Bus, IT', groups: ['digi', 'mcu', 'bus', 'itpc'] },
    { k: 'mes', t: 'Messen und Steuern', groups: ['mess', 'steu'] },
    { k: 'sic', t: 'Sicherheit und Qualität', groups: ['sich', 'qm'] },
    { k: 'wiso', t: 'Wirtschafts- und Sozialkunde', groups: ['wiso'] }
  ];
  const MIN_JE_A = 2.5, MIN_JE_B = 6;   // Minuten je gebundene Aufgabe / je Rechenaufgabe (Spec 3.1 Schritt 3)

  const seeded = seed => { let a = seed >>> 0; const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return { f, shuffle: arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; } }; };
  const num = v => { v = +v; return isFinite(v) ? v : 0; };

  /* n auf Gewichte verteilen (größter Rest, Zufall nur bei Gleichstand). w: { schlüssel: Gewicht > 0 }. Jeder Schlüssel bekommt mindestens 1, wenn n reicht. */
  function distribute(n, w, r) {
    const ks = Object.keys(w).filter(k => w[k] > 0), out = {}; ks.forEach(k => { out[k] = 0; });
    n = Math.max(0, Math.floor(num(n))); if (!ks.length || !n) return out;
    const sum = ks.reduce((s, k) => s + w[k], 0), raw = ks.map(k => ({ k, v: n * w[k] / sum }));
    raw.forEach(x => { out[x.k] = Math.floor(x.v); });
    let rest = n - ks.reduce((s, k) => s + out[k], 0);
    const tie = r ? r.shuffle(ks) : ks, order = raw.slice().sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)) || tie.indexOf(a.k) - tie.indexOf(b.k));
    for (let i = 0; rest > 0; i = (i + 1) % order.length, rest--) out[order[i].k]++;
    if (n >= ks.length) {   // nie 0: fehlende Gruppen bekommen 1 von der größten
      ks.filter(k => out[k] === 0).sort((a, b) => w[b] - w[a]).forEach(k => { const big = ks.filter(x => out[x] > 1).sort((a, b) => out[b] - out[a])[0]; if (big) { out[big]--; out[k] = 1; } });
    }
    return out;
  }
  /* Quote [a,b,c] auf n Stück (größter Rest) */
  function split(n, quota) {
    const raw = quota.map((q, i) => ({ i, v: n * q })), out = raw.map(x => Math.floor(x.v)); let rest = n - out.reduce((s, x) => s + x, 0);
    raw.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)) || b.i - a.i);
    for (let j = 0; rest > 0; j = (j + 1) % raw.length, rest--) out[raw[j].i]++;
    return out;
  }
  /* n Aufgaben einer Gruppe nach Niveau-Quote ziehen; fehlt ein Niveau, wird aus dem Nachbarniveau aufgefüllt */
  function pickGroup(G, n, quota, r, harder) {
    const lv = [1, 2, 3].map(k => r.shuffle(G.filter(p => (p.n || 2) === k))), want = split(n, quota), out = [];
    const take = (k, c) => { const l = lv[k - 1], got = l.splice(0, Math.max(0, c)); out.push(...got); return c - got.length; };
    const miss = [0, 0, 0]; for (let k = 1; k <= 3; k++) miss[k - 1] = take(k, want[k - 1]);
    for (let k = 1; k <= 3; k++) {
      let d = miss[k - 1]; if (d <= 0) continue;
      const near = [1, 2, 3].filter(x => x !== k).sort((a, b) => Math.abs(a - k) - Math.abs(b - k) || (harder ? b - a : a - b));
      near.forEach(x => { if (d > 0) d = take(x, d); });
    }
    return out;
  }
  /* Rechenanteil herstellen: Aufgaben derselben Gruppe (möglichst gleiches Niveau) gegen eine Aufgabe der anderen Art tauschen */
  function adjustCalc(out, src, targetCalc, r) {
    const isNum = p => !p.o, ids = new Set(out.map(p => p.id));
    const calc = () => out.filter(isNum).length;
    let guard = 400;
    while (calc() !== targetCalc && guard-- > 0) {
      const wantMoreCalc = calc() < targetCalc;
      const from = r.shuffle(out.filter(p => (wantMoreCalc ? !isNum(p) : isNum(p))));
      let done = false;
      for (const x of from) {
        const cand = src.filter(p => !ids.has(p.id) && p.g === x.g && (wantMoreCalc ? isNum(p) : !isNum(p)));
        if (!cand.length) continue;
        cand.sort((a, b) => Math.abs((a.n || 2) - (x.n || 2)) - Math.abs((b.n || 2) - (x.n || 2)));
        const y = cand[0]; out[out.indexOf(x)] = y; ids.delete(x.id); ids.add(y.id); done = true; break;
      }
      if (!done) break;   // keine Tauschmöglichkeit mehr (Gruppe hat nur eine Art)
    }
    return out;
  }
  /* Ausschlussgruppen (optionales Feld ex der Pool-Aufgaben: Kennung einer Gruppe praktisch gleicher Aufgaben, z. B. 'tns').
     Aus jeder Gruppe bleibt in list nur EINE zufällige Aufgabe (keep); die übrigen kommen nach rest, damit man auffüllen kann, wenn sonst Aufgaben fehlen.
     avoid: Kennungen, die schon belegt sind (dann bleibt keine). Ohne ex-Felder: keep = list, rest = [] und der Zufallsstrom r wird nicht berührt (alte Pools ziehen wie vorher). */
  function exPick(list, r, avoid) {
    const by = {}; list.forEach(p => { if (p && p.ex) (by[p.ex] = by[p.ex] || []).push(p); });
    const ks = Object.keys(by).sort(); if (!ks.length) return { keep: list, rest: [] };
    const av = new Set(avoid || []), drop = new Set();
    ks.forEach(k => { const m = by[k], one = av.has(k) ? null : r.shuffle(m)[0]; m.forEach(p => { if (p !== one) drop.add(p); }); });
    return { keep: list.filter(p => !drop.has(p)), rest: list.filter(p => drop.has(p)) };
  }
  const exIds = items => [...new Set((items || []).map(p => p && p.ex).filter(Boolean))].sort();
  /* cfg = { teil:['Teil1'], groups:['grund',…], n:20, calcShare:0.4, niveau:'mix'|'leicht'|'schwer', only:'mc'|'num', weak:{ g: Prozent }, avoid:[ex-Kennungen schon belegt] }
     Rückgabe { items: [Pool-Aufgaben, Rechenaufgaben zuletzt, Gruppe nach cfg.groups geordnet], meta: { n, byGroup, byNiveau, mc, calc, few: [Gruppen mit weniger als 10 Aufgaben im Pool-Ausschnitt], ex: [gezogene ex-Kennungen], exDup: Anzahl Aufgaben, die nur zum Auffüllen eine schon belegte Ausschlussgruppe wiederholen] }
     Je Ausschlussgruppe (Feld ex) kommt höchstens eine Aufgabe in die Ziehung; nur wenn sonst weniger als n Aufgaben zusammenkommen, wird mit Wiederholungen aufgefüllt. */
  function draw(pool, cfg, seed) {
    const all = Array.isArray(pool) ? pool : (pool && pool.q) || [], c = cfg || {}, r = seeded(seed == null ? 1 : seed);
    const teil = c.teil && c.teil.length ? c.teil : null, groups = c.groups && c.groups.length ? c.groups : null;
    const src0 = all.filter(p => (!teil || teil.includes(p.teil)) && (!groups || groups.includes(p.g)) && (c.only === 'mc' ? !!p.o : c.only === 'num' ? !p.o : true));
    const meta = { n: 0, byGroup: {}, byNiveau: { 1: 0, 2: 0, 3: 0 }, mc: 0, calc: 0, few: [], ex: [], exDup: 0 };
    if (!src0.length) return { items: [], meta };
    const src = exPick(src0, r, c.avoid).keep;   // höchstens eine Aufgabe je Ausschlussgruppe; src0 bleibt für die Anzahl und das Auffüllen
    const order = groups || [...new Set(src0.map(p => p.g))], gs = order.filter(g => src.some(p => p.g === g));
    const n = Math.max(0, Math.min(Math.floor(num(c.n)) || 0, src0.length));
    const avail = {}; gs.forEach(g => { avail[g] = src.filter(p => p.g === g).length; if (avail[g] < 10) meta.few.push(g); });
    const w = {}; gs.forEach(g => { const base = avail[g] / src.length, p = c.weak && c.weak[g]; w[g] = base * (p != null && isFinite(+p) && +p < 60 ? 1 + 0.5 * (60 - Math.max(0, +p)) / 60 : 1); });
    let cnt = distribute(n, w, r);
    // Gruppen mit zu wenigen Aufgaben deckeln, den Rest nach Gewicht auf die anderen verteilen
    for (let it = 0; it < 12; it++) {
      let over = 0; gs.forEach(g => { if (cnt[g] > avail[g]) { over += cnt[g] - avail[g]; cnt[g] = avail[g]; } });
      if (!over) break;
      const free = {}; gs.forEach(g => { if (cnt[g] < avail[g]) free[g] = w[g]; });
      if (!Object.keys(free).length) break;
      const add = distribute(over, free, r); Object.keys(add).forEach(g => { cnt[g] += add[g]; });
    }
    const quota = QUOTA[c.niveau] || QUOTA.mix; let out = [];
    gs.forEach(g => { out.push(...pickGroup(src.filter(p => p.g === g), cnt[g] || 0, quota, r, c.niveau === 'schwer')); });
    if (out.length < n) {   // Sicherheitsnetz: auffüllen, zuerst mit Aufgaben aus noch nicht belegten Ausschlussgruppen, erst zuletzt mit Wiederholungen
      const ids = new Set(out.map(p => p.id)), exu = new Set((c.avoid || []).concat(exIds(out))), left = r.shuffle(src0.filter(p => !ids.has(p.id)));
      while (out.length < n && left.length) { let k = left.findIndex(p => !p.ex || !exu.has(p.ex)); if (k < 0) k = 0; const p = left.splice(k, 1)[0]; out.push(p); if (p.ex) exu.add(p.ex); }
    }
    if (c.calcShare != null && !c.only) {
      const target = Math.min(Math.round(n * Math.max(0, Math.min(1, num(c.calcShare)))), src.filter(p => !p.o && gs.includes(p.g)).length, n);
      out = adjustCalc(out, src, target, r);
    }
    const gi = g => { const i = order.indexOf(g); return i < 0 ? 99 : i; };
    const A = out.filter(p => p.o), Bq = out.filter(p => !p.o);   // gebundene zuerst (Teil A), Rechnen danach (Teil B), je nach Gruppenreihenfolge
    const sortG = l => r.shuffle(l).sort((a, b) => gi(a.g) - gi(b.g));
    const items = sortG(A).concat(sortG(Bq));
    meta.ex = exIds(items); meta.exDup = items.filter(p => p.ex).length - meta.ex.length;
    items.forEach(p => { meta.byGroup[p.g] = (meta.byGroup[p.g] || 0) + 1; meta.byNiveau[p.n || 2] = (meta.byNiveau[p.n || 2] || 0) + 1; if (p.o) meta.mc++; else meta.calc++; });
    meta.n = items.length;
    return { items, meta };
  }
  /* Themenstand der Gruppen eines Bereichs aus pr.state.tr (Schlüssel 'p:<gruppe>@<1|2>', mindestens 5 Antworten): { gruppe: Prozent richtig } */
  function weakMap(tr, areaN) {
    const out = {}; if (!tr || typeof tr !== 'object') return out;
    Object.keys(tr).forEach(k => { const m = /^p:([^@]+)@(\d)$/.exec(k); if (!m || m[2] !== String(areaN)) return; const t = tr[k], n = num(t && t.n); if (n >= 5) out[m[1]] = Math.round(100 * num(t.r) / n); });
    return out;
  }
  /* Zeitvorschlag in Minuten (auf 5 gerundet, mindestens 5) */
  function suggestLimit(nA, nB) { const m = nA * MIN_JE_A + nB * MIN_JE_B; return Math.max(5, Math.round(m / 5) * 5); }
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  /* Auswertung einer abgegebenen Prüfung. e: { qs, ans, flags, tq }, NOTE: Notenfunktion aus pruefwerk.js, fns: { isRight(q, a), score(e) -> { pct, topics, a, b, dropped } }
     Rückgabe { pct, note, noteT, a, b, byTopic, byNiveau:{1:[richtig,gesamt],…}, byTeil:{A,B}, slow:[ids], unanswered:[ids], marked:[ids] } (nur gewertete Aufgaben) */
  function report(e, NOTE, fns) {
    const c = fns.score(e), nt = NOTE(c.pct), dropped = new Set(c.dropped || []), ans = e.ans || {};
    const counted = (e.qs || []).filter(q => !dropped.has(q.id)), byNiveau = { 1: [0, 0], 2: [0, 0], 3: [0, 0] }, byTeil = { A: [0, 0], B: [0, 0] }, unanswered = [];
    counted.forEach(q => {
      const ok = fns.isRight(q, ans[q.id]), a = ans[q.id];
      if (q.niv >= 1 && q.niv <= 3) { byNiveau[q.niv][1]++; if (ok) byNiveau[q.niv][0]++; }
      const part = q.part || (q.type === 'mc' ? 'A' : 'B'); byTeil[part][1]++; if (ok) byTeil[part][0]++;
      if (a == null || a === '') unanswered.push(q.id);
    });
    const tq = e.tq || {}, ts = counted.map(q => num(tq[q.id])).filter(x => x > 0), med = median(ts);
    const slow = ts.length >= 5 && med > 0 ? counted.filter(q => num(tq[q.id]) > 2 * med).map(q => q.id) : [];
    const marked = Object.keys(e.flags || {}).filter(id => e.flags[id]);
    return { pct: c.pct, note: nt[0], noteT: nt[1], a: c.a || null, b: c.b || null, byTopic: c.topics, byNiveau, byTeil, slow, unanswered, marked };
  }
  /* Falsch beantwortete Aufgaben einer abgegebenen Prüfung (Grundlage für die Lernkarten aus Prüfungsfehlern, pkarten.js): nur beantwortete und nicht abgewählte Aufgaben, in Prüfungsreihenfolge.
     e: { qs, ans }, isRight(q, a), dropped: Ids der abgewählten Aufgaben */
  function falsch(e, isRight, dropped) {
    const d = new Set(dropped || []), ans = (e && e.ans) || {};
    return ((e && e.qs) || []).filter(q => !d.has(q.id) && ans[q.id] != null && ans[q.id] !== '' && !isRight(q, ans[q.id]));
  }
  /* Kurzform der Auswahl für den Verlauf (kein Export in hist-Einträgen von stand.js, nur lokal) */
  const cfgShort = c => ({ g: (c.groups || []).slice(0, 14), nv: c.niveau || 'mix', n: c.n || 0 });

  const api = { QUOTA, NIVEAU_T, PAKETE, MIN_JE_A, MIN_JE_B, seeded, distribute, split, pickGroup, exPick, exIds, draw, weakMap, suggestLimit, report, falsch, cfgShort, median };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PR_EXAM = api;
})(typeof window !== 'undefined' ? window : globalThis);
