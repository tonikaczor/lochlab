'use strict';
/* Tonfunk Lab: Karriere-Kern „Vom Azubi zum Prüfungsbesten“ (ohne DOM, Node und Browser).
   XP und Rang werden IMMER neu aus vorhandenen Daten gerechnet (Kampagne, Abzeichen, Trainer, Aufgaben, Prüfungen, Duelle, Verbund),
   es gibt keine eigene Lab-Liste. Der Tipp-Abzug gilt nur hier (Karriere-Kontext), das normale Üben bleibt tippfrei.
   core.read(get) liest die Eingaben, core.xp/level/specials/gp sind reine Funktionen. Dialog und Karte folgen in K2. */
(function (root) {
  const KD = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./karrieredata.js') : root.KarriereData;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => { v = +v; return isFinite(v) ? v : 0; };
  const arr = a => Array.isArray(a) ? a : [];
  const fnv = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).toUpperCase().padStart(7, '0'); };
  /* ISO-Kalenderwoche als Schlüssel 'JJJJ-WW' (lokale Zeit) für den Wochendeckel der Duelle */
  function weekKey(ts) {
    const d = new Date(ts); if (isNaN(d)) return '0';
    const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
    return u.getUTCFullYear() + '-' + String(Math.ceil(((u - y0) / 864e5 + 1) / 7)).padStart(2, '0');
  }
  /* Eingaben aus dem Speicher lesen: get(key, default) wie Coach.read. extra = { CH, mdone } der Kampagne (optional) */
  function read(get, extra) {
    const g = (k, d) => { try { const v = get(k, d); return v == null ? d : v; } catch (e) { return d; } };
    const done = {};
    [g('sim.done', {}), g('lm4.tdone', {})].forEach(o => { if (isObj(o)) Object.keys(o).forEach(k => { const v = num(o[k]); if (v > (done[k] || 0)) done[k] = v; }); });
    const ps = g('pr.state', {}), kb = g('lm4.kamp', { done: [] }), tr = g('lm4.trainer', {}), duell = g('lm4.duell', {}), kar = g('lm4.karriere', {});
    const o = (k) => { const v = g(k, {}); return isObj(v) ? v : {}; };
    const D = {
      done, hints: o('lm4.ctipps'), hintsAll: o('sim.hints'), badges: Object.keys(o('lm4.badges')), stats: o('lm4.stats'),
      trainer: isObj(tr) ? Object.keys(tr).filter(k => tr[k]) : [],
      hist: isObj(ps) ? arr(ps.hist) : [],
      duell: isObj(duell) ? arr(duell.hist) : [],
      kampDone: isObj(kb) ? arr(kb.done).filter(x => typeof x === 'string') : [],
      kuerzel: String(g('lm4.kuerzel', '') || ''), jahrgang: String(g('lm4.jahrgang', '') || ''),
      kar: isObj(kar) ? kar : {}
    };
    /* Karriere-Start (v23.147b): lm4.karriere.k0 = Startstand; ohne k0 und mit extra.virtual startet die Rechnung gedanklich JETZT (0 XP, nichts wird gespeichert); ohne beides (Tests, Altaufrufe) rückwirkend */
    const k0 = D.kar.k0;
    if (isObj(k0) && num(k0.t) > 0) D.k0 = { t: num(k0.t), a: arr(k0.a), b: arr(k0.b), k: arr(k0.k), tr: arr(k0.tr), v: arr(k0.v), g: num(k0.g) };
    if (extra && extra.CH) {   // Kapitel live aus der Kampagne, nicht nur die gefeierten
      D.chAll = extra.CH.filter(c => !c.epilog).map(c => c.t);
      if (extra.mdone) extra.CH.forEach(c => { try { if (c.m.every(extra.mdone) && !D.kampDone.includes(c.t)) D.kampDone.push(c.t); } catch (e) {} });
    }
    if (!D.k0 && extra && extra.virtual) D.k0 = snapshot(D, extra.now);
    return D;
  }
  /* Startstand der XP-Quellen (nur Daten VOR dem Start zählen nicht; Kapitel bleiben als Meilenstein anrechenbar):
     Aufgaben/Abzeichen/Kapitel/Trainer/Verbund-Projekte als Listen (robust gegen Löschen und Wiederholen), Prüfungen und Duelle über den Zeitstempel t > Start, Verbund-Gold als Zählerstand */
  function snapshot(D, now) {
    return { t: num(now) > 0 ? num(now) : Date.now(), a: Object.keys(D.done).filter(k => num(D.done[k]) >= 100), b: D.badges.slice(), k: D.kampDone.slice(), tr: D.trainer.slice(), v: KD.VERBUND_PIDS.filter(k => num(D.stats[k]) >= 1), g: num(D.stats.vbgold) };
  }
  /* Karriere starten: speichert k0 einmalig (set(key, objekt)); gibt den Startstand zurück */
  function start(get, set, extra, now) {
    const D = read(get, extra ? Object.assign({}, extra, { virtual: false }) : null);
    if (D.k0) return D.k0;
    const k0 = snapshot(D, now);
    try { set('lm4.karriere', Object.assign({ v: 1 }, D.kar, { k0 })); } catch (e) {}
    return k0;
  }
  /* Aufgaben-XP: 10 je Level, +5 ohne Tipp, minus Tipp-Abzug je Tipp (D.hints = lm4.ctipps[id] = höchste Stufe 1 bis 3 = Zahl der Challenge-Tipps; Tipps aus normalem Üben in sim.hints zählen NIE), nie unter 0 */
  function taskXp(id, lv, D, X) {
    X = X || KD.XP;
    const h = Math.max(0, Math.min(3, Math.round(num((D.hints || {})[id]))));
    return Math.max(0, X.aufgabe * lv + (h ? 0 : X.ohneTipp) - X.tipp * h);
  }
  /* Sieg = die angezeigte Regel (cmp auf effPts, beim Vergleich als d.win gespeichert), nur mit eigenem Treffer (pct >= 100). Alte Einträge ohne win: effPts gegen gp, nie rohe Punkte. */
  const won = d => isObj(d) && num(d.pct) >= 100 && (d.win != null ? d.win === 1 : d.gp != null && d.gp !== '' && Math.round(num(d.pts) * (d.pr ? 0.5 : 1)) > num(d.gp));
  const duelWins = D => arr(D.duell).filter(won).length;
  /* XP mit Herkunft: { total, parts } */
  function xp(D, ctx) {
    const X = (ctx && ctx.XP) || KD.XP, rows = (ctx && ctx.AUFGABEN) || root.AUFGABEN || [];
    const P = { aufgaben: 0, abzeichen: 0, kapitel: 0, trainer: 0, pruefungen: 0, duelle: 0, verbund: 0 };
    const K0 = D.k0, ne = (list, v) => !K0 || !list.includes(v);   // zählt nur, was NACH dem Start dazukam
    rows.forEach(r => { if (num(D.done[r[0]]) >= 100 && ne(K0 ? K0.a : [], r[0])) P.aufgaben += taskXp(r[0], Math.max(1, Math.min(3, num(r[4]) || 1)), D, X); });
    const defs = ctx && ctx.DEFS; P.abzeichen = X.abzeichen * D.badges.filter(b => (!defs || defs.includes(b)) && ne(K0 ? K0.b : [], b)).length;
    P.kapitel = X.kapitel * new Set(D.kampDone.filter(t => ne(K0 ? K0.k : [], t))).size;
    P.trainer = X.trainer * D.trainer.filter(t => ne(K0 ? K0.tr : [], t)).length;
    P.pruefungen = D.hist.filter(h => isObj(h) && h.kind === 'exam' && !h.self && (!K0 || num(h.t) > K0.t)).map(h => X.pruefung[Math.round(num(h.note))] || 0).sort((a, b) => b - a).slice(0, X.pruefungMax).reduce((s, v) => s + v, 0);
    const wk = {}, seen = {};   // Wochendeckel: höchstens duellProWoche Duelle je Kalenderwoche; nur zu Ende gespielte (pct >= 100), je Rundencode einmal
    D.duell.forEach(d => { if (!isObj(d) || num(d.pct) < 100 || seen[d.r] || (K0 && num(d.t) <= K0.t)) return; seen[d.r] = 1; const k = weekKey(num(d.t)); (wk[k] = wk[k] || []).push(d); });
    Object.keys(wk).forEach(k => wk[k].slice(0, X.duellProWoche).forEach(d => { P.duelle += X.duellGespielt + (won(d) ? X.duellGewonnen : 0); }));
    const vb = KD.VERBUND_PIDS.filter(k => num(D.stats[k]) >= 1 && ne(K0 ? K0.v : [], k)).length, vg = Math.max(0, num(D.stats.vbgold) - (K0 ? K0.g : 0));   // nur bestandene Projekte, nicht vbstart/vbuebergabe/vbbericht/vbteilen
    P.verbund = X.verbund * vb + X.verbundGold * Math.min(vb, vg);
    return { total: Object.keys(P).reduce((s, k) => s + P[k], 0), parts: P };
  }
  /* Generalprobe: bester Prüfungseintrag mit cfg.gp (kleinere Note ist besser) */
  function gp(D) {
    const e = D.hist.filter(h => isObj(h) && h.kind === 'exam' && isObj(h.cfg) && h.cfg.gp).sort((a, b) => num(a.note) - num(b.note) || num(b.pct) - num(a.pct) || num(b.t) - num(a.t))[0];
    return e ? { t: num(e.t), pct: num(e.pct), note: num(e.note), seed: e.cfg.seed != null ? e.cfg.seed : null } : null;
  }
  function milestone(L, D, G) {
    if (L.kap && !L.kap.every(t => D.kampDone.includes(t))) return false;
    if (L.kampagne) { const all = D.chAll && D.chAll.length ? D.chAll.every(t => D.kampDone.includes(t)) : false; if (!all && num(D.stats.kampagne) < 1) return false; }
    if (L.gpNote && !(G && G.note >= 1 && G.note <= L.gpNote)) return false;
    return true;
  }
  /* Rang: höchster Rang, dessen XP UND Meilenstein (und die aller Ränge davor) erfüllt sind */
  function level(D, ctx) {
    const x = xp(D, ctx), G = gp(D), LV = KD.LEVELS; let n = 1;
    for (let i = 1; i < LV.length; i++) { if (x.total >= LV[i].xp && milestone(LV[i], D, G)) n = LV[i].n; else break; }
    const cur = LV[n - 1], nx = LV[n] || null;
    const need = nx ? { xp: Math.max(0, nx.xp - x.total), kap: (nx.kap || []).filter(t => !D.kampDone.includes(t)), kampagne: !!nx.kampagne && !milestone({ kampagne: true }, D, G), gp: !!nx.gpNote && !milestone({ gpNote: nx.gpNote }, D, G) } : null;
    return { n, t: cur.t, xp: x.total, parts: x.parts, next: nx ? { n: nx.n, t: nx.t, xp: nx.xp } : null, need, story: cur.story, gp: G };
  }
  /* Spezialaufgaben mit Status 'gesperrt' | 'offen' | 'fertig'; free = Ausbildermodus (lm4.kamp.free) */
  function specials(D, rang, free) {
    const vb = KD.VERBUND_PIDS.some(k => num(D.stats[k]) >= 1);
    return KD.SPECIALS.map(s => {
      let fertig = false;
      if (s.k === 'task') fertig = num(D.done[s.id]) >= 100;
      else if (s.k === 'escape') fertig = num(D.stats.escape) >= 1;
      else if (s.k === 'duell') fertig = D.duell.some(d => isObj(d) && num(d.pct) >= 100 && num(d.st) === s.st);
      else if (s.k === 'verbund') fertig = vb;
      else if (s.k === 'gp') fertig = !!gp(D);
      return Object.assign({}, s, { status: !(free || rang >= s.ab) ? 'gesperrt' : fertig ? 'fertig' : 'offen' });
    });
  }
  const certCode = (kuerzel, datum, note) => 'TFK-' + fnv([kuerzel, datum, note].join('|'));
  /* Generalprobe-Seed: fest je Jahrgang und Kalenderwoche (alle sehen dieselbe Prüfung); Jahrgang fehlt/ungültig = '0000' */
  function gpSeed(jahrgang, ts) {
    const j = String(jahrgang == null ? '' : jahrgang).replace(/"/g, '').trim(), jg = /^\d{4}$/.test(j) ? j : '0000', kw = weekKey(ts == null ? Date.now() : ts), key = jg + '-' + kw;
    return { key, jahrgang: jg, kw, seed: parseInt(fnv(key), 36) % 1000000000 };
  }
  const dmy = t => { const d = new Date(num(t)); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); };
  /* Generalprobe-Status: Start ab Rang GP.ab (oder Ausbildermodus), Prüfungsbester-Schwelle = Note GP.notePruefungsbester */
  function gpStatus(D, rang, free, now) {
    const G = gp(D), ok = !!free || rang >= KD.GP.ab, S = gpSeed(D.jahrgang, now);
    const runs = D.hist.filter(h => isObj(h) && h.kind === 'exam' && isObj(h.cfg) && h.cfg.gp).sort((a, b) => num(b.t) - num(a.t)).slice(0, 5).map(h => ({ t: num(h.t), pct: num(h.pct), note: num(h.note), seed: h.cfg.seed != null ? h.cfg.seed : null }));
    return { frei: ok, ab: KD.GP.ab, best: G, runs, seed: S, schwelle: KD.GP.notePruefungsbester, bester: !!(G && G.note >= 1 && G.note <= KD.GP.notePruefungsbester) };
  }
  /* Urkunde: Daten für den Druck (Name nur zur Laufzeit, wird nicht gespeichert); null ohne Generalprobe */
  function urkunde(D, rang, name) {
    const G = gp(D); if (!G) return null;
    const datum = dmy(G.t), best = rang >= 10 && G.note <= KD.GP.notePruefungsbester;
    return { titel: best ? 'Prüfungsbester' : 'Generalprobe', rang, rangTitel: KD.LEVELS[Math.max(1, Math.min(rang, KD.LEVELS.length)) - 1].t, datum, note: G.note, pct: G.pct, name: String(name || D.kuerzel || '').trim().slice(0, 60), kuerzel: D.kuerzel, code: certCode(D.kuerzel, datum, G.note) };
  }
  const core = { read, snapshot, start, xp, level, specials, gp, taskXp, weekKey, certCode, fnv, duelWins, gpSeed, gpStatus, urkunde };
  const Karriere = { core, DATA: KD };
  if (typeof module !== 'undefined' && module.exports) module.exports = Karriere;
  root.Karriere = Object.assign(root.Karriere || {}, Karriere);
})(typeof window !== 'undefined' ? window : globalThis);
