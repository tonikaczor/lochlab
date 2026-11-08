'use strict';
/* Tonfunk Arbeitsschutz-Lab: Logik (Namensraum ARB_CORE). Kein DOM, in Node testbar.
   Zufall: alle Generatoren nehmen eine Zufallsfunktion rng(seed) und sind damit wiederholbar.
   Fragenformat: { cat, kind, text, sign?, choices:[{t?, s?}], correct (Index oder Index-Liste), multi, expl, key } */
(function (root) {
  const D = root.ARB_DATA || (typeof require !== 'undefined' ? require('./arbdata.js').DATA : null);

  /* ---------- Zufall ---------- */
  function rng(seed) { let a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function shuffle(arr, R) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const pick = (R, a) => a[Math.floor(R() * a.length)];

  /* ---------- Daten-Zugriff ---------- */
  const signById = id => D.signs.find(s => s.id === id) || null;
  const ghsById = id => D.ghs.find(s => s.id === id) || null;
  const svgOf = id => { const s = signById(id) || ghsById(id); return s ? s.svg : ''; };
  const stripMark = s => String(s == null ? '' : s).replace(/\s*\/\*[\s\S]*?\*\//g, '');   /* PRUEFEN-Markierungen nie anzeigen */
  const mName = id => D.mittel.find(m => m.id === id).name;

  /* ---------- Fragen: Normalisieren, Mischen, Prüfen ---------- */
  const normChoice = c => (typeof c === 'string' ? { t: c } : c);
  function prep(q, R) {   /* Kopie mit gemischten Antworten; R = rng */
    const idx = shuffle(q.choices.map((c, i) => i), R), choices = idx.map(i => normChoice(q.choices[i]));
    const corr = Array.isArray(q.correct) ? q.correct.map(c => idx.indexOf(c)).sort((a, b) => a - b) : idx.indexOf(q.correct);
    return Object.assign({}, q, { choices, correct: corr, multi: Array.isArray(q.correct) });
  }
  function isRight(q, ans) {
    if (Array.isArray(q.correct)) { const a = (Array.isArray(ans) ? ans : []).slice().sort((x, y) => x - y); return a.length === q.correct.length && a.every((v, i) => v === q.correct[i]); }
    return ans === q.correct;
  }
  function lookup(id) { return D.tasks.concat(D.eh).find(t => t.id === id) || null; }

  /* ---------- Generatoren ---------- */
  function mk(cat, kind, text, correctItem, wrongItems, expl, extra) {
    const items = [correctItem].concat(wrongItems);
    return Object.assign({ cat, kind, text, choices: items, correct: 0, expl, key: kind + '|' + text + '|' + (correctItem.t || correctItem.s) }, extra || {});
  }
  const others = (R, arr, not, n) => shuffle(arr.filter(x => x !== not), R).slice(0, n);
  const SITU = { A: 'einen Brand fester Stoffe (Klasse A)', B: 'einen Brand flüssiger Stoffe (Klasse B)', C: 'einen Gasbrand (Klasse C)', D: 'einen Metallbrand (Klasse D)', F: 'einen Fettbrand (Klasse F)', strom: 'einen Brand an einer elektrischen Anlage unter Spannung' };
  const GEN = {
    sign2name(R) { const s = pick(R, D.signs), w = others(R, D.signs, s, 3); return mk('Zeichen', 'sign2name', 'Was bedeutet dieses Schild?', { t: s.name }, w.map(x => ({ t: x.name })), s.name + ': ' + s.bed + ' (' + D.kat[s.kat].name + ')', { sign: s.id }); },
    name2sign(R) { const s = pick(R, D.signs), w = others(R, D.signs, s, 3); return mk('Zeichen', 'name2sign', 'Welches Schild bedeutet „' + s.name + '“?', { s: s.id }, w.map(x => ({ s: x.id })), s.name + ' ist ein ' + D.kat[s.kat].name + ': ' + D.kat[s.kat].form + ', ' + D.kat[s.kat].farbe + '.'); },
    sign2cat(R) { const s = pick(R, D.signs), ks = Object.keys(D.kat); return mk('Zeichen', 'sign2cat', 'Zu welcher Gruppe gehört dieses Schild?', { t: D.kat[s.kat].name }, ks.filter(k => k !== s.kat).map(k => ({ t: D.kat[k].name })), D.kat[s.kat].name + ': ' + D.kat[s.kat].form + ', ' + D.kat[s.kat].farbe + '. Sie ' + D.kat[s.kat].sinn + '.', { sign: s.id }); },
    class4mat(R) {
      const m = pick(R, D.brandMaterial), lab = b => b.k + ' (' + b.name + ')', b0 = D.brand.find(b => b.k === m.k);
      return mk('Brandschutz', 'class4mat', 'Zu welcher Brandklasse gehört ' + m.t + '?', { t: lab(b0) }, others(R, D.brand, b0, 3).map(b => ({ t: lab(b) })), 'Brandklasse ' + b0.k + ': ' + b0.name + ', z. B. ' + b0.bsp + '.');
    },
    mittel(R) {
      const key = pick(R, ['A', 'B', 'C', 'D', 'F', 'strom']), ja = D.mittel.filter(m => D.matrix[m.id][key] === 'ja'), nein = D.mittel.filter(m => D.matrix[m.id][key] === 'nein'), c = pick(R, ja);
      return mk('Brandschutz', 'mittel', 'Welches Löschmittel ist für ' + SITU[key] + ' geeignet?', { t: c.name }, shuffle(nein, R).slice(0, 3).map(m => ({ t: m.name })), D.grund[c.id]);
    },
    mittelNot(R) {
      const key = pick(R, ['B', 'strom']), ja = D.mittel.filter(m => D.matrix[m.id][key] === 'ja'), nein = D.mittel.filter(m => D.matrix[m.id][key] === 'nein'), c = pick(R, nein);
      return mk('Brandschutz', 'mittelNot', 'Welches Löschmittel ist für ' + SITU[key] + ' NICHT geeignet?', { t: c.name }, shuffle(ja, R).slice(0, 3).map(m => ({ t: m.name })), D.grund[c.id]);
    },
    ghs2name(R) { const g = pick(R, D.ghs), w = others(R, D.ghs, g, 3); return mk('Gefahrstoffe', 'ghs2name', 'Was bedeutet dieses Piktogramm?', { t: g.bed }, w.map(x => ({ t: x.bed })), g.id + ' (' + g.name + '): ' + g.bed + '. ' + g.bsp + '.', { sign: g.id }); },
    name2ghs(R) { const g = pick(R, D.ghs), w = others(R, D.ghs, g, 3); return mk('Gefahrstoffe', 'name2ghs', 'Welches Piktogramm bedeutet: ' + g.bed + '?', { s: g.id }, w.map(x => ({ s: x.id })), g.id + ' (' + g.name + '): ' + g.bed + '.'); },
    stop4(R) {
      const pool = []; D.gbOrder.forEach(w => D.gb[w].gef.forEach(g => g.opts.forEach(o => { if (o.ok && !o.amb) pool.push(o); })));
      const o = pick(R, pool), ks = Object.keys(D.stop);
      return mk('Gefährdungsbeurteilung', 'stop4', 'Zu welcher Gruppe des STOP-Prinzips gehört die Maßnahme „' + o.t + '“?', { t: D.stop[o.stop].name }, ks.filter(k => k !== o.stop).map(k => ({ t: D.stop[k].name })), D.stop[o.stop].name + ': ' + D.stop[o.stop].text);
    },
    psa(R) {
      const a = pick(R, D.psa.filter(x => x.gen)), c = pick(R, a.req.filter(k => k !== 'atem')), w = shuffle(a.nein, R).slice(0, 3);
      return mk('PSA', 'psa', 'Welche Schutzausrüstung ist bei „' + a.t + '“ erforderlich?', { t: D.psaItems[c] }, w.map(k => ({ t: D.psaItems[k] })), a.t + ': ' + stripMark(a.note));
    }
  };
  const CATGENS = { 'Zeichen': ['sign2name', 'name2sign', 'sign2cat'], 'Brandschutz': ['class4mat', 'mittel', 'mittelNot'], 'Gefahrstoffe': ['ghs2name', 'name2ghs'], 'Gefährdungsbeurteilung': ['stop4'], 'PSA': ['psa'], 'Erste Hilfe': [] };
  const statics = cat => D.tasks.concat(D.eh).filter(t => t.cat === cat && !t.gb);
  function fromStatic(R, cat, used) { const l = statics(cat).filter(t => !used.has('s|' + t.id)); if (!l.length) return null; const t = pick(R, l); used.add('s|' + t.id); return Object.assign({ kind: 'static', key: 's|' + t.id }, prep(t, R)); }
  function fromGen(R, cat, used, kind) {
    const kinds = CATGENS[cat];
    for (let i = 0; i < 12; i++) { const q = GEN[kind || pick(R, kinds)](R); if (!used.has(q.key)) { used.add(q.key); return prep(q, R); } }
    const q = GEN[kind || pick(R, kinds)](R); return prep(q, R);
  }
  /* Eine Zufallsfrage (Trainer). cat optional. */
  function randomQuestion(seed, cat) {
    const R = rng(seed), c = cat && D.cats.indexOf(cat) >= 0 ? cat : pick(R, D.cats), used = new Set();
    if (!CATGENS[c].length || R() < 0.3) return fromStatic(R, c, used) || fromGen(R, c, used);
    return fromGen(R, c, used);
  }
  /* Abschlussrunde: 20 gemischte Fragen, gleiche Seed gibt gleiche Runde */
  const EXAM_PLAN = [['Zeichen', 4, 0], ['Brandschutz', 3, 1], ['Gefahrstoffe', 2, 1], ['Gefährdungsbeurteilung', 2, 1], ['PSA', 2, 1], ['Erste Hilfe', 0, 3]];
  function buildExam(seed) {
    const R = rng(seed), used = new Set(), out = [];
    EXAM_PLAN.forEach(([cat, g, s]) => {
      for (let i = 0; i < s; i++) { const q = fromStatic(R, cat, used); if (q) out.push(q); }
      for (let i = 0; i < g; i++) out.push(fromGen(R, cat, used));
    });
    return shuffle(out, R);
  }
  const PASS_PCT = 80;
  const passed = (correct, total) => total > 0 && correct * 100 >= PASS_PCT * total;
  function scoreExam(qs, answers) {
    let c = 0; const wrong = [];
    qs.forEach((q, i) => { if (isRight(q, answers[i])) c++; else wrong.push(i); });
    return { correct: c, total: qs.length, pct: qs.length ? Math.round(100 * c / qs.length) : 0, passed: passed(c, qs.length), wrong };
  }

  /* ---------- Löschmittel ---------- */
  function loeschOk(mittelId, key) { const m = D.matrix[mittelId]; return m ? m[key] : null; }

  /* ---------- Gefährdungsbeurteilung ---------- */
  const optOf = (g, id) => g.opts.find(o => o.id === id);
  function assessGB(wpId, sel) {
    const wp = D.gb[wpId]; sel = sel || {}; const lines = []; let total = 0, covered = 0, bad = 0, missing = 0;
    wp.gef.forEach((g, gi) => {
      const ids = sel[g.id] || [], chosen = ids.map(i => optOf(g, i)).filter(Boolean), n = gi + 1, tag = 'Gefährdung ' + n + ' („' + g.k + '“)';
      let probs = 0;
      chosen.filter(o => !o.ok).forEach(o => { bad++; probs++; lines.push({ ok: false, text: tag + ': „' + o.t + '“ ist hier ungeeignet oder gefährlich.' }); });
      if (!chosen.length) { lines.push({ ok: false, text: tag + ': noch keine Maßnahme gewählt.' }); }
      g.req.forEach(lv => {
        total++;
        if (chosen.some(o => o.ok && o.stop === lv)) covered++;
        else { missing++; probs++; if (chosen.length) lines.push({ ok: false, text: tag + ': Es fehlt noch eine ' + D.stop[lv].name.replace('Maßnahmen', 'Maßnahme') + ' (' + lv + ').' }); }
      });
      if (!probs) lines.push({ ok: true, text: tag + ': passt.' });
    });
    const pct = Math.round(100 * Math.max(0, covered - bad) / total);
    return { ok: missing === 0 && bad === 0, pct, lines, total, covered, bad, missing };
  }
  function gbTip(wpId, sel, stage) {
    if (stage < 2) return 'Denke an die Rangfolge S, T, O, P: Technische Maßnahmen gehen vor persönlichen. Meist braucht eine Gefährdung mehr als nur eine Maßnahme. Lies jede Maßnahme kritisch: Manche sind ungeeignet.';
    const wp = D.gb[wpId], r = assessGB(wpId, sel), first = wp.gef.findIndex((g, gi) => r.lines.some(l => !l.ok && l.text.indexOf('Gefährdung ' + (gi + 1) + ' ') === 0));
    return first < 0 ? 'Hier passt schon alles. Prüfe noch einmal.' : 'Schau dir Gefährdung ' + (first + 1) + ' („' + wp.gef[first].k + '“) noch einmal genau an.';
  }
  function musterSel(wpId, minimal) {
    const s = {}; D.gb[wpId].gef.forEach(g => { s[g.id] = minimal ? g.req.map(lv => g.opts.find(o => o.ok && o.stop === lv).id) : g.opts.filter(o => o.ok).map(o => o.id); }); return s;
  }

  /* ---------- PSA-Zuordnung ---------- */
  function assessPsa(actId, keys) {
    const a = D.psa.find(x => x.id === actId), set = keys || [], bad = set.filter(k => a.nein.indexOf(k) >= 0), miss = a.req.filter(k => set.indexOf(k) < 0).length, lines = [];
    bad.forEach(k => lines.push({ ok: false, text: D.psaItems[k] + ' ist hier ungeeignet oder gefährlich.' }));
    if (miss) lines.push({ ok: false, text: 'Es fehlt noch mindestens ' + miss + ' erforderliche Schutzausrüstung.' });
    if (!bad.length && !miss) lines.push({ ok: true, text: 'Passt.' });
    return { ok: !bad.length && !miss, miss, bad, lines };
  }

  /* ---------- Teilnahmebestätigung ---------- */
  const pad = (n, l) => String(n).padStart(l, '0');
  const chk = s => pad(hash(s).toString(36).toUpperCase(), 7).slice(-6);
  function normName(name) {
    let s = String(name == null ? '' : name).toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS');
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 20); return s || 'OHNENAME';
  }
  const ymd = d => pad(d.getFullYear(), 4) + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2);
  function makeCode(o) {
    const n = normName(o.name), d = typeof o.date === 'string' ? o.date : ymd(o.date), p = pad(Math.max(0, Math.min(100, Math.round(o.pct))), 3);
    return 'ARB1-' + n + '-' + d + '-' + p + '-' + chk('ARB1|' + n + '|' + d + '|' + p);
  }
  function verifyCode(code) {
    const s = String(code == null ? '' : code).toUpperCase().replace(/\s+/g, ''), m = /^ARB1-([A-Z0-9]{1,20})-(\d{8})-(\d{3})-([A-Z0-9]{6})$/.exec(s);
    if (!m) return { ok: false, reason: 'Format' };
    const mo = +m[2].slice(4, 6), da = +m[2].slice(6, 8), pct = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31 || pct > 100) return { ok: false, reason: 'Werte' };
    if (chk('ARB1|' + m[1] + '|' + m[2] + '|' + m[3]) !== m[4]) return { ok: false, reason: 'Prüfsumme' };
    return { ok: true, name: m[1], date: m[2].slice(6, 8) + '.' + m[2].slice(4, 6) + '.' + m[2].slice(0, 4), pct, passed: pct >= PASS_PCT };
  }
  const deDate = d => pad(d.getDate(), 2) + '.' + pad(d.getMonth() + 1, 2) + '.' + d.getFullYear();
  function certText(o) {   /* o: name, date (Date), correct, total */
    const pct = Math.round(100 * o.correct / o.total), code = makeCode({ name: o.name, date: o.date, pct });
    const text = ['TONFUNK ARBEITSSCHUTZ-LAB', 'Teilnahmebestätigung (Übungsnachweis)', 'Name: ' + (String(o.name || '').trim() || '(ohne Namen)'), 'Datum: ' + deDate(o.date), 'Ergebnis: ' + o.correct + ' von ' + o.total + ' richtig = ' + pct + ' % (bestanden ab ' + PASS_PCT + ' %)', 'Code: ' + code, 'Hinweis: Ersetzt keine gesetzlich vorgeschriebene Unterweisung durch den Arbeitgeber.'].join('\n');
    return { code, pct, text };
  }

  const API = { rng, hash, shuffle, pick, signById, ghsById, svgOf, stripMark, mName, prep, isRight, lookup, GEN, CATGENS, randomQuestion, buildExam, EXAM_PLAN, PASS_PCT, passed, scoreExam, loeschOk, assessGB, gbTip, musterSel, assessPsa, normName, makeCode, verifyCode, certText, chk, ymd, deDate };
  root.ARB_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
