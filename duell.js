/* duell.js - Pruefungs-Duell, Kern (Paket D1): reine Funktionen ohne DOM, in Node UND im Browser ladbar.
   Inhalt: Wertungstabelle W, Rundencode K<KW>-<4 Hex> (= Seed), Aufgabenpool aus AUFGABEN, Ergebniscode TFD1.<json>.<hmac12>,
   Bestenlisten-Code TFB1, Plausibilitaetsflags, Punkte inkl. Tipp-Abzug, Duell-Zustand (localStorage), Haken auf Badges.result.
   NICHT enthalten: Oberflaeche, Ausbilder-Uebersicht, Export, Lab-Adapter (spaetere Pakete).
   Ehrlich: Die Signatur ist MANIPULATIONSARM, nicht manipulationssicher. Sie schuetzt vor Tippfehlern, nachtraeglich geaenderten Zahlen und
   unplausiblen Werten. Wer JavaScript liest, kann auf seinem Geraet Zaehler vor dem Signieren aendern (der Schluessel ist der Rundencode
   oder ein Ausbilderschluessel, den das Geraet kennen muss, um zu signieren). Der echte Schutz ist das Nachstellen durch den Ausbilder.
   Der Code enthaelt nie Fehlerschluessel, Ursache oder Fehlertext, nur Aufgaben-Id und Zaehler.
   Tipp-Abzug (W.tipp je Tipp) gilt NUR im Duell und im Karriere-Modus, normales Ueben bleibt tippfrei. */
