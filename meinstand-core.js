'use strict';
/* Tonfunk Lab: „Mein Stand“, Kern (ohne DOM, läuft in Node und im Browser; Oberfläche: meinstand.js, Seite: meinstand.html).
   Liest NUR, schreibt nie in den Speicher. build(env) macht aus den vorhandenen Fortschrittsdaten EIN Modell:
   Ampel je Lernfeld/Modul, Ampel je Prüfungsthema, fällige Karten, Serie der Lerntage, nächster sinnvoller Schritt.
   Eingabe env: { read(key) -> Text|null (wie localStorage.getItem), AUFGABEN, LAB_REG, VB_INDEX, beruf, now,
                  AP (AusbildungsPlan-Kern, optional), Wdh (wiederholen.js, optional), Coach (coach.js, optional), recommend() (Lernpfad, optional),
                  karriere() -> { n, t, xp, next } (optional), kampTotal, badgeTotal (optional), alleThemen: [Schlüssel] (optional), topicTitle(k) (optional) }.

   ===== Quelle der Wahrheit je Kennzahl (Konsistenz zum Ausbilder-Export stand.js und zu ausbilder-uebersicht.html / dash.js) =====
   Aufgaben-Ergebnis   sim.done + lm4.tdone, je Aufgabe der höchste Wert, gerundet 0..100 (gleiche Regel wie stand.js build(): tasks). 100 = gelöst.
   Lab-Zahlen          [Aufgaben gesamt, davon 100 %] je Lab = stand.js labs; Gesamt = Summe über die Labs des gewählten Berufs (ohne Hub), wie der Ring auf der Startseite.
   Lernfeld/Modul      Ausbildungsplan-Kern (ausbildungsplan-core.js lernfeldFortschritt), jede Aufgabe zählt in genau einem Lernfeld; ohne Plan (Skelett) je Lab.
                       Ampel: grau = nichts begonnen, gelb = in Arbeit (oder alles gelöst, aber Aufgaben in Wiederholen-Box 1), grün = alle gelöst und nichts unsicher.
   Prüfungsthemen      pr.state.tr = { Thema: { r richtig, n gesamt, t zuletzt } } (stand.js exam.topics). Ampel: grau = weniger als 5 Antworten, gelb = unter 80 %, grün = ab 80 % (Coach W.gut).
                       „schwach“ (unter 70 %) ist die Grenze des Coach; „ausbilder“ (unter 60 % bei mindestens 5 Antworten) ist exakt stand.js weak.topics, so sieht es auch der Ausbilder.
   Probeprüfungen      pr.state.hist (kind 'exam' oder ohne kind), wie stand.js exam.hist.
   Karten fällig       lm4.karten { id: [Fach, fällig ms] } plus lm4.pkarten (Fach f, fällig d) gegen karten-daten.js (KARTEN): fällig = Karte hat einen Stand und ist fällig (wie karten.js zaehl); neue Karten werden getrennt gezählt.
   Wiederholen         lm4.wdh, abgeglichen im Speicher (wiederholen.js abgleich + heute), ohne zu speichern.
   Serie / Lerntage    Tage mit Aktivität aus lm4.e10.tage, lm4.when (letzte Bearbeitung je Aufgabe), pr.state (tr[].t, hist[].t), lm4.pkarten[].t, lm4.wdh (t, r), lm4.last.t.
                       Hinweis: je Aufgabe ist nur der LETZTE Bearbeitungstag gespeichert; ältere Tage können fehlen, die Serie ist deshalb eine Untergrenze.
   Karriere/Abzeichen  lm4.badges, lm4.kamp (nur gelesen), Rang aus karriere() (Karriere-Kern, XP werden immer neu gerechnet).
   Nächster Schritt    Coach.suggest (SPEC-PRUEFUNG-COACH), erster Vorschlag; ohne Coach das erste nicht grüne Lernfeld/Modul.
   Prüfungsteil        nur wenn LAB_REG.pr den Beruf hat (egs, ige); die Wege (tec, stu, wing, winf) und die übrigen Berufe haben keine Pool-Fragen. */
