/* tausch.js - Fehler-Tauschboerse, Kern (Paket T1): reine Funktionen ohne DOM, in Node UND im Browser ladbar.
   Inhalt: Wertungstabelle WT, Fehlerkarte TFF1.<oeffentlich>.<verdeckt>.<sig>, Ergebnis TFE1.<json>.<sig> (Tausch-Variante q:'f'),
   XOR-Verschleierung des verdeckten Teils, Beleg-Hash, Normalisierung, Flags, Guete GK der Karte, Bestenliste der Loeser,
   Zustand (localStorage lm4.tausch / lm4.tauschcur, Speicher austauschbar fuer Tests).
   NICHT enthalten: Oberflaeche, Boot-Haken #t=, Lab-Adapter (Pakete T3/T4). Wertung kommt IMMER aus Duell.core.score.
   Ehrlich (Spec 4.4): manipulationsARM. Schluessel (cid) und Salz stehen im Code bzw. in der Karte. Die Verschleierung schuetzt nur davor,
   den Fehler per Base64 abzulesen; wer JavaScript liest, kann entschluesseln. Echter Schutz = Nachstellen durch den Ausbilder.
   Codes tragen nur lm4.kuerzel (Anzeigename), nie lm4.name. Oeffentlicher Teil: nie Fehler-Id, nie Fehlername.
   Annahmen (Spec offen, konservativ entschieden):
   A1 TFE1-f traegt zusaetzlich st (Stufe 1-3), damit Leser ohne Karte die Punkte mit Duell.core.score neu rechnen koennen.
      Mit bekannter Karte gilt deren st. fair:null wird im Code weggelassen (spart Platz), Lesen ergibt null.
   A2 Beleg bei p < 100 (Aufgeben) = '00000000'; geprueft wird nur bei p = 100. Ohne entschluesselte Karte ist der Beleg 'offen',
      solche Loesungen zaehlen nicht fuer die Guete (Ersteller/Ausbilder haben die Karte immer).
   A3 Guete-Ausschluss: Flags sig_falsch, zu_schnell (4.2), geraten (4.5 Absprache), eigen, beleg, beleg_offen, ausserhalb, ungueltig;
      doppelt wird in guete() selbst bestimmt (je k die zeitlich erste). 'unsigniert' (file://, ohne WebCrypto) zaehlt NICHT als Ausschluss,
      sonst waere die Funktion unter file:// tot; die UI zeigt den Hinweis.
   A4 bis: Pflicht, > t; ueber t + 14 Tage wird auf t + 14 Tage gekuerzt. Standard beim Bauen t + WT.bisStd Tage.
      Karte zusaetzlich mit Flags abgelaufen (now > bis) und zukunft (t > now + 5 min); ungueltig = Inhalt nicht lesbar.
   A5 Verifizieren prueft die Signatur ueber den ROHEN Text, bevor der Inhalt gelesen wird: jede 1-Zeichen-Aenderung ergibt sig_falsch,
      auch wenn der Inhalt danach nicht mehr lesbar ist (dann zusaetzlich ungueltig).
   A6 Ohne registrierten Adapter fuer lab/rig/sym ist eine Karte ungueltig. Die Adapter-Listen muessen daher auch dort registriert sein,
      wo keine Lab-Oberflaeche laeuft (Ausbilder-Uebersicht) -> T3 sollte die Listen als reine Daten registrieren (ohne DOM).
   A7 Verdeckter Teil: c = flaches Objekt (<= 24 Schluessel, Zahl/Wahrheitswert/kurzer Text), f = Id (Text) oder Mangel-Liste (<= 8 Ids),
      mp = Messpunkte 0-99. Ob f zur Fehlerliste des Pruefstands gehoert, prueft der Adapter (check), nicht der Kern.
   A8 Kartenflut (4.5): je Ersteller-Tag zaehlen hoechstens WT.proTag Karten (die zeitlich ersten) fuer den Ersteller-Wert. */