(function (root) {
  'use strict';

  /* ---------- Wertungstabelle (alle Zahlen hier, nirgends sonst) ---------- */
  const W = {
    r: 0.6,                    /* Richtigkeit: 0,6 x pct (max 60) */
    aMax: 25, aFehl: 3, aFehlMax: 4, aMessMax: 5,   /* Arbeitsweise: 25 - 3 je Fehlversuch (max 4) - 1 je Messung ueber Richtwert (max 5) */
    richtwertFaktor: 2,        /* Richtwert Messungen = 2 x Messpunkte der Aufgabe */
    zMax: 15, zSek: [240, 420, 600],   /* Zeit: nur bei 100 %, T = 4/7/10 min je Stufe 1/2/3 */
    tipp: 5,                   /* Abzug je Tipp, direkt von der Summe */
    minSek: [30, 60, 90],      /* Mindestzeit je Stufe (Plausibilitaet) */
    best: 3,                   /* Bestenliste: Summe der besten 3 Duelle */
    prFaktor: 0.5,             /* Fairness: bekannte Aufgabe zaehlt halb */
    histMax: 100, rowsMax: 10
  };
  const KATS = ['Fehlersuche', 'Fehlersuche im Code', 'Messfehler'];
  const NOLABS = ['app', 'vb', 'pr'];
  const EXTRA = ['sl3', 'sl5', 'sl6', 'cp4', 'el14', 'el16', 'el23'];   /* Fehlersuchen mit anderer Kategorie (Ids, keine Lab-Liste) */
  const SEEDLABS = ['nts', 'ana', 'pcb', 'els'];                        /* Seed-variabler Fehler: im Pool doppelt gewichtet */
  const KEYS = { cur: 'lm4.duellcur', hist: 'lm4.duell', old: 'lm4.duelcur', duels: 'lm4.duels' };

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const num = (x, d) => { const n = typeof x === 'number' ? x : (typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN); return isFinite(n) ? n : d; };
  const int = (x, a, b, d) => { const n = num(x, NaN); return isFinite(n) ? clamp(Math.round(n), a, b) : d; };
  const str = (x, re, d) => { const s = typeof x === 'string' ? x : ''; return re.test(s) ? s : d; };

  /* ---------- Zufall: seeded() wie in pruefexam.js, FNV-Hash ---------- */
  const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = s => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  const seedNum = r => hash(String(r || '').toUpperCase()) || 1;

  /* ---------- Kalenderwoche (ISO 8601, lokale Zeit) ---------- */
  function kw(ts) {
    const d = new Date(ts == null ? Date.now() : ts); if (isNaN(d)) return 0;
    const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = u.getUTCDay() || 7; u.setUTCDate(u.getUTCDate() + 4 - day);
    const y0 = Date.UTC(u.getUTCFullYear(), 0, 1);
    return Math.ceil(((u - y0) / 86400000 + 1) / 7);
  }

  /* ---------- Rundencode ---------- */
  const RRE = /^K(\d{2})-([0-9A-F]{4})(-E)?$/;
  function randHex(n) {
    let out = '';
    try {
      const c = root.crypto || (typeof require === 'function' ? require('crypto').webcrypto : null);
      if (c && c.getRandomValues) { const a = c.getRandomValues(new Uint8Array(n)); for (let i = 0; i < n; i++) out += (a[i] & 15).toString(16); return out.toUpperCase(); }
    } catch (e) {}
    for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out.toUpperCase();
  }
  function newRound(ts, opt) { opt = opt || {}; return 'K' + String(kw(ts)).padStart(2, '0') + '-' + (opt.hex ? String(opt.hex).toUpperCase() : randHex(4)) + (opt.ausbilder ? '-E' : ''); }
  function parseRound(s) { const m = RRE.exec(String(s == null ? '' : s).trim().toUpperCase()); return m ? { code: m[0], kw: +m[1], hex: m[2], e: !!m[3] } : null; }
  /* Rundencode ohne Ausbilder-Suffix: Treffpunkt/Seed ist immer derselbe Teil */
  const roundBase = r => { const p = parseRound(r); return p ? 'K' + String(p.kw).padStart(2, '0') + '-' + p.hex : null; };

  /* ---------- Aufgabenpool und Auswahl ---------- */
  /* AUFGABEN-Zeile: [id, lab, kategorie, titel, level] */
  function pool(aufgaben, extra) {
    const A = Array.isArray(aufgaben) ? aufgaben : [], out = [], seen = {};
    const ex = {}; (Array.isArray(extra) ? extra : EXTRA).forEach(i => { ex[i] = 1; });
    A.forEach(r => {
      if (!r || NOLABS.indexOf(r[1]) >= 0 || seen[r[0]]) return;
      if (KATS.indexOf(r[2]) >= 0 || ex[r[0]]) { seen[r[0]] = 1; out.push(r); }
    });
    return out;
  }
  /* deterministisch: gleicher Rundencode + gleiche Stufe/Lab = gleiche Aufgabe, unabhaengig vom Lernstand */
  function pick(runde, rows, opt) {
    rows = Array.isArray(rows) ? rows : []; opt = opt || {}; const st = int(opt.st, 1, 3, 2);
    let c = (rows || []).filter(r => (!opt.lab || r[1] === opt.lab) && r[4] === st);
    if (c.length < 6) c = (rows || []).filter(r => (!opt.lab || r[1] === opt.lab) && Math.abs(r[4] - st) <= 1);
    if (!c.length) return null;
    const w = []; c.forEach(r => { w.push(r); if (SEEDLABS.indexOf(r[1]) >= 0) w.push(r); });
    return w[Math.floor(seeded(hash(roundBase(runde) || runde))() * w.length)];
  }

  /* ---------- Wertung ---------- */
  /* o: { st, pct, ms, h (Tipps), f (Fehlversuche), m (Messungen oder null), mp (Messpunkte oder null) } */
  function score(o) {
    o = o || {};
    const st = int(o.st, 1, 3, 2), pct = int(o.pct, 0, 100, 0), h = int(o.h, 0, 99, 0), f = int(o.f, 0, 99, 0);
    const t = Math.max(0, num(o.ms, 0)) / 1000, m = o.m == null ? null : int(o.m, 0, 9999, null), mp = o.mp == null ? null : int(o.mp, 0, 9999, null);
    const R = Math.round(W.r * pct);
    let A = W.aMax - W.aFehl * Math.min(f, W.aFehlMax);
    if (m != null && mp != null) A -= Math.min(W.aMessMax, Math.max(0, m - W.richtwertFaktor * mp));
    A = Math.max(0, A);
    const T = W.zSek[st - 1];
    const Z = pct >= 100 ? Math.round(W.zMax * clamp((T - t) / T, 0, 1)) : 0;
    const abzug = W.tipp * h;
    return { R, A, Z, T: abzug, pts: Math.max(0, R + A + Z - abzug) };
  }
  /* Gleichstand: kuerzere Zeit, dann weniger Tipps. Negativ = a besser. */
  function cmp(a, b) { return (b.pts - a.pts) || (a.ms - b.ms) || (a.h - b.h); }
  const effPts = rec => rec.pr ? Math.round(rec.pts * W.prFaktor) : rec.pts;

  /* ---------- Codec ---------- */
  const b64 = s => {
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8');
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const x = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return x.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64 = s => {
    const p = s.replace(/-/g, '+').replace(/_/g, '/'); const q = p + '==='.slice((p.length + 3) % 4);
    const bin = typeof atob === 'function' ? atob(q) : Buffer.from(q, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8');
  };
  const subtle = () => { try { const c = root.crypto || (typeof require === 'function' ? require('crypto').webcrypto : null); return c && c.subtle ? c.subtle : null; } catch (e) { return null; } };
  /* HMAC-SHA256, erste 12 Hex-Zeichen; ohne WebCrypto (z. B. file://) -> 'u' (unsigniert) */
  async function sign(key, text) {
    const s = subtle(); if (!s || key == null || key === '') return 'u';
    try {
      const enc = new TextEncoder(), k = await s.importKey('raw', enc.encode(String(key)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = new Uint8Array(await s.sign('HMAC', k, enc.encode(text)));
      let h = ''; for (let i = 0; i < 6; i++) h += (sig[i] < 16 ? '0' : '') + sig[i].toString(16); return h;
    } catch (e) { return 'u'; }
  }
  /* kleine synchrone Pruefsumme (nur fuer Tippfehler-Anzeige, KEINE Sicherheit) */
  const checksum = s => hash(s).toString(16).padStart(8, '0');

  /* Datensatz auf erlaubte Felder und Grenzen bringen; fehlt ein Pflichtfeld -> null */
  /* Kürzel: eine Regel für die ganze App (wie stand.js: 2 bis 24 Zeichen) */
  const KRE = /^[A-Za-z0-9ÄÖÜäöüß_.-]{2,24}$/;
  const cleanId = k => { let s = String(k == null ? '' : k).trim().replace(/[^A-Za-z0-9ÄÖÜäöüß_.-]/g, '_').slice(0, 24); return s.length >= 2 ? s : 'anon'; };
  function normalize(o, now) {
    if (!o || typeof o !== 'object') return null;
    const k = str(o.k, KRE, ''), r = roundBase(o.r) || '', a = str(o.a, /^[A-Za-z0-9_-]{1,12}$/, '');
    if (!k || !r || !a) return null;
    const hRaw = int(o.h, 0, 9999, 0), tt = int(o.t, 0, 4e12, 0);
    const out = {
      v: 1, k, j: str(o.j, /^\d{4}$/, ''), r, a, lab: str(o.lab, /^[a-z]{2,5}$/, ''), st: int(o.st, 1, 3, 2),
      t: tt, ms: int(o.ms, 0, 3 * 3600 * 1000, 0), p: int(o.p, 0, 100, 0), h: clamp(hRaw, 0, 2), f: int(o.f, 0, 50, 0),
      pr: o.pr ? 1 : 0, pts: int(o.pts, 0, 100, 0), app: str(o.app, /^v\d{1,3}\.\d{1,4}$/, '')
    };
    if (o.m != null) out.m = int(o.m, 0, 200, 0);
    out._hRaw = hRaw;
    return out;
  }
  const FIELDS = ['v', 'k', 'j', 'r', 'a', 'lab', 'st', 't', 'ms', 'p', 'h', 'f', 'm', 'pr', 'pts', 'app'];
  const pl = rec => { const o = {}; FIELDS.forEach(f => { if (rec[f] !== undefined && rec[f] !== '' ) o[f] = rec[f]; }); return JSON.stringify(o); };
  /* rec: { k, j, r, a, lab, st, t, ms, p, h, f, m?, pr, app }; pts wird IMMER aus den Zaehlern gerechnet (mp = Messpunkte optional) */
  async function encode(rec, key, opt) {
    const n = normalize(Object.assign({}, rec), 0); if (!n) return null;
    n.pts = score({ st: n.st, pct: n.p, ms: n.ms, h: n.h, f: n.f, m: n.m == null ? null : n.m, mp: opt && opt.mp != null ? opt.mp : null }).pts;
    const body = b64(pl(n));
    return 'TFD1.' + body + '.' + await sign(key == null ? n.r : key, body);
  }
  const RE_D = /TFD1\.[A-Za-z0-9_-]+\.(?:[0-9a-f]{12}|u)(?![A-Za-z0-9_-])/g;
  /* parse: findet alle TFD1-Codes im Text, ohne Ausnahme. Liefert [{ rec, body, sig, code }] (Signatur noch ungeprueft) */
  function parse(txt) {
    const out = []; let s; try { s = String(txt == null ? '' : txt); } catch (e) { return out; }
    if (s.length > 200000) s = s.slice(0, 200000);
    (s.match(RE_D) || []).slice(0, 500).forEach(c => {
      try {
        const i = c.indexOf('.'), j = c.lastIndexOf('.'), body = c.slice(i + 1, j), sig = c.slice(j + 1);
        const rec = normalize(JSON.parse(unb64(body)), 0); if (rec) out.push({ rec, body, sig, code: c });
      } catch (e) {}
    });
    return out;
  }
  /* Plausibilitaet. ctx: { now, kw (erwartete KW), mp (Messpunkte) }. Liefert Liste von Flag-Namen. */
  function flags(rec, ctx) {
    ctx = ctx || {}; const f = [], now = ctx.now == null ? Date.now() : ctx.now;
    const sc = score({ st: rec.st, pct: rec.p, ms: rec.ms, h: rec.h, f: rec.f, m: rec.m == null ? null : rec.m, mp: ctx.mp == null ? null : ctx.mp });
    if (rec.pts !== sc.pts && !(ctx.mp == null && rec.m != null && Math.abs(rec.pts - sc.pts) <= W.aMessMax)) f.push('punkte');
    if (rec.m === 0 && rec.p >= 100) f.push('geraten');
    if (rec.p >= 100 && rec.ms < W.minSek[rec.st - 1] * 1000) f.push('zu_schnell');
    if (rec._hRaw > 2) f.push('tipps');
    if (rec.t > now + 5 * 60000) f.push('zukunft');
    const rk = parseRound(rec.r), wk = ctx.kw != null ? ctx.kw : (rec.t ? kw(rec.t) : null);
    if (rk && wk != null) { const d = Math.abs(rk.kw - wk); if (Math.min(d, 52 - d, 53 - d) > 1) f.push('fremde_kw'); }
    return f;
  }
  /* verify: Signatur gegen key (Standard: Rundencode) pruefen. Ergebnis { ok, sig:'ok'|'falsch'|'unsigniert', rec, flags } oder null */
  async function verify(text, key, ctx) {
    const p = parse(text)[0]; if (!p) return null;
    const k = key == null ? p.rec.r : key, fl = flags(p.rec, ctx);
    let sg;
    if (p.sig === 'u') sg = 'unsigniert'; else { const want = await sign(k, p.body); sg = want === 'u' ? 'unsigniert' : (want === p.sig ? 'ok' : 'falsch'); }
    if (sg !== 'ok') fl.push(sg === 'falsch' ? 'sig_falsch' : 'unsigniert');
    return { ok: sg === 'ok' && !fl.length, sig: sg, rec: p.rec, flags: fl };
  }

  /* ---------- Bestenliste TFB1 ---------- */
  /* recs: normalisierte Datensaetze (aus parse). Summe der besten W.best Duelle je Kuerzel in KW/Jahrgang; pr zaehlt halb. */
  function bestenliste(recs, opt) {
    opt = opt || {}; const by = {};
    (Array.isArray(recs) ? recs : []).forEach(r => {
      if (!r || (opt.kw != null && (parseRound(r.r) || {}).kw !== opt.kw) || (opt.j && r.j !== opt.j)) return;
      (by[r.k] = by[r.k] || []).push(r);
    });
    const rows = Object.keys(by).map(k => {
      const l = by[k].map(effPts).sort((a, b) => b - a), n = by[k].length;
      return [k, l.slice(0, W.best).reduce((a, b) => a + b, 0), n];
    });
    rows.sort((a, b) => (b[1] - a[1]) || (b[2] - a[2]) || (a[0] < b[0] ? -1 : 1));
    return rows.slice(0, opt.top || W.rowsMax);
  }
  async function encodeBest(o, key) {
    const j = { v: 1, kw: int(o && o.kw, 1, 53, 0), j: str(o && o.j, /^\d{4}$/, ''), t: int(o && o.t, 0, 4e12, 0),
      rows: ((o && o.rows) || []).slice(0, W.rowsMax).map(r => [str(r[0], KRE, '?'), int(r[1], 0, 9999, 0), int(r[2], 0, 99, 0)]), note: 'Summe der besten ' + W.best + ' Duelle' };
    const body = b64(JSON.stringify(j));
    return 'TFB1.' + body + '.' + await sign(key, body);
  }
  const RE_B = /TFB1\.[A-Za-z0-9_-]+\.(?:[0-9a-f]{12}|u)(?![A-Za-z0-9_-])/g;
  function parseBest(txt) {
    const out = []; let s; try { s = String(txt == null ? '' : txt); } catch (e) { return out; }
    (s.slice(0, 200000).match(RE_B) || []).slice(0, 50).forEach(c => {
      try {
        const body = c.slice(5, c.lastIndexOf('.')), sig = c.slice(c.lastIndexOf('.') + 1), o = JSON.parse(unb64(body));
        if (!o || !Array.isArray(o.rows)) return;
        out.push({ kw: int(o.kw, 1, 53, 0), j: str(o.j, /^\d{4}$/, ''), t: int(o.t, 0, 4e12, 0), sig,
          rows: o.rows.slice(0, W.rowsMax).map(r => [str(r && r[0], KRE, '?'), int(r && r[1], 0, 9999, 0), int(r && r[2], 0, 99, 0)]), code: c });
      } catch (e) {}
    });
    return out;
  }

  /* ---------- Duell-Zustand (localStorage, Speicher austauschbar fuer Tests) ---------- */
  const ls = s => s || (typeof localStorage !== 'undefined' ? localStorage : null);
  const jget = (s, k, d) => { try { const v = JSON.parse(ls(s).getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const jset = (s, k, v) => { try { ls(s).setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const current = s => { const c = jget(s, KEYS.cur, null); return c && c.r && !c.done ? c : null; };
  const active = s => { const c = current(s); return !!(c && c.start); };
  const history = s => { const h = jget(s, KEYS.hist, null); return h && Array.isArray(h.hist) ? h.hist : []; };
  /* Start: legt lm4.duellcur an. Vorwissen (pr) und Tipp-Grundstand werden jetzt festgehalten. */
  function start(runde, task, st, s, now) {
    const r = roundBase(runde); if (!r || !task || !task[0]) return null;
    const a = task[0], h0 = int(jget(s, 'sim.hints', {})[a], 0, 99, 0), done = Math.max(num((jget(s, 'sim.done', {}))[a], 0), num((jget(s, 'lm4.tdone', {}))[a], 0));
    const c = { r, a, lab: task[1] || '', st: int(st, 1, 3, 2), start: now == null ? Date.now() : now, tries: 0, h0: int(jget(s, 'sim.hints', {})[a], 0, 99, 0), pct: 0, done: 0, pr: (done >= 100 || (h0 >= 3 && !SEEDLABS.includes(task[1]))) ? 1 : 0 };   /* gesehene Aufloesung (Stufe 3) = Vorkenntnis, ausser Seed-Labs (Fehler variiert) */
    const old = current(s); if (old && old.start && old.r !== r) return null;   /* laufendes Duell nie stumm ueberschreiben (UI fragt vorher) */
    if (!jset(s, KEYS.cur, c)) return null; return c;
  }
  const hintsUsed = (c, s) => Math.min(2, Math.max(c.hn || 0, int(jget(s, 'sim.hints', {})[c.a], 0, 99, 0) - (c.h0 || 0)));
  /* Tipp im Duell (aus Auswertung.hint): jeder Tipp zaehlt (-W.tipp), Stufe 3 gesperrt. null = kein Duell fuer diese Aufgabe, { blocked } = gesperrt, { n } = Stufe */
  function hintDuell(id, s) {
    const c = current(s); if (!c || !c.start || c.a !== id) return null;
    if ((c.hn || 0) >= 2) return { blocked: true, n: c.hn };
    c.hn = (c.hn || 0) + 1; jset(s, KEYS.cur, c); return { n: c.hn };
  }
  /* Rechen-Duell (Blitz, SchaltLab): eigener Zustand lm4.duellr { seed, start, done, ms } */
  const RK = 'lm4.duellr';
  const rechCur = s => { const c = jget(s, RK, {}); return c && typeof c === 'object' ? c : {}; };
  function rechStart(seed, s, now) { const c = { seed: String(seed), start: now == null ? Date.now() : now }; jset(s, RK, c); return c; }
  function rechPrep(seed, s) { jset(s, RK, { seed: String(seed) }); }
  function rechCancel(s) { const c = rechCur(s); jset(s, RK, { seed: c.seed, done: 1 }); }
  function rechSolved(taskId, s, now) {
    const c = rechCur(s); if (!c.start || c.done) return null; const ms = (now == null ? Date.now() : now) - c.start;
    jset(s, RK, { seed: c.seed, start: c.start, done: 1, ms }); return { seed: c.seed, ms, n: rechnenSave(c.seed, ms, taskId, s) };
  }
  /* Ende: schreibt Historie, Bestzaehler. api: { m, mp } optional (LabDuellAPI). */
  function finish(c, s, now, api) {
    const t = now == null ? Date.now() : now, k = (ls(s).getItem('lm4.kuerzel') || '').trim(), j = (ls(s).getItem('lm4.jahrgang') || '').replace(/"/g, '').trim();
    const rec = { r: c.r, a: c.a, lab: c.lab, st: c.st, t, ms: Math.max(0, t - c.start), pct: c.pct, h: Math.min(2, hintsUsed(c, s)), f: c.tries, pr: c.pr || 0 };
    if (api && api.m != null) rec.m = api.m;
    else if (MESSLABS[c.lab]) { rec.m = c.mz || 0; if (!(api && api.mp != null) && c.mp > 0) api = Object.assign({}, api || {}, { mp: c.mp }); } /* D4: Messzaehler der Lab-Adapter */
    const sc = score({ st: rec.st, pct: rec.pct, ms: rec.ms, h: hintsUsed(c, s), f: rec.f, m: rec.m == null ? null : rec.m, mp: api && api.mp != null ? api.mp : null });
    rec.pts = sc.pts; rec.k = k; rec.j = j; rec.sc = sc;
    const store = { v: 1, hist: history(s).concat([{ r: rec.r, a: rec.a, lab: rec.lab, st: rec.st, t: rec.t, ms: rec.ms, pct: rec.pct, h: rec.h, f: rec.f, m: rec.m, pr: rec.pr, pts: rec.pts }]).slice(-W.histMax) };
    jset(s, KEYS.hist, store);
    jset(s, KEYS.cur, Object.assign({}, c, { done: 1, ms: rec.ms, pct: rec.pct, pts: rec.pts }));
    return rec;
  }
  /* D4 Lab-Adapter: Messungen melden (gleicher Punkt hintereinander zaehlt einmal; gespeichert wird nur ein Hash des Punkts, nie Fehler/Ursache)
   * und Seed fuer verdeckte Fehler (nur fuer die laufende Duell-Aufgabe selbst, sonst 0 = Normalmodus unveraendert). */
  const MESSLABS = { nts: 1, pcb: 1 };
  function mess(lab, key, mp, s) {
    const c = current(s); if (!c || !c.start || c.lab !== lab || !MESSLABS[lab]) return null;
    const k = hash(String(key == null ? '' : key)); if (c.mk === k) return c.mz || 0;
    c.mz = (c.mz || 0) + 1; c.mk = k; if (mp > 0) c.mp = Math.min(99, Math.round(mp)); jset(s, KEYS.cur, c); return c.mz;
  }
  const seedFor = (id, s) => { const c = current(s); return c && c.start && id && c.a === id ? seedNum(c.r) : 0; };
  /* Haken: wird bei jedem Badges.result(id, pct) gerufen. Gibt bei Ende den Duell-Datensatz zurueck, sonst null. */
  function onResult(id, pct, s, now, api) {
    const c = current(s); if (!c || !c.start || c.a !== id) return null;
    pct = int(pct, 0, 100, 0);
    if (pct >= 100) { c.pct = 100; return finish(c, s, now, api); }
    c.tries = (c.tries || 0) + 1; c.pct = pct; jset(s, KEYS.cur, c); return null;
  }
  function giveUp(s, now, api) { const c = current(s); return c && c.start ? finish(c, s, now, api) : null; }
  function cancel(s) { const c = current(s); if (c) jset(s, KEYS.cur, Object.assign({}, c, { done: 1, cancel: 1 })); }
  /* Rechen-Duell des SchaltLabs (alte Variante, Schluessel lm4.duels bleibt kompatibel) */
  function rechnenSave(seed, ms, taskId, s) { const du = jget(s, KEYS.duels, {}); if (!du[seed] || du[seed][0] > ms) { du[seed] = [ms, taskId || '']; jset(s, KEYS.duels, du); } return Object.keys(du).length; }
  /* Migration (reine Datenmigration, nur auf Aufruf): alter lm4.duelcur des SchaltLabs -> entfernt; ein noch laufendes altes Duell wird verworfen */
  function migrate(s) {
    const o = jget(s, KEYS.old, null); if (o === null) return { migrated: false };
    try { ls(s).removeItem(KEYS.old); } catch (e) {}
    if (o && o.seed && o.done && o.ms > 0) rechnenSave(o.seed, o.ms, o.id || '', s);
    return { migrated: true, running: !!(o && o.start && !o.done) };
  }
  /* Wrapper-Hook: Badges.result zuerst original, dann Duell.onResult. Doppeltes Haken wird verhindert. */
  function hook(g, api) {
    g = g || root; if (!g.Badges || typeof g.Badges.result !== 'function' || g.Badges.result.__duell) return false;
    const orig = g.Badges.result;
    const w = function (id, pct) {
      const r = orig.apply(this, arguments); let rec = null;
      try {
        const a = g.LabDuellAPI, ap = a ? { m: typeof a.messungen === 'function' ? a.messungen() : null, mp: a.messpunkte == null ? null : a.messpunkte } : {};
        rec = onResult(id, pct, null, Date.now(), Object.assign({}, ap, api || {}));
      } catch (e) {}
      if (rec && g.Duell && typeof g.Duell.onFinish === 'function') { try { g.Duell.onFinish(rec); } catch (e) {} }
      return r;
    };
    w.__duell = true; w.orig = orig; g.Badges.result = w; return true;
  }

  const Duell = {
    W, KATS, NOLABS, EXTRA, SEEDLABS, KEYS, MESSLABS,
    core: { KRE, cleanId, kw, seeded, hash, seedNum, newRound, parseRound, roundBase, pool, pick, score, cmp, effPts, normalize, encode, parse, verify, flags, sign, checksum, bestenliste, encodeBest, parseBest, b64, unb64 },
    store: { current, active, history, start, mess, seedFor, hintsUsed, hintDuell, finish, onResult, giveUp, cancel, rechnenSave, migrate },
    hook,
    rechnen: { cur: rechCur, prep: rechPrep, start: rechStart, cancel: rechCancel, solved: rechSolved, key: RK },
    hintDuell: id => hintDuell(id, null),
    active: () => active(null),
    seedNum: () => { const c = current(null); return c && c.start ? seedNum(c.r) : 0; },
    mess: (lab, key, mp) => { try { return mess(lab, key, mp, null); } catch (e) { return null; } },
    seedFor: id => { try { return seedFor(id, null); } catch (e) { return 0; } },
    onFinish: null
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Duell;
  root.Duell = Duell;

  /* ---------- Browser: Haken, Migration, Oberflaeche (duellui.js + duell.css) erst bei Bedarf laden ---------- */
  if (typeof document !== 'undefined' && root.document === document && !root.__duellNoUi) {
    let ui = null; const q = [];
    const loadUi = cb => {
      if (Duell.ui) { cb && cb(Duell.ui); return; }
      if (cb) q.push(cb);
      if (ui) return; ui = 1;
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'duell.css'; document.head.appendChild(l);
      const sc = document.createElement('script'); sc.src = 'duellui.js';
      sc.onload = () => { while (q.length) { try { q.shift()(Duell.ui); } catch (e) {} } };
      document.head.appendChild(sc);
    };
    Duell.loadUi = loadUi;
    Duell.open = o => loadUi(u => u.open(o || {}));
    Duell.onFinish = rec => loadUi(u => u.finished(rec));
    try { Duell.hook(root); Duell.store.migrate(); } catch (e) {}
    const boot = () => {
      let need = false;
      try { need = Duell.active() || !!(Duell.rechnen.cur().start && !Duell.rechnen.cur().done) || /[?&]duell=K/i.test(location.search) || !!document.getElementById('top'); } catch (e) {}
      if (need) loadUi();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
