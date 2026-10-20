'use strict';
/* Tonfunk Verbund: Adapter für das Prüfungs-Lab (Paket A6, SPEC 5.2 und 5.5).
   Eine Station ist ein Fragenset. Die Fragen kommen aus VORHANDENEN Pool-Fragen (window.PR_POOL, es werden keine neuen Fragen in den Pool gelegt) und/oder
   aus Projektfragen, die die Station selbst liefert:
     station.pool      Liste von Pool-IDs ['F2025-01', …]  ODER Auswahl { teil?:'Teil1'|'SysE'|'FuSa'|'WiSo'|[…], g?:'halb'|[…], n:6, num?:2 }
                       (n Fragen, davon num Rechenaufgaben; die Wahl ist deterministisch aus Projekt-Seed und Station: pure.pickIds)
     station.questions(ctx) → [{ id, q, type:'num', unit, ans, tol, w? } | { id, q, type:'mc', opts:[…], r, w? }]   (parametrierte Projektfragen)
     station.form      zusätzlich oder stattdessen Formularfelder der Leiste (Schlüssel = Frage-ID)
   apply   : legt das Set als Training im Prüfungs-Lab an (S.train, Antworten mit sofortiger Erklärung; ein laufendes eigenes Training wird als
             localStorage 'verbund.pr.bak' gesichert, eine laufende Probeprüfung bleibt unberührt).
   collect : pr.quiz { answers:{ <id>: Zahl | Index der Antwort in der Reihenfolge der Pool-Frage }, n, qids:[…], src:{ <id>:'pool'|'projekt' } }.
             Mehrfachwahl wird auf die ORIGINALE Optionsreihenfolge der Pool-Frage umgerechnet (im Lab sind die Antworten gemischt).
   fillForm: Formularwerte aus der Musterlösung. Reine Teile in adapter.pure (Node-Test quelle/verbund/test_verbundad_pr.js). */