(function (root) {
  'use strict';
  const Duell = root.Duell || (typeof require === 'function' ? require('./duell.js') : null);
  const C = Duell.core;

  /* ---------- Tabelle (alle Zahlen hier, nirgends sonst) ---------- */
  const TAG = 86400000;
  const WT = {
    bisMax: 14 * TAG, bisStd: 7 * TAG, nachlauf: 7 * TAG, spiel: 5 * 60000,   /* Gueltigkeit, Wegfall bis + 7 Tage, Uhren-Toleranz */
    eigene: 30, inbox: 50, rueck: 30, erg: 200, parseMax: 500, textMax: 200000,
    hMax: 2, nMin: 3, qZiel: 0.7, qBreite: 0.5, mBasis: 2, mSpanne: 4, fOhne: 0.5,
    gQ: 0.45, gM: 0.30, gF: 0.25, best: 5, gueteBest: 3, proTag: 3, rowsMax: 10,
    cMax: 24, fMax: 8, karteZiel: 450
  };
  const APPSALT = 'lm4|tausch|v1';                     /* steht im Code: nur Verschleierung, kein Geheimnis */
  const AUS = ['sig_falsch', 'zu_schnell', 'geraten', 'eigen', 'beleg', 'beleg_offen', 'ausserhalb', 'ungueltig'];
  const STATUS = ['neu', 'laeuft', 'geloest', 'aufgegeben', 'probe'];
  const KEYS = { st: 'lm4.tausch', cur: 'lm4.tauschcur' };

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const num = (x, d) => { const n = typeof x === 'number' ? x : (typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN); return isFinite(n) ? n : d; };
  const int = (x, a, b, d) => { const n = num(x, NaN); return isFinite(n) ? clamp(Math.round(n), a, b) : d; };
  const str = (x, re, d) => { const s = typeof x === 'string' ? x : ''; return re.test(s) ? s : d; };
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const arr = a => Array.isArray(a) ? a : [];
  const CIDRE = /^[0-9A-F]{6}$/, IDRE = /^[A-Za-z0-9_-]{1,24}$/, FRE = /^[A-Za-z0-9_.:-]{1,32}$/, CKRE = /^[A-Za-z0-9_]{1,16}$/, CVRE = /^[A-Za-z0-9_.,:+-]{0,24}$/;
  const APPRE = /^v\d{1,3}\.\d{1,4}$/, HEX8 = /^[0-9a-f]{8}$/;
  const median = l => { const a = l.filter(x => isFinite(x)).sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };

  /* ---------- Zufall: Karten-Nr. aus crypto.getRandomValues ---------- */
  function newCid() {
    try {
      const c = root.crypto || (typeof require === 'function' ? require('crypto').webcrypto : null);
      if (c && c.getRandomValues) { const a = c.getRandomValues(new Uint8Array(3)); let s = ''; for (let i = 0; i < 3; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s.toUpperCase(); }
    } catch (e) {}
    let s = ''; for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 16).toString(16); return s.toUpperCase();
  }

  /* ---------- Adapter-Listen (Registrierung aus den Labs, Paket T3) ---------- */
  /* registerAdapter('nts', { rigs:['fehler'], symptoms:['kein-ausgang', ...] | { fehler:[...] } }); null entfernt */
  const ADAPT = Object.create(null);
  function registerAdapter(lab, o) {
    if (typeof lab !== 'string' || !/^[a-z]{2,5}$/.test(lab)) return false;
    if (o == null) { delete ADAPT[lab]; return true; }
    const rigs = arr(o.rigs).filter(r => typeof r === 'string' && IDRE.test(r)); if (!rigs.length) return false;
    const sy = Object.create(null), list = l => arr(l).filter(x => typeof x === 'string' && IDRE.test(x)).slice(0, 40);
    rigs.forEach(r => { sy[r] = list(Array.isArray(o.symptoms) ? o.symptoms : (isObj(o.symptoms) ? o.symptoms[r] : null)); });
    ADAPT[lab] = { rigs, sy }; return true;
  }
  const adapters = () => { const o = {}; Object.keys(ADAPT).forEach(l => { o[l] = { rigs: ADAPT[l].rigs.slice(), symptoms: Object.assign({}, ADAPT[l].sy) }; }); return o; };
  const symsOf = (lab, rig) => (ADAPT[lab] && ADAPT[lab].sy[rig]) || [];

  /* ---------- Bytes, Base64url, XOR-Verschleierung ---------- */
  const utf8 = s => typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8'));
  const deutf8 = b => typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }).decode(b) : Buffer.from(b).toString('utf8');
  const bb64 = u => { let bin = ''; for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]); const x = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64'); return x.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unbb64 = s => { const p = s.replace(/-/g, '+').replace(/_/g, '/'), q = p + '==='.slice((p.length + 3) % 4); const bin = typeof atob === 'function' ? atob(q) : Buffer.from(q, 'base64').toString('binary'); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  /* Schluesselstrom seeded(hash('TFF1|' + cid + '|' + APPSALT)); XOR ist sein eigenes Gegenstueck */
  const xor = (u, cid) => { const r = C.seeded(C.hash('TFF1|' + cid + '|' + APPSALT)), o = new Uint8Array(u.length); for (let i = 0; i < u.length; i++) o[i] = u[i] ^ (Math.floor(r() * 256) & 255); return o; };
  const veil = (obj, cid) => bb64(xor(utf8(JSON.stringify(obj)), cid));
  const unveil = (txt, cid) => { try { return JSON.parse(deutf8(xor(unbb64(txt), cid))); } catch (e) { return null; } };

  /* ---------- Beleg: FNV-32 von cid|Fehler-Id|k als 8 Hex ---------- */
  const fkey = f => { const x = fid(f); return Array.isArray(x) ? x.slice().sort().join(',') : (x || ''); };   /* wie normHid: Liste dedupliziert, ordnungsfrei */
  const beleg = (cid, f, k) => C.hash(String(cid) + '|' + fkey(f) + '|' + String(k)).toString(16).padStart(8, '0');

  /* ---------- Normalisierung Karte ---------- */
  function normPub(o) {
    if (!isObj(o)) return null;
    const lab = str(o.lab, /^[a-z]{2,5}$/, ''), ad = ADAPT[lab]; if (!ad) return null;
    const rig = str(o.rig, IDRE, ''), sym = str(o.sym, IDRE, '');
    if (ad.rigs.indexOf(rig) < 0 || symsOf(lab, rig).indexOf(sym) < 0) return null;
    const cid = str(o.cid, CIDRE, ''), k = str(o.k, C.KRE, ''), t = int(o.t, 0, 4e12, 0), b = int(o.bis, 0, 4e12 + WT.bisMax, 0);
    if (!cid || !k || !t || b <= t) return null;
    return { v: 1, cid, k, j: str(o.j, /^\d{4}$/, ''), lab, rig, st: int(o.st, 1, 3, 2), sym, t, bis: Math.min(b, t + WT.bisMax), app: str(o.app, APPRE, '') };
  }
  const fid = f => {
    if (typeof f === 'string') return FRE.test(f) ? f : null;
    if (!Array.isArray(f)) return null;
    const l = []; f.forEach(x => { if (typeof x === 'string' && FRE.test(x) && l.indexOf(x) < 0 && l.length < WT.fMax) l.push(x); });
    return l.length ? l : null;
  };
  function normHid(o) {
    if (!isObj(o)) return null;
    const f = fid(o.f); if (!f) return null;
    const c = {};
    if (isObj(o.c)) Object.keys(o.c).slice(0, WT.cMax).forEach(key => {
      const v = o.c[key]; if (!CKRE.test(key)) return;
      if (typeof v === 'number' && isFinite(v) && Math.abs(v) <= 1e9) c[key] = v;
      else if (typeof v === 'boolean') c[key] = v;
      else if (typeof v === 'string' && CVRE.test(v)) c[key] = v;
    });
    const out = { c, f }; if (o.mp != null) { const mp = int(o.mp, 0, 99, null); if (mp != null) out.mp = mp; }
    return out;
  }
  const PUBF = ['v', 'cid', 'k', 'j', 'lab', 'rig', 'st', 'sym', 't', 'bis', 'app'];
  const pack = (rec, F) => { const o = {}; F.forEach(f => { if (rec[f] !== undefined && rec[f] !== '' && rec[f] !== null) o[f] = rec[f]; }); return JSON.stringify(o); };

  /* ---------- Codec TFF1 ---------- */
  /* o: { k, j, lab, rig, st, sym, t?, bis?, app, cid?, c, f, mp }. Liefert { code, cid, card, hidden } oder null. k = lm4.kuerzel, nie lm4.name. */
  async function makeCard(o, opt) {
    o = o || {}; opt = opt || {};
    const t = int(o.t, 0, 4e12, 0) || int(opt.now, 0, 4e12, 0) || Date.now();
    const card = normPub(Object.assign({}, o, { v: 1, cid: o.cid ? String(o.cid).toUpperCase() : newCid(), t, bis: o.bis == null ? t + WT.bisStd : o.bis }));
    const hidden = normHid(o); if (!card || !hidden) return null;
    const pt = C.b64(pack(card, PUBF)), ht = veil(hidden, card.cid);
    return { code: 'TFF1.' + pt + '.' + ht + '.' + await C.sign(card.cid, pt + '.' + ht), cid: card.cid, card, hidden };
  }
  const RE_F = /TFF1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.(?:[0-9a-f]{12}|u)(?![A-Za-z0-9_-])/g;
  const text = txt => { try { return String(txt == null ? '' : txt).slice(0, WT.textMax); } catch (e) { return ''; } };
  /* parseCards: alle TFF1 im Text (auch in einer URL #t=...), ohne Ausnahme. [{ code, pt, ht, sig, card|null, hidden|null }] */
  function parseCards(txt) {
    const out = [];
    (text(txt).match(RE_F) || []).slice(0, WT.parseMax).forEach(code => {
      try {
        const p = code.split('.'), e = { code, pt: p[1], ht: p[2], sig: p[3], card: null, hidden: null };
        try { e.card = normPub(JSON.parse(C.unb64(e.pt))); } catch (x) {}
        if (e.card) e.hidden = normHid(unveil(e.ht, e.card.cid));
        out.push(e);
      } catch (x) {}
    });
    return out;
  }
  /* nur den oeffentlichen Teil lesen, ohne Adapter-Pruefung (fuer Speicher-Aufraeumen und Kartenliste ohne Lab) */
  function peek(code) {
    try {
      const m = text(code).match(RE_F); if (!m) return null; const o = JSON.parse(C.unb64(m[0].split('.')[1]));
      const cid = str(o && o.cid, CIDRE, ''), t = int(o && o.t, 0, 4e12, 0), bis = int(o && o.bis, 0, 4e12 + WT.bisMax, 0);
      return cid && t && bis > t ? { cid, t, bis: Math.min(bis, t + WT.bisMax), lab: str(o.lab, /^[a-z]{2,5}$/, ''), rig: str(o.rig, IDRE, ''), st: int(o.st, 1, 3, 2), sym: str(o.sym, IDRE, ''), k: str(o.k, C.KRE, '') } : null;
    } catch (e) { return null; }
  }
  async function sigState(key, body, sig) {
    if (sig === 'u') return 'unsigniert';
    const want = await C.sign(key, body); return want === 'u' ? 'unsigniert' : (want === sig ? 'ok' : 'falsch');
  }
  /* verifyCard: erster TFF1 im Text (oder Eintrag aus parseCards). { ok, sig, card, hidden, flags, code } oder null (kein TFF1) */
  async function verifyCard(x, ctx) {
    ctx = ctx || {}; const e = x && typeof x === 'object' && x.pt ? x : parseCards(x)[0]; if (!e) return null;
    const now = ctx.now == null ? Date.now() : ctx.now, fl = [];
    /* Schluessel = cid aus dem Rohtext (auch wenn der Inhalt unlesbar ist) */
    let cid = e.card ? e.card.cid : ''; if (!cid) { try { cid = String(JSON.parse(C.unb64(e.pt)).cid || '?'); } catch (q) { cid = '?'; } }
    const sg = await sigState(cid, e.pt + '.' + e.ht, e.sig);
    if (sg !== 'ok') fl.push(sg === 'falsch' ? 'sig_falsch' : 'unsigniert');
    if (!e.card || !e.hidden) fl.push('ungueltig');
    else { if (now > e.card.bis) fl.push('abgelaufen'); if (e.card.t > now + WT.spiel) fl.push('zukunft'); }
    return { ok: sg === 'ok' && !fl.length, sig: sg, card: e.card, hidden: e.hidden, flags: fl, code: e.code };
  }

  /* ---------- Codec TFE1 (Tausch-Variante q:'f'; q:'w' gehoert wett.js) ---------- */
  function normErg(o) {
    if (!isObj(o) || o.q !== 'f') return null;
    const cid = str(o.cid, CIDRE, ''), k = str(o.k, C.KRE, ''), ck = str(o.ck, C.KRE, ''); if (!cid || !k || !ck) return null;
    const hRaw = int(o.h, 0, 9999, 0);
    const out = { v: 1, q: 'f', cid, ck, k, j: str(o.j, /^\d{4}$/, ''), st: int(o.st, 1, 3, 2), t: int(o.t, 0, 4e12, 0), ms: int(o.ms, 0, 3 * 3600 * 1000, 0),
      p: int(o.p, 0, 100, 0), h: clamp(hRaw, 0, WT.hMax), f: int(o.f, 0, 50, 0), fair: o.fair === 1 || o.fair === 0 ? o.fair : null, b: str(o.b, HEX8, ''), app: str(o.app, APPRE, '') };
    if (o.m != null) out.m = int(o.m, 0, 200, 0);
    if (o.mp != null) { const mp = int(o.mp, 0, 99, null); if (mp != null) out.mp = mp; }
    Object.defineProperty(out, '_hRaw', { value: hRaw, enumerable: false });
    return out;
  }
  const ERGF = ['v', 'q', 'cid', 'ck', 'k', 'j', 'st', 't', 'ms', 'p', 'h', 'f', 'm', 'mp', 'fair', 'b', 'app'];
  /* o: { card (normalisiert), k, j, t, ms, p, h, f, m?, mp?, fair, fnd (gefundene Fehler-Id), app }. opt.key = Ausbilder-Schluessel. Kein pts im Code. */
  async function makeErg(o, opt) {
    o = o || {}; opt = opt || {}; const card = o.card || {};
    const p = int(o.p, 0, 100, 0), k = o.k;
    const rec = normErg(Object.assign({}, o, { q: 'f', cid: card.cid, ck: card.k, st: card.st, t: o.t == null ? Date.now() : o.t,
      b: p >= 100 && o.fnd != null ? beleg(card.cid, o.fnd, k) : '00000000' }));
    if (!rec) return null;
    const body = C.b64(pack(rec, ERGF));
    return 'TFE1.' + body + '.' + await C.sign(opt.key == null ? rec.cid : opt.key, body);
  }
  const RE_E = /TFE1\.[A-Za-z0-9_-]+\.(?:[0-9a-f]{12}|u)(?![A-Za-z0-9_-])/g;
  /* parseErgs: alle TFE1 im Text. [{ code, body, sig, q, rec|null }]; q:'w' (Wettbewerb) wird uebersprungen */
  function parseErgs(txt) {
    const out = [];
    (text(txt).match(RE_E) || []).slice(0, WT.parseMax).forEach(code => {
      try {
        const i = code.indexOf('.'), j = code.lastIndexOf('.'), e = { code, body: code.slice(i + 1, j), sig: code.slice(j + 1), q: null, rec: null, cidRaw: '' };
        try { const o = JSON.parse(C.unb64(e.body)); e.q = isObj(o) && typeof o.q === 'string' ? o.q : null; e.cidRaw = isObj(o) ? String(o.cid || '') : ''; e.rec = normErg(o); } catch (x) {}
        if (e.q !== 'w') out.push(e);
      } catch (x) {}
    });
    return out;
  }
  /* Punkte immer neu: Stufe und Messpunkte der Karte haben Vorrang */
  const pts = (rec, card, hidden) => C.score({ st: card ? card.st : rec.st, pct: rec.p, ms: rec.ms, h: rec.h, f: rec.f, m: rec.m == null ? null : rec.m,
    mp: hidden && hidden.mp != null ? hidden.mp : (rec.mp == null ? null : rec.mp) });
  /* flags: ctx { now, card, hidden, von, bis, seen (Set 'k|cid'), mp }. Duell-Flags (geraten, zu_schnell, tipps, zukunft) + eigen, doppelt, ausserhalb, beleg(_offen) */
  function flags(rec, ctx) {
    ctx = ctx || {}; const now = ctx.now == null ? Date.now() : ctx.now, card = ctx.card || null, hid = ctx.hidden || null;
    const st = card ? card.st : rec.st, sc = pts(rec, card, hid);
    const f = C.flags({ st, p: rec.p, ms: rec.ms, h: rec.h, f: rec.f, m: rec.m == null ? null : rec.m, pts: sc.pts, _hRaw: rec._hRaw, t: rec.t, r: '' }, { now, mp: null }).filter(x => x !== 'punkte' && x !== 'fremde_kw');
    if (rec.k === rec.ck || (card && rec.k === card.k)) f.push('eigen');
    const key = rec.k + '|' + rec.cid;
    if (ctx.seen && typeof ctx.seen.has === 'function') { if (ctx.seen.has(key)) f.push('doppelt'); else ctx.seen.add(key); }
    const von = card ? card.t : ctx.von, bis = card ? card.bis : ctx.bis;
    if ((von != null && rec.t < von - WT.spiel) || (bis != null && rec.t > bis + WT.spiel)) f.push('ausserhalb');
    if (rec.p >= 100) { if (!hid) f.push('beleg_offen'); else if (rec.b !== beleg(rec.cid, hid.f, rec.k)) f.push('beleg'); }
    return f;
  }
  /* verifyErg: erster TFE1-f im Text (oder Eintrag). ctx wie flags, dazu key (Ausbilder-Schluessel). { ok, sig, rec, flags, pts, sc, beleg, code } oder null */
  async function verifyErg(x, ctx) {
    ctx = ctx || {}; const e = x && typeof x === 'object' && x.body ? x : parseErgs(x)[0]; if (!e) return null;
    const key = ctx.key != null ? ctx.key : (e.rec ? e.rec.cid : (e.cidRaw || '?'));
    const sg = await sigState(key, e.body, e.sig), fl = e.rec ? flags(e.rec, ctx) : ['ungueltig'];
    if (e.rec && ctx.card && e.rec.cid !== ctx.card.cid) fl.push('ungueltig');
    if (sg !== 'ok') fl.push(sg === 'falsch' ? 'sig_falsch' : 'unsigniert');
    const sc = e.rec ? pts(e.rec, ctx.card, ctx.hidden) : null;
    const bl = !e.rec || e.rec.p < 100 ? '-' : (fl.indexOf('beleg_offen') >= 0 ? 'offen' : (fl.indexOf('beleg') >= 0 ? 'falsch' : 'ok'));
    return { ok: sg === 'ok' && !fl.length, sig: sg, rec: e.rec, flags: fl, pts: sc ? sc.pts : 0, sc, beleg: bl, code: e.code };
  }
  /* mehrere Ergebnisse: doppelt = jede spaetere Abgabe (nach t) desselben k zur selben Karte */
  async function verifyErgs(txt, ctx) {
    const l = []; for (const e of parseErgs(txt)) { const v = await verifyErg(e, Object.assign({}, ctx || {}, { seen: null })); if (v) l.push(v); }
    const seen = new Set();
    l.filter(v => v.rec).sort((a, b) => a.rec.t - b.rec.t).forEach(v => { const key = v.rec.k + '|' + v.rec.cid; if (seen.has(key)) { v.flags.push('doppelt'); v.ok = false; } else seen.add(key); });
    return l;
  }

  /* ---------- Guete der Karte (4.2) ---------- */
  /* list: Ergebnisse aus verifyErg (mit card + hidden). Liefert { n, gk|null, q, Q, M, F, fehlt, pruefen } */
  function guete(list, card) {
    const cid = card && card.cid, seen = {}, ok = [];
    arr(list).filter(v => v && v.rec && (!cid || v.rec.cid === cid)).sort((a, b) => a.rec.t - b.rec.t).forEach(v => {
      if (seen[v.rec.k] || arr(v.flags).some(f => AUS.indexOf(f) >= 0)) return; seen[v.rec.k] = 1; ok.push(v);
    });
    const n = ok.length; if (n < WT.nMin) return { n, gk: null, fehlt: WT.nMin - n, pruefen: false };
    const sol = ok.filter(v => v.rec.p >= 100), q = sol.length / n;
    const Q = Math.round(clamp(1 - Math.abs(q - WT.qZiel) / WT.qBreite, 0, 1) * 1e6) / 1e6;   /* gerundet: kein 1e-16-Rest */
    const mm = sol.filter(v => v.rec.m != null).map(v => v.rec.m);
    const M = !sol.length ? 0 : (mm.length ? clamp((median(mm) - WT.mBasis) / WT.mSpanne, 0, 1) : clamp(median(sol.map(v => (v.sc || pts(v.rec, card)).A)) / 25, 0, 1));
    const votes = ok.filter(v => v.rec.fair === 1 || v.rec.fair === 0), F = votes.length ? votes.filter(v => v.rec.fair === 1).length / votes.length : WT.fOhne;
    if (!sol.length) return { n, gk: 0, q: 0, Q, M: 0, F, fehlt: 0, pruefen: true };
    return { n, gk: Math.round(100 * (WT.gQ * Q + WT.gM * M + WT.gF * F)), q, Q, M, F, fehlt: 0, pruefen: false };
  }
  /* Ersteller-Wert: je Tag hoechstens WT.proTag Karten (die ersten), davon die besten WT.gueteBest Gueten. cards: [{ cid, t, gk }] */
  function erstellerWert(cards) {
    const day = {}, use = [];
    arr(cards).filter(c => c && isFinite(c.t)).sort((a, b) => a.t - b.t).forEach(c => {
      const d = new Date(c.t), key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      day[key] = (day[key] || 0) + 1; if (day[key] <= WT.proTag && c.gk != null) use.push(int(c.gk, 0, 100, 0));
    });
    return use.sort((a, b) => b - a).slice(0, WT.gueteBest).reduce((a, b) => a + b, 0);
  }

  /* ---------- Bestenliste der Loeser (4.1) ---------- */
  /* list: verifyErg-Ergebnisse oder normalisierte rec. Je Loeser Summe der besten WT.best FREMDEN Karten, je Karte nur der erste Versuch.
     opt: { von, bis, j, top }. Ergebnis [[k, summe, karten]] */
  function bestenliste(list, opt) {
    opt = opt || {}; const first = {};
    arr(list).forEach(x => {
      const rec = x && x.rec ? x.rec : x; if (!rec || rec.q !== 'f' || !rec.k) return;
      if ((opt.von != null && rec.t < opt.von) || (opt.bis != null && rec.t > opt.bis) || (opt.j && rec.j !== opt.j)) return;
      const key = rec.k + '|' + rec.cid; if (!first[key] || rec.t < first[key].rec.t) first[key] = { rec, x };
    });
    const by = {};
    Object.keys(first).forEach(key => {
      const { rec, x } = first[key], fl = x && x.flags ? x.flags : [];
      if (rec.k === rec.ck || fl.some(f => f === 'sig_falsch' || f === 'eigen' || f === 'beleg' || f === 'ungueltig')) return;
      (by[rec.k] = by[rec.k] || []).push(x && x.rec && typeof x.pts === 'number' ? x.pts : pts(rec).pts);
    });
    const rows = Object.keys(by).map(k => [k, by[k].sort((a, b) => b - a).slice(0, WT.best).reduce((a, b) => a + b, 0), by[k].length]);
    rows.sort((a, b) => (b[1] - a[1]) || (b[2] - a[2]) || (a[0] < b[0] ? -1 : 1));
    return rows.slice(0, opt.top || WT.rowsMax);
  }

  /* ---------- Zustand (localStorage, Speicher austauschbar fuer Tests; jeder Zugriff in try/catch) ---------- */
  const ls = s => { if (s) return s; try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
  const jget = (s, k, d) => { try { const st = ls(s); if (!st) return d; const v = JSON.parse(st.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const jset = (s, k, v) => { try { const st = ls(s); if (!st) return false; st.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  /* Anzeigename fuer Codes: nur lm4.kuerzel (KRE), nie lm4.name */
  const kuerzel = s => { try { const st = ls(s); const k = st ? String(st.getItem('lm4.kuerzel') || '').replace(/"/g, '').trim() : ''; return C.KRE.test(k) ? k : null; } catch (e) { return null; } };
  const codeOk = c => typeof c === 'string' && c.length <= 4000;
  function clean(o, now) {
    o = isObj(o) ? o : {}; const alive = c => { const p = peek(c); return !!p && (now == null || p.bis + WT.nachlauf > now); };
    const eigene = arr(o.eigene).filter(e => isObj(e) && codeOk(e.code) && alive(e.code)).map(e => { const p = peek(e.code); return { cid: p.cid, t: int(e.t, 0, 4e12, p.t), lab: p.lab, rig: p.rig, st: p.st, code: e.code }; }).slice(-WT.eigene);
    const inbox = arr(o.inbox).filter(e => isObj(e) && codeOk(e.code) && alive(e.code)).map(e => ({ cid: peek(e.code).cid, code: e.code, t: int(e.t, 0, 4e12, 0), status: STATUS.indexOf(e.status) >= 0 ? e.status : 'neu' })).slice(-WT.inbox);
    const rueck = {}; const own = eigene.map(e => e.cid);
    if (isObj(o.rueck)) Object.keys(o.rueck).forEach(cid => { if (own.indexOf(cid) < 0) return; const l = []; arr(o.rueck[cid]).forEach(c => { if (codeOk(c) && /^TFE1\./.test(c) && l.indexOf(c) < 0) l.push(c); }); rueck[cid] = l.slice(-WT.rueck); });
    const erg = arr(o.erg).filter(e => isObj(e) && CIDRE.test(e.cid)).map(e => {
      const r = { cid: e.cid, t: int(e.t, 0, 4e12, 0), pts: int(e.pts, 0, 100, 0), p: int(e.p, 0, 100, 0), ms: int(e.ms, 0, 3 * 3600 * 1000, 0), h: int(e.h, 0, WT.hMax, 0), f: int(e.f, 0, 50, 0), b: str(e.b, HEX8, ''), code: codeOk(e.code) ? e.code : '' };
      if (e.m != null) r.m = int(e.m, 0, 200, 0); return r;
    }).slice(-WT.erg);
    return { v: 1, eigene, inbox, rueck, erg };
  }
  const get = (s, now) => clean(jget(s, KEYS.st, null), now == null ? Date.now() : now);
  const save = (st, s) => jset(s, KEYS.st, clean(st, null));
  const upd = (s, now, fn) => { const st = get(s, now); const r = fn(st); save(st, s); return r; };
  const addOwn = (code, s, now) => upd(s, now, st => { const p = peek(code); if (!p) return null; st.eigene = st.eigene.filter(e => e.cid !== p.cid).concat([{ cid: p.cid, t: p.t, code }]); return p.cid; });
  const addInbox = (code, s, now) => upd(s, now, st => { const p = peek(code); if (!p) return null; if (!st.inbox.some(e => e.cid === p.cid)) st.inbox.push({ cid: p.cid, code, t: now == null ? Date.now() : now, status: isOwn(p.cid, st) ? 'probe' : 'neu' }); return p.cid; });
  const setStatus = (cid, status, s, now) => upd(s, now, st => { const e = st.inbox.find(x => x.cid === cid); if (!e || STATUS.indexOf(status) < 0) return false; e.status = status; return true; });
  const addRueck = (cid, code, s, now) => upd(s, now, st => { if (!st.eigene.some(e => e.cid === cid) || !/^TFE1\./.test(String(code))) return false; const l = st.rueck[cid] = st.rueck[cid] || []; if (l.indexOf(code) >= 0) return false; l.push(code); return true; });
  const addErg = (rec, s, now) => upd(s, now, st => { if (!isObj(rec)) return false; st.erg.push(rec); return true; });
  function isOwn(cid, x) { const st = isObj(x) && Array.isArray(x.eigene) ? x : get(x, null); return st.eigene.some(e => e.cid === cid); }
  /* laufende Suche lm4.tauschcur { cid, start, tries, h, mz, mk, mp, done } */
  const cur = s => { const c = jget(s, KEYS.cur, null); return isObj(c) && CIDRE.test(c.cid) && !c.done ? c : null; };
  const active = s => { const c = cur(s); return !!(c && c.start); };
  function begin(cid, s, now) {
    if (!CIDRE.test(String(cid))) return null; const old = cur(s); if (old && old.start && old.cid !== cid) return null;   /* nie stumm ueberschreiben */
    const c = { cid, start: now == null ? Date.now() : now, tries: 0, h: 0, mz: 0, mk: 0, mp: 0, done: 0 }; return jset(s, KEYS.cur, c) ? c : null;
  }
  function mess(key, mp, s) { const c = cur(s); if (!c || !c.start) return null; const k = C.hash(String(key == null ? '' : key)); if (c.mk === k) return c.mz; c.mz = (c.mz || 0) + 1; c.mk = k; if (mp > 0) c.mp = Math.min(99, Math.round(mp)); jset(s, KEYS.cur, c); return c.mz; }
  function tipp(s) { const c = cur(s); if (!c || !c.start) return null; if ((c.h || 0) >= WT.hMax) return { blocked: true, n: c.h }; c.h = (c.h || 0) + 1; jset(s, KEYS.cur, c); return { n: c.h }; }
  function wrong(s) { const c = cur(s); if (!c || !c.start) return null; c.tries = (c.tries || 0) + 1; jset(s, KEYS.cur, c); return c.tries; }
  /* Ende (richtig p=100 oder Aufgeben p=0): Zaehler fuer makeErg; m nur, wenn das Lab Messungen meldet */
  function end(p, s, now, api) {
    const c = cur(s); if (!c || !c.start) return null; const t = now == null ? Date.now() : now;
    const r = { cid: c.cid, t, ms: Math.max(0, t - c.start), p: p >= 100 ? 100 : 0, h: Math.min(WT.hMax, c.h || 0), f: c.tries || 0 };
    if (api && api.m != null) r.m = api.m; else if (c.mz) r.m = c.mz;
    if (api && api.mp != null) r.mp = api.mp; else if (c.mp) r.mp = c.mp;
    jset(s, KEYS.cur, Object.assign({}, c, { done: 1, ms: r.ms, p: r.p })); return r;
  }
  function cancel(s) { const c = cur(s); if (c) jset(s, KEYS.cur, Object.assign({}, c, { done: 1, cancel: 1 })); }

  const Tausch = {
    WT, KEYS, APPSALT, AUS, STATUS, registerAdapter, adapters,
    core: { newCid, beleg, veil, unveil, normPub, normHid, normErg, makeCard, parseCards, peek, verifyCard, makeErg, parseErgs, verifyErg, verifyErgs, flags, pts, guete, erstellerWert, bestenliste, median },
    store: { get, save, addOwn, addInbox, setStatus, addRueck, addErg, isOwn, kuerzel, cur, active, begin, mess, tipp, wrong, end, cancel },
    active: () => { try { return active(null); } catch (e) { return false; } },
    mess: (key, mp) => { try { return mess(key, mp, null); } catch (e) { return null; } },
    tipp: () => { try { return tipp(null); } catch (e) { return null; } }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Tausch;
  root.Tausch = Tausch;
})(typeof window !== 'undefined' ? window : globalThis);