(function (root) {
  const DAY = 864e5, WEGE = ['tec', 'stu', 'wing', 'winf'];
  const SCHWACH = 70, GUT = 80, AUSBILDER = 60, MINANT = 5;
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const num = v => { v = +v; return isFinite(v) ? v : 0; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const idOk = k => /^[\w.\-]{1,40}$/.test(k);
  const pad = n => String(n).padStart(2, '0');
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const DAYRE = /^\d{4}-\d{2}-\d{2}$/;
  const SOURCES = {
    aufgaben: 'sim.done + lm4.tdone (höchster Wert je Aufgabe, wie stand.js tasks)',
    labs: 'stand.js labs: [Aufgaben, 100 %] je Lab; Gesamt = Summe der Labs des Berufs',
    bereiche: 'ausbildungsplan-core.js lernfeldFortschritt; ohne Plan je Lab',
    themen: 'pr.state.tr (stand.js exam.topics); ausbilder = stand.js weak.topics (unter 60 %, mindestens 5 Antworten)',
    pruefungen: 'pr.state.hist (stand.js exam.hist)',
    karten: 'lm4.karten + lm4.pkarten gegen karten-daten.js (karten.js zaehl)',
    wiederholen: 'lm4.wdh, im Speicher abgeglichen (wiederholen.js)',
    serie: 'lm4.e10.tage, lm4.when, pr.state, lm4.pkarten, lm4.wdh, lm4.last',
    rang: 'Karriere-Kern (karriere.js), XP werden neu gerechnet',
    naechster: 'coach.js suggest, erster Vorschlag'
  };

  function mkGet(read) {
    return (k, d) => { try { const t = read(k); if (t == null) return d; const v = JSON.parse(t); return v == null ? d : v; } catch (e) { return d; } };
  }
  /* beste Ergebnisse je Aufgabe, gleiche Regel wie stand.js */
  function bestOf(get) {
    const best = {};
    [get('sim.done', {}), get('lm4.tdone', {})].forEach(m => { if (isObj(m)) Object.keys(m).forEach(k => { const v = Math.round(num(m[k])); if (idOk(k) && isFinite(+m[k]) && m[k] !== null && m[k] !== '' && typeof m[k] !== 'boolean' && v >= 0 && (best[k] == null || v > best[k])) best[k] = clamp(v, 0, 100); }); });
    return best;
  }
  const berufHat = (reg, lab, b) => !!reg[lab] && !reg[lab].hub && (Array.isArray(reg[lab].beruf) ? reg[lab].beruf : ['egs']).indexOf(b) >= 0;
  const hatPoolFor = (reg, b) => !!(reg && reg.pr && Array.isArray(reg.pr.beruf) && reg.pr.beruf.indexOf(b) >= 0);

  /* hat der Nutzer überhaupt schon etwas getan? (für Startseite: neue Nutzer bekommen die ruhige Ansicht) */
  function hatFortschritt(read) {
    const get = mkGet(read), has = o => isObj(o) && Object.keys(o).length > 0;
    if (has(get('sim.done', {})) || has(get('lm4.tdone', {})) || has(get('lm4.trainer', {})) || has(get('lm4.karten', {})) || has(get('lm4.pkarten', {})) || has(get('lm4.wdh', {})) || has(get('lm4.badges', {}))) return true;
    const ps = get('pr.state', {}); if (isObj(ps) && (has(ps.tr) || (Array.isArray(ps.hist) && ps.hist.length))) return true;
    const km = get('lm4.kamp', {}); if (isObj(km) && Array.isArray(km.done) && km.done.length) return true;
    const e = get('lm4.e10', {}); if (isObj(e) && num(e.n) > 0) return true;
    return false;
  }

  /* ---------- Lerntage und Serie ---------- */
  function lerntage(get, now) {
    const set = {}, add = t => { t = num(t); if (t > 0 && t <= now + DAY) set[dayKey(t)] = 1; };
    const e10 = get('lm4.e10', {}); if (isObj(e10) && isObj(e10.tage)) Object.keys(e10.tage).forEach(k => { if (DAYRE.test(k) && num(e10.tage[k]) > 0) set[k] = 1; });
    const wh = get('lm4.when', {}); if (isObj(wh)) Object.keys(wh).forEach(k => add(wh[k]));
    const ps = get('pr.state', {});
    if (isObj(ps)) { if (isObj(ps.tr)) Object.keys(ps.tr).forEach(k => { if (isObj(ps.tr[k])) add(ps.tr[k].t); }); if (Array.isArray(ps.hist)) ps.hist.forEach(h => { if (isObj(h)) add(h.t); }); }
    const pk = get('lm4.pkarten', {}); if (isObj(pk)) Object.keys(pk).forEach(k => { if (isObj(pk[k])) add(pk[k].t); });
    const wd = get('lm4.wdh', {}); if (isObj(wd)) Object.keys(wd).forEach(k => { if (isObj(wd[k])) { add(wd[k].t); add(wd[k].r); } });
    const la = get('lm4.last', null); if (isObj(la)) add(la.t);
    const heute = dayKey(now), tage = [];
    for (let i = 13; i >= 0; i--) { const k = dayKey(now - i * DAY); tage.push({ datum: k, aktiv: !!set[k] }); }
    let serie = 0, i = set[heute] ? 0 : 1;
    while (i < 400 && set[dayKey(now - i * DAY)]) { serie++; i++; }
    const alle = Object.keys(set).sort();
    return { tage, serie, heuteAktiv: !!set[heute], aktiv14: tage.filter(x => x.aktiv).length, letzter: alle.length ? alle[alle.length - 1] : '', anzahl: alle.length };
  }

  /* ---------- Karten ---------- */
  function kartenStand(get, now, KARTEN) {
    const stand = get('lm4.karten', {}), pk = get('lm4.pkarten', {}), s = isObj(stand) ? stand : {};
    const list = Array.isArray(KARTEN) ? KARTEN : [];
    let neu = 0, faellig = 0, gelernt = 0, bekannt = 0;
    const fach = st => (Array.isArray(st) && st[0] >= 1 && st[0] <= 5 ? st[0] : 1);
    list.forEach(k => { const st = s[k[0]]; if (!st) neu++; else { bekannt++; if (fach(st) === 5) gelernt++; if (num(st[1]) <= now) faellig++; } });
    let pkn = 0;
    if (isObj(pk)) Object.keys(pk).forEach(id => { const c = pk[id]; if (!isObj(c) || !/^[pb]-[A-Za-z0-9_.-]{1,60}$/.test(id) || !c.q || !c.a || num(c.t) <= 0) return; pkn++; bekannt++; const f = Math.round(num(c.f)); if (f === 5) gelernt++; if ((num(c.d) > 0 ? num(c.d) : num(c.t)) <= now) faellig++; });
    return { gesamt: list.length + pkn, neu, faellig, bekannt, gelernt, pruefKarten: pkn };
  }

  /* ---------- Ampel ---------- */
  function ampelBereich(o) {
    if (o.n > 0) {
      if (o.done >= o.n && !o.wdh1) return 'gruen';
      return (o.done > 0 || o.begun > 0 || o.started) ? 'gelb' : 'grau';
    }
    if (o.pt > 0) return o.pdone >= o.pt || o.pfin ? 'gruen' : (o.pdone > 0 || o.pstarted ? 'gelb' : 'grau');
    return 'grau';
  }
  function grundBereich(o) {
    if (o.n > 0) {
      const t = [o.done + ' von ' + o.n + (o.n === 1 ? ' Aufgabe' : ' Aufgaben') + ' gelöst'];
      if (o.begun > 0) t.push(o.begun + ' angefangen');
      if (o.wdh1 > 0) t.push(o.wdh1 + ' zum Wiederholen');
      return t.join(', ');
    }
    if (o.pt > 0) return 'Projekt: ' + o.pdone + ' von ' + o.pt + ' Stationen' + (o.pfin ? ' (fertig)' : '');
    return 'Keine eigenen Aufgaben (Heft oder Projekt)';
  }

  function bereiche(env, get, res, wdh) {
    const reg = env.LAB_REG || {}, b = env.beruf, AP = env.AP, out = { quelle: 'labs', liste: [] };
    const rows = env.AUFGABEN || [];
    /* „zum Wiederholen“ zählt nur gelöste Aufgaben, die (z. B. wegen eines Tipps) in Box 1 liegen; angefangene stehen schon unter „angefangen“ (keine Doppelzählung) */
    const unsicher = id => (res[id] || 0) >= 100 && !!wdh[id] && +wdh[id].b === 1;
    const labRow = lab => {
      const rs = rows.filter(r => r[1] === lab), n = rs.length, ps = rs.map(r => res[r[0]] || 0);
      const o = { n, done: ps.filter(p => p >= 100).length, begun: ps.filter(p => p > 0 && p < 100).length, started: ps.some(p => p > 0), wdh1: rs.filter(r => unsicher(r[0])).length, pt: 0, pdone: 0 };
      return o;
    };
    const plan = AP && AP.plan ? AP.plan(b) : null;
    if (plan && plan.status !== 'skelett' && (plan.lernfelder || []).length) {
      let F = null, Z = null;
      try {
        const ids = (env.VB_INDEX || []).map(x => x.id), ls = AP.ladeLernstand(env.read, ids), cx = { AUFGABEN: rows, LAB_REG: reg, VB_INDEX: env.VB_INDEX || [] };
        F = AP.lernfeldFortschritt(b, ls, cx); Z = AP.zuordnung(plan, cx);
      } catch (e) { F = null; }
      if (F) {
        out.quelle = 'plan';
        plan.lernfelder.forEach(lf => {
          const f = F.lf[lf.id]; if (!f) return;
          const pt = f.projekt.reduce((s, p) => s + p.total, 0), pd = f.projekt.reduce((s, p) => s + p.done, 0);
          const o = { id: lf.id, titel: lf.titel || lf.id, optional: !!lf.optional, n: f.n, done: f.done, begun: f.begun, started: f.started, wdh1: ((Z && Z.byLf[lf.id]) || []).filter(unsicher).length, pt, pdone: pd, pfin: f.projekt.length > 0 && f.projekt.every(p => p.fin), pstarted: f.projekt.some(p => p.started) };
          o.ampel = ampelBereich(o); o.grund = grundBereich(o); o.pct = f.n ? Math.round(100 * f.done / f.n) : (pt ? Math.round(100 * Math.min(pd, pt) / pt) : null);
          o.labs = f.labs.filter(l => l.n > 0).map(l => ({ lab: l.lab, name: (reg[l.lab] && reg[l.lab].name) || l.lab, n: l.n, done: l.done, fremd: !!l.fremd, file: (reg[l.lab] && reg[l.lab].file) || '' }));
          o.href = 'ausbildungsplan.html' + (env.beruf ? '?beruf=' + env.beruf : '') + '#lf=' + encodeURIComponent(lf.id);
          out.liste.push(o);
        });
        return out;
      }
    }
    Object.keys(reg).filter(k => berufHat(reg, k, b)).forEach(lab => {
      const o = labRow(lab); if (!o.n) return;
      o.id = lab; o.titel = reg[lab].name || lab; o.optional = false; o.ampel = ampelBereich(o); o.grund = grundBereich(o); o.pct = Math.round(100 * o.done / o.n);
      o.labs = []; o.href = reg[lab].file || '';
      out.liste.push(o);
    });
    return out;
  }

  /* ---------- Prüfungsteil ---------- */
  function pruefung(env, get) {
    const reg = env.LAB_REG || {}, sicht = hatPoolFor(reg, env.beruf);
    if (!sicht) return { sichtbar: false };
    const ps = get('pr.state', {}), P = isObj(ps) ? ps : {}, tr = isObj(P.tr) ? P.tr : {}, bs = isObj(P.best) ? P.best : {}, rp = isObj(P.rep) ? P.rep : {};
    const tit = k => { try { if (env.topicTitle) { const t = env.topicTitle(k); if (t) return String(t); } } catch (e) {} return k; };
    const themen = [], seen = {};
    Object.keys(tr).slice(0, 200).forEach(k => {
      const t = tr[k]; if (!isObj(t) || !idOk(k.replace(/[:@]/g, '_'))) return;
      const n = Math.max(0, Math.round(num(t.n))); if (!n) return;
      const r = Math.max(0, Math.round(num(t.r))), p = Math.round(100 * r / n);
      seen[k] = 1;
      themen.push({ k, titel: tit(k), r, n, p, best: clamp(Math.round(num(bs[k])), 0, 100), stufe: clamp(Math.round(num(rp[k])), 0, 4), zuletzt: num(t.t) || 0,
        ampel: n < MINANT ? 'grau' : p >= GUT ? 'gruen' : 'gelb', schwach: n >= MINANT && p < SCHWACH, ausbilder: n >= MINANT && p < AUSBILDER,
        grund: n < MINANT ? n + ' von ' + MINANT + ' Antworten, noch nicht bewertet' : r + ' von ' + n + ' richtig (' + p + ' %)', href: 'pruefungslab.html?thema=' + encodeURIComponent(k), neu: false });
    });
    (env.alleThemen || []).forEach(k => { if (seen[k]) return; seen[k] = 1; themen.push({ k, titel: tit(k), r: 0, n: 0, p: 0, best: 0, stufe: 0, zuletzt: 0, ampel: 'grau', schwach: false, ausbilder: false, grund: 'Noch nicht geübt', href: 'pruefungslab.html?thema=' + encodeURIComponent(k), neu: true }); });
    themen.sort((a, b) => (a.neu - b.neu) || (a.n >= MINANT ? 0 : 1) - (b.n >= MINANT ? 0 : 1) || a.p - b.p || b.n - a.n || (a.k < b.k ? -1 : 1));
    const hist = (Array.isArray(P.hist) ? P.hist : []).filter(h => isObj(h) && (h.kind === 'exam' || h.kind == null)).slice(-30).map(h => ({ t: Math.max(0, Math.round(num(h.t))), pct: clamp(Math.round(num(h.pct)), 0, 100), note: clamp(Math.round(num(h.note)), 0, 6), v: String(h.v || '').replace(/[^\w-]/g, '').slice(0, 20), gp: !!(isObj(h.cfg) && h.cfg.gp) }));
    const letzte = hist.length ? hist.slice().sort((a, b) => a.t - b.t)[hist.length - 1] : null;
    return { sichtbar: true, themen, zaehl: { gruen: themen.filter(t => t.ampel === 'gruen').length, gelb: themen.filter(t => t.ampel === 'gelb').length, grau: themen.filter(t => t.ampel === 'grau').length },
      schwach: themen.filter(t => t.schwach), ausbilder: themen.filter(t => t.ausbilder).map(t => t.k), proben: hist.length, letzte, verlauf: hist.slice(-5).map(h => h.pct), href: 'pruefungslab.html' };
  }

  /* ---------- Gesamtmodell ---------- */
  function build(env) {
    env = env || {};
    const read = typeof env.read === 'function' ? env.read : (() => null), now = env.now || Date.now(), get = mkGet(read);
    const reg = env.LAB_REG || {}, rows = env.AUFGABEN || [], b = env.beruf || 'egs', weg = WEGE.indexOf(b) >= 0;
    const e2 = Object.assign({}, env, { read, now, beruf: b });
    const res = bestOf(get);
    /* Labs wie stand.js */
    const labs = {};
    Object.keys(reg).forEach(lab => {
      if ((reg[lab] || {}).hub) return; const rs = rows.filter(r => r[1] === lab); if (!rs.length) return;
      const ps = rs.map(r => res[r[0]] || 0);
      labs[lab] = { n: rs.length, d: ps.filter(p => p >= 100).length, avg: Math.round(ps.reduce((a, c) => a + c, 0) / rs.length), begun: ps.filter(p => p > 0).length };
    });
    const labKeys = Object.keys(labs).filter(k => berufHat(reg, k, b));
    const gesamt = labKeys.reduce((a, k) => ({ n: a.n + labs[k].n, d: a.d + labs[k].d, begun: a.begun + labs[k].begun }), { n: 0, d: 0, begun: 0 });
    gesamt.pct = gesamt.n ? Math.round(100 * gesamt.d / gesamt.n) : 0;
    /* Wiederholen (im Speicher abgleichen, nichts schreiben) */
    let wdh = {}, wiederholen = { faellig: 0, heute: 0, liste: [], limit: 5 };
    if (env.Wdh && env.Wdh.abgleich) {
      try {
        const hs = get('sim.hints', {}), wh = get('lm4.when', {});
        const a = env.Wdh.abgleich({ done: res, hints: isObj(hs) ? hs : {}, when: isObj(wh) ? wh : {}, wdh: get('lm4.wdh', {}), now });
        wdh = a.wdh;
        const h = env.Wdh.heute({ wdh, rows, reg, beruf: b, now });
        wiederholen = { faellig: h.faellig, heute: h.heute, liste: h.liste.map(x => ({ id: x.id, titel: x.titel, lab: x.labName, box: x.box, href: x.file ? x.file + '?aufgabe=' + encodeURIComponent(x.id) : '' })), limit: h.limit };
      } catch (e) { wdh = {}; }
    } else { const w = get('lm4.wdh', {}); wdh = isObj(w) ? w : {}; }
    const br = bereiche(e2, get, res, wdh);
    const karten = kartenStand(get, now, env.KARTEN);
    const pr = pruefung(e2, get);
    const serie = lerntage(get, now);
    /* Rang, Abzeichen, Kampagne */
    let karriere = null; try { karriere = typeof env.karriere === 'function' ? env.karriere() : null; } catch (e) { karriere = null; }
    const bd = get('lm4.badges', {}), nBad = isObj(bd) ? Object.keys(bd).filter(idOk).length : 0;
    const km = get('lm4.kamp', {}), kd = isObj(km) && Array.isArray(km.done) ? km.done.filter(x => typeof x === 'string').length : 0;
    const abz = { n: nBad, total: env.badgeTotal == null ? null : num(env.badgeTotal) };
    const kampagne = b === 'egs' ? { done: kd, total: env.kampTotal == null ? null : num(env.kampTotal) } : null;
    /* nächster Schritt */
    let weitere = [], naechster = null;
    try {
      const C = env.Coach;
      if (C && C.suggest) {
        const labs0 = Object.keys(reg).filter(k => berufHat(reg, k, b)), rows0 = rows.filter(r => labs0.indexOf(r[1]) >= 0);
        const ctx = { AUFGABEN: rows0, LAB_REG: reg, groups: env.groups || [], topics: env.topics || [], recommend: env.recommend || null, weg: weg ? b : '' };
        const D = C.read((k, d) => { if (k === 'lm4.kuerzel') { const t = read(k); return t == null ? d : t; } return get(k, d); });
        const sug = C.suggest(D, now, ctx);
        const list = (sug || []).filter(x => x.art !== 'hinweis').map(x => ({ art: x.art, titel: x.title, text: x.text, href: x.href || '', minuten: x.minuten || 0 }));
        naechster = list[0] || null; weitere = list.slice(1);
      }
    } catch (e) { naechster = null; }
    if (!naechster) {
      const f = br.liste.find(x => !x.optional && x.ampel === 'gelb' && x.n > 0) || br.liste.find(x => !x.optional && x.ampel === 'grau' && x.n > 0);
      if (f) naechster = { art: 'pfad', titel: (f.ampel === 'gelb' ? 'Weiter: ' : 'Starte mit: ') + f.titel, text: f.grund + '.', href: f.href, minuten: 10 };
    }
    const gelbGrau = br.liste.filter(x => !x.optional).reduce((a, x) => { a[x.ampel]++; return a; }, { grau: 0, gelb: 0, gruen: 0 });
    return { beruf: b, weg, hatPool: !!pr.sichtbar, leer: !hatFortschritt(read), now,
      gesamt, labs, bereiche: br.liste, bereicheQuelle: br.quelle, bereicheZaehl: gelbGrau, pruefung: pr, karten, wiederholen, serie,
      karriere, abzeichen: abz, kampagne, naechster, weitere, quellen: SOURCES };
  }

  /* ---------- Browser: Eingabe aus den geladenen Skripten zusammenbauen (nur Lesen) ---------- */
  function fromGlobals(g, now) {
    const read = k => { try { return g.localStorage.getItem(k); } catch (e) { return null; } };
    let beruf = 'egs'; try { beruf = g.BerufReg && g.BerufReg.cur ? g.BerufReg.cur() : (read('lm4.beruf') || 'egs'); } catch (e) {}
    const C = g.Coach || null, K = g.Karriere;
    return { read, now: now || Date.now(), beruf, AUFGABEN: g.AUFGABEN || [], LAB_REG: g.LAB_REG || {}, VB_INDEX: g.VB_INDEX || [], AP: g.AusbildungsPlan || null, Wdh: g.Wiederholen || null, Coach: C,
      KARTEN: g.KARTEN || [], recommend: g.Lernpfad && g.Lernpfad.recommend ? () => g.Lernpfad.recommend() : null,
      karriere: K && typeof K.summary === 'function' ? () => K.summary() : null,
      kampTotal: g.Kampagne && g.Kampagne.CH ? g.Kampagne.CH.length : null, badgeTotal: g.Badges && g.Badges.DEFS ? g.Badges.DEFS.length : null,
      alleThemen: C ? Object.keys(C.BANK_TITEL || {}).concat(Object.keys(C.GRUPPEN_TITEL || {}).map(k => 'p:' + k)) : [],
      topicTitle: C ? k => C.topicTitle(k, { groups: (g.PR_POOL && g.PR_POOL.groups) || [], topics: (g.PR_BANK && g.PR_BANK.TOPICS) || [] }) : null,
      groups: (g.PR_POOL && g.PR_POOL.groups) || [], topics: (g.PR_BANK && g.PR_BANK.TOPICS) || [] };
  }

  const api = { build, fromGlobals, hatFortschritt, mkGet, bestOf, lerntage, kartenStand, dayKey, SOURCES, WEGE, SCHWACH, GUT, AUSBILDER, MINANT, hatPoolFor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MeinStandCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