(function (root) {
  const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isS = x => typeof x === 'string';
  const fin = x => typeof x === 'number' && isFinite(x);
  const arr = x => (Array.isArray(x) ? x : []);
  const blank = v => v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v));
  /* gleiche Rechenregeln wie pruefwerk.js (parse, isRight) */
  const parse = s => { const x = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  function hash(str) { let h = 0x811c9dc5; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(list, r) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const POOL = () => (root.PR_POOL && Array.isArray(root.PR_POOL.q) ? root.PR_POOL : { groups: [], q: [] });
  const noteKey = (pid, sid) => String(pid || '') + ':' + String(sid || '');

  /* ---------------- reine Teile ---------------- */
  const asList = x => (x == null ? null : Array.isArray(x) ? x : [x]);
  /* Auswahl der Pool-IDs: { ids, missing } (spec = Liste oder { teil, g, n, num }); seed = Projekt-Seed, key = Station */
  function pickIds(spec, pool, seed, key) {
    const q = arr(pool && pool.q);
    if (Array.isArray(spec)) { const have = {}; q.forEach(p => { have[p.id] = 1; }); return { ids: spec.filter(i => have[i]), missing: spec.filter(i => !have[i]) }; }
    if (!isO(spec)) return { ids: [], missing: [] };
    const teil = asList(spec.teil), g = asList(spec.g), n = Math.max(0, spec.n | 0), num = spec.num == null ? null : Math.max(0, spec.num | 0);
    const cand = q.filter(p => (!teil || teil.indexOf(p.teil) >= 0) && (!g || g.indexOf(p.g) >= 0)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const r = rng(hash(String(seed) + '|' + String(key) + '|pool')), mc = shuffle(cand.filter(p => Array.isArray(p.o)), r), nu = shuffle(cand.filter(p => !Array.isArray(p.o)), r);
    let out;
    if (num == null) out = shuffle(mc.concat(nu), r).slice(0, n);
    else { const a = nu.slice(0, Math.min(num, n)); out = a.concat(mc.slice(0, n - a.length)); if (out.length < n) out = out.concat(nu.slice(a.length).slice(0, n - out.length)); }
    return { ids: out.map(p => p.id), missing: [] };
  }
  /* Frage im Format des Prüfungs-Labs (wie poolQ in pruefwerk.js); o0/r0 = Originalreihenfolge der Antworten */
  function poolQuestion(p, seed) {
    const k = 'p:' + p.g + '@' + (p.teil === 'Teil1' ? '1' : '2');
    if (Array.isArray(p.o)) {
      const idx = shuffle(p.o.map((x, i) => i), rng(hash(String(seed) + '|' + p.id)));
      return { id: p.id, k, type: 'mc', q: p.q, opts: idx.map(i => p.o[i]), r: idx.indexOf(p.r), w: p.w || '', pts: 1, teil: p.teil, pool: true, o0: p.o.slice(), r0: p.r };
    }
    return { id: p.id, k, type: 'num', q: p.q, ans: p.ans, unit: p.u || '', tol: p.tol == null ? 0.02 : p.tol, w: p.w || '', pts: 4, teil: p.teil, pool: true };
  }
  function projectQuestion(x) {
    if (!isO(x) || !isS(x.id) || !isS(x.q)) return null;
    if (x.type === 'mc' && Array.isArray(x.opts) && x.opts.length > 1 && fin(x.r)) return { id: x.id, k: 'p:alle', type: 'mc', q: x.q, opts: x.opts.slice(), r: x.r, w: x.w || '', pts: 1, pool: false, o0: x.opts.slice(), r0: x.r };
    if (fin(x.ans)) return { id: x.id, k: 'p:alle', type: 'num', q: x.q, ans: x.ans, unit: x.unit || '', tol: x.tol == null ? 0.02 : x.tol, w: x.w || '', pts: 4, pool: false };
    return null;
  }
  /* alle Fragen der Station: { qs, missing } */
  function buildQuestions(st, ctx, pool, seed) {
    const key = (st && st.id) || '', qs = []; let missing = [];
    if (st && st.pool) {
      const sel = pickIds(st.pool, pool, seed, key), byId = {}; arr(pool && pool.q).forEach(p => { byId[p.id] = p; });
      sel.ids.forEach(id => qs.push(poolQuestion(byId[id], seed))); missing = sel.missing;
    }
    if (st && typeof st.questions === 'function') { let l = []; try { l = arr(st.questions(ctx)); } catch (e) { l = []; } l.forEach(x => { const q = projectQuestion(x); if (q && !qs.some(y => y.id === q.id)) qs.push(q); }); }
    return { qs, missing };
  }
  function isRight(q, a) {   /* a in Anzeigeform des Labs: mc = Index der angezeigten Option, num = Text oder Zahl */
    if (blank(a)) return false;
    if (q.type === 'mc') return a === q.r;
    const x = parse(a); if (isNaN(x)) return false;
    return q.tol === 0 ? Math.abs(x - q.ans) < 0.5 : Math.abs(x - q.ans) <= Math.max(q.tol * Math.abs(q.ans), 1e-9);
  }
  /* Anzeigeantworten des Labs → Antworten der Hülle (mc: Originalindex, num: Zahl) */
  function toAnswers(qs, ans) {
    const out = {}; ans = isO(ans) ? ans : {};
    arr(qs).forEach(q => {
      const a = ans[q.id]; if (blank(a)) return;
      if (q.type === 'mc') { const o = q.o0 ? q.o0.indexOf(q.opts[a]) : a; if (o >= 0) out[q.id] = o; }
      else { const x = parse(a); if (!isNaN(x)) out[q.id] = x; }
    });
    return out;
  }
  /* Antworten der Hülle → Anzeigeantworten des Labs (für die Musterlösung) */
  function fromAnswers(qs, answers) {
    const out = {}; answers = isO(answers) ? answers : {};
    arr(qs).forEach(q => {
      const a = answers[q.id]; if (blank(a)) return;
      if (q.type === 'mc') { const i = q.o0 ? q.opts.indexOf(q.o0[a]) : a; if (i >= 0) out[q.id] = i; } else out[q.id] = String(a).replace('.', ',');
    });
    return out;
  }
  /* Bewertung der Hüllen-Antworten: { right, n, pct, rows:[{id,ok}] } */
  function grade(qs, answers) {
    answers = isO(answers) ? answers : {};
    const rows = arr(qs).map(q => { const a = answers[q.id]; return { id: q.id, ok: !blank(a) && (q.type === 'mc' ? a === (q.r0 != null ? q.r0 : q.r) : isRight(q, a)) }; });
    const right = rows.filter(r => r.ok).length; return { right, n: rows.length, pct: rows.length ? Math.round(100 * right / rows.length) : 0, rows };
  }
  /* Formularfelder → Antworten (Zahlen werden Zahlen, leere fehlen) */
  function answersFromForm(st, fd) {
    const out = {}; fd = isO(fd) ? fd : {};
    arr(st && st.form).filter(f => isO(f) && f.key).forEach(f => {
      const v = fd[f.key]; if (blank(v)) return; if (typeof v === 'number') { out[f.key] = v; return; }
      const t = String(v).trim(), x = parse(t); out[f.key] = /^[+-]?[\d\s.,]+$/.test(t) && !isNaN(x) ? x : t;
    });
    return out;
  }
  function buildQuiz(qs, answers, nForm) {
    const src = {}, qids = arr(qs).map(q => { src[q.id] = q.pool ? 'pool' : 'projekt'; return q.id; });
    return { answers, n: Math.max(qids.length, nForm | 0), qids, src };
  }

  /* ---------------- Lab-Anbindung ---------------- */
  const PW = () => (root.PrWerk && typeof root.PrWerk.state === 'function' ? root.PrWerk : null);
  const ctxPid = ctx => (ctx && ctx.pid) || ((ctx && ctx.V && typeof ctx.V.active === 'function' ? ctx.V.active() : null) || {}).pid || '';
  const seedOf = ctx => { try { const s = ctx && ctx.V && ctx.V.state(ctxPid(ctx)); if (s && fin(s.seed)) return s.seed; } catch (e) {} return hash((ctx && ctx.name) + '|' + (ctx && ctx.level)); };
  const ls = { get(k) { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } } };
  const cacheKey = (pid, sid) => 'verbund.pr.' + pid + '.' + sid;
  const persistLab = S => ls.set('pr.state', S);
  function myTrain(S, key) { return S && S.train && S.train.vb === key ? S.train : null; }
  let mirrorOn = false;
  function mirror(key, st, ctx) {   /* Antworten laufend in den Verbund-Speicher kopieren (das Lab vergisst sie beim Verlassen des Trainings) */
    if (mirrorOn || !root.document) return; mirrorOn = true;
    const save = () => setTimeout(() => { const p = PW(), t = p && myTrain(p.state(), key); if (t) ls.set(cacheKey(ctxPid(ctx), (st && st.id) || ''), { qids: t.qs.map(q => q.id), answers: toAnswers(t.qs, t.ans), seed: t.seed }); }, 0);
    ['click', 'change', 'input'].forEach(ev => root.document.addEventListener(ev, save, true));
  }
  const adapter = {
    lab: 'pr',
    ready() { const p = PW(); return !!(p && p.state() && typeof p.go === 'function' && root.PR_POOL); },
    apply(st, ctx) {
      const p = PW(); if (!p) return { ok: false, msg: 'Das Prüfungs-Lab ist nicht bereit.' };
      const seed = seedOf(ctx), b = buildQuestions(st, ctx, POOL(), seed), key = noteKey(ctxPid(ctx), st && st.id), S = p.state();
      if (!b.qs.length) return { ok: true, msg: 'Beantworte die Fragen im Formular der Leiste.' };
      let msg = 'Das Fragenset steht im Training. Beantworte die Fragen, dann prüfen oder übergeben.';
      if (S.train && !S.train.vb) { ls.set('verbund.pr.bak', { t: Date.now(), train: S.train }); msg += ' Dein laufendes Training ist gesichert.'; }
      S.train = { k: null, mode: 'mix', qs: b.qs, i: 0, ans: {}, shown: false, right: 0, seed, vb: key };
      if (ctx && ctx.solution && isO(ctx.solution.data)) { S.train.ans = fromAnswers(b.qs, ctx.solution.data.answers); msg = 'Musterlösung eingetragen. ' + 'Du kannst sie Frage für Frage ansehen.'; }
      persistLab(S); mirror(key, st, ctx);
      try { p.go('training'); } catch (e) { return { ok: false, msg: 'Das Training konnte nicht geöffnet werden: ' + (e && e.message ? e.message : e) }; }
      if (b.missing.length) msg += ' (Nicht im Pool gefunden: ' + b.missing.join(', ') + ')';
      return { ok: true, msg };
    },
    collect(st, ctx) {
      const p = PW(), key = noteKey(ctxPid(ctx), st && st.id), S = p ? p.state() : null, t = myTrain(S, key), fields = arr(st && st.form).filter(f => isO(f) && f.key);
      const base = answersFromForm(st, ctx && ctx.formData);
      let qs, ans = {};
      if (t) { qs = t.qs; ans = toAnswers(t.qs, t.ans); }
      else {
        const c = ls.get(cacheKey(ctxPid(ctx), (st && st.id) || '')), b = buildQuestions(st, ctx, POOL(), seedOf(ctx)); qs = b.qs;
        if (c && isO(c.answers) && fin(c.seed) && c.seed === seedOf(ctx)) ans = c.answers;
      }
      const answers = Object.assign({}, base, ans);
      if (!Object.keys(answers).length) return { error: qs.length ? 'Beantworte zuerst die Fragen im Training (Reiter „Training“).' : 'Trage zuerst Antworten in das Formular ein.' };
      return { type: 'pr.quiz', data: buildQuiz(qs, answers, fields.length) };
    },
    live(st, ctx) {
      const c = adapter.collect(st, ctx); if (c.error) return [{ ok: false, text: c.error }];
      const b = buildQuestions(st, ctx, POOL(), seedOf(ctx)), g = grade(b.qs, c.data.answers), n = Math.max(b.qs.length, c.data.n);
      const rows = [{ ok: Object.keys(c.data.answers).length >= n, text: 'Beantwortet: ' + Object.keys(c.data.answers).length + ' von ' + n }];
      if (b.qs.length) rows.push({ ok: g.pct >= 80, text: 'Richtig (Pool- und Projektfragen): ' + g.right + ' von ' + g.n });
      return rows;
    },
    fillForm(st, data) {
      const out = {}, a = isO(data) && isO(data.answers) ? data.answers : {};
      arr(st && st.form).filter(f => isO(f) && f.key).forEach(f => { if (!blank(a[f.key])) out[f.key] = a[f.key]; });
      return out;
    },
    pure: { pickIds, poolQuestion, projectQuestion, buildQuestions, isRight, toAnswers, fromAnswers, grade, answersFromForm, buildQuiz, hash, rng, parse }
  };
  if (root.Verbund && typeof root.Verbund.registerAdapter === 'function') root.Verbund.registerAdapter('pr', adapter);
  root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS.pr = adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);
