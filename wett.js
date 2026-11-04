/* wett.js - Wettbewerbs-Modus, Kern (Paket W1, Spec quelle/SPEC-TAUSCH-WETTBEWERB.md 2.3, 2.4, 3.1, 3.3-3.5, 4.1, 4.4).
   Reine Funktionen ohne DOM, in Node UND im Browser ladbar (nach duell.js). Gerechnet wird IMMER mit Duell.core.score, keine zweite Wertung.
   Inhalt: Wertungstabelle WW, Ausschreibung TFW1.<json>.<sig>, Ergebnis TFE1.<json>.<sig> Variante q:'w', Rangliste TFR1.<json>.<sig>,
   Runden-Ableitung r_i = 'K' + KW(von) + '-' + hex4(hash(wid + ':' + i)), Gesamtwertung G, Klassenwert (Median), Flags, Rangliste, CSV-Zeilen,
   Speicher lm4.wett / lm4.wettrang (Wett.store).
   NICHT enthalten: Oberflaeche (wettui.js = W3, Ausbilder-Uebersicht = W4), Transport (codebus.js), Duell-Erweiterung (W2).
   Ehrlich (4.4): MANIPULATIONSARM, nicht manipulationssicher. Schluessel ist die wid (steht in TFW1) oder ein Ausbilder-Schluessel, den das
   Geraet kennen muss, um zu signieren. Codes tragen nur lm4.kuerzel (Anzeigename), NIE lm4.name. Ranglisten sind Spiel, keine Bewertung.

   Praefixe: TFW1 und TFR1 sind frei. TFE1 teilt sich das Praefix mit der Tauschboerse (tausch.js, q:'f'); dieser Kern liest NUR q:'w'
   und ueberspringt q:'f' ohne Fehler. Belegt sonst: TFL, TFA, TFD, TFB, TFH, TFV, TFK-, TFF1 (Tausch).

   Erwartung an duell.js (Paket W2, hier nur gelesen):
   - Duell.core: score, flags, sign (async, 'u' ohne WebCrypto), hash, b64, unb64, KRE, kw, parseRound, roundBase; Duell.W.prFaktor; Duell.store.history.
   - Die UI startet jede Aufgabe i mit Duell.store.start(Wett.core.runde(aus, i), AUFGABEN-Zeile von aus.a[i], aus.st, ..., { w: aus.wid, wi: i }).
     Der Rundencode r_i ist bereits ein gueltiger Duell-Rundencode (K<KW>-<4 Hex>), Seed/Treffpunkt also fuer alle gleich.
   - lm4.duell.hist[]-Eintraege einer Wettbewerbsrunde: { r, a, lab, st, t, ms, pct, h, f, m?, pr, pts } wie bisher, ZUSAETZLICH
     w (wid, 6 Hex), wi (Index 0..5), wd (1 = Wertungsdurchgang = erste beendete Runde dieses r, sonst 0) und, falls bekannt, mp
     (Messpunkte der Aufgabe, damit der Mess-Abzug der Arbeitsweise beim Leser gleich gerechnet wird). Aufgeben (giveUp) ist eine beendete Runde.
   - Ohne W2 (Eintraege ohne w/wi/wd) funktioniert wett.js trotzdem: Zuordnung ueber r + a, Wertungsdurchgang = erster Eintrag im Zeitfenster.
   - Duell.onFinish verzweigt bei rec.w auf Wett.ui (W3); duell.js braucht dafuer von wett.js nichts ausser Wett.core.runde.

   Annahmen (offene Spec-Stellen, konservativ entschieden):
   A1 von/bis sind Kalendertage 'YYYY-MM-DD' (nicht ms). Grund: KW(von) und damit r_i muessen auf jedem Geraet identisch sein, auch in
      anderer Zeitzone; KW wird zeitzonenfrei (UTC-Kalender) aus dem Datum gerechnet. Das Zeitfenster gilt von 00:00 (von) bis 23:59:59 (bis)
      Ortszeit des pruefenden Geraets, Toleranz WW.tolMs. Laenger als WW.fensterTage wird auf von + fensterTage gekuerzt; bis < von = ungueltig.
   A2 hex4 = untere 16 Bit von Duell.core.hash, 4 Hex gross. Bei i = 0..5 koennen zwei Runden derselben Ausschreibung nicht kollidieren
      (FNV: gleicher Praefix, letztes Zeichen verschieden, Multiplikation mit ungerader Primzahl ist mod 2^16 umkehrbar). Die Ausweichregel
      hash(wid + ':' + i + '#' + z) bleibt nur als Absicherung im Code; sie greift bei 3-6 Aufgaben nie, die Formel aus 3.3 gilt also exakt.
   A3 TFE1-w: res-Tupel [i,p,ms,h,f,m|null,pr,wd] wie Spec, optional 9. Feld mp (Messpunkte, nur wenn > 0), sonst mp = null (kein Mess-Abzug).
      Je Aufgabe hoechstens ein Eintrag: der erste mit wd:1, sonst der erste mit wd:0 (nur Info, zaehlt 0). Unbekannte i (>= Anzahl Aufgaben) fallen weg.
   A4 Signatur: TFW1 und TFR1 immer mit wid (Tippfehler-Schutz, Azubi kann pruefen). TFE1 mit Ausbilder-Schluessel, falls auf dem Geraet
      hinterlegt, sonst mit wid. Pruefung mit Ausbilder-Schluessel faellt auf wid zurueck und setzt dann das Info-Flag 'ohne_schluessel'.
      'u' (kein WebCrypto, file://) = Flag 'unsigniert', wird gewertet (Sicherheit ist mit wid ohnehin nur manipulationsarm).
   A5 Mehrfachabgabe desselben k: gewertet wird die spaetere Abgabe (Abgabe "jederzeit bis bis", spaetere enthaelt mehr Aufgaben).
      'doppelt' wird nur gesetzt, wenn sich zwei Abgaben in einer gemeinsamen Aufgabe WIDERSPRECHEN (Wertungsdurchgang neu gespielt).
      Gleicher Code zweimal = einmal. Gewaehlt wird die spaeteste nicht ausgeschlossene Abgabe.
   A6 Ausschluss aus Rangliste und Klassenwert nur bei WW.ausschluss (sig_falsch, ausserhalb, fremd, gesperrt). Alle anderen Flags
      (doppelt, zu_schnell, geraten, tipps, zukunft, unsigniert, ohne_schluessel) werden gezeigt, der Ausbilder entscheidet (Sperren, Nachstellen).
   A7 Klassen-Kennung: 1-12 Zeichen [A-Za-z0-9_-] mit mindestens einer Ziffer (z. B. E25a), sonst ''. Grobe Huerde gegen Personennamen.
      TFE1.kl leer = kl der Ausschreibung. Klassenwert nur fuer nicht leere kl; unter WW.medianMin Teilnehmenden Median = null (nur Anzahl).
   A8 Median bei gerader Anzahl = gerundetes Mittel der beiden mittleren Werte. L_i = round(pts * prFaktor) bei pr:1 (wie Duell.effPts),
      G = round(Summe L_i / Anzahl Aufgaben). Gleichstand: kleinere Gesamtzeit (Summe ms gewerteter Aufgaben), dann weniger Tipps;
      bleibt alles gleich, teilen sich beide den Platz (Reihenfolge dann nach k).
   A9 Aufgaben-Ids werden nicht gegen AUFGABEN gefiltert (sonst verschoebe eine neue Id auf alter App alle Indizes); doppelte Ids fallen weg.
      Wett.core.unbekannt(aus, AUFGABEN) meldet fremde Ids fuer die UI.
   A10 TFR1.sperr = Karten-Nr. (6 Hex) der Tauschboerse, hoechstens WW.sperrMax; das Sperren einzelner k im Wettbewerb ist opt.sperr in
      rangliste() (Flag 'gesperrt') und wird nicht veroeffentlicht. */
(function (root) {
  'use strict';

  /* ---------- Wertungstabelle (alle Zahlen hier, nirgends sonst) ---------- */
  const WW = {
    prFaktor: 0.5,             /* bekannte Aufgabe (pr:1) zaehlt halb, = Duell.W.prFaktor */
    aMin: 3, aMax: 6,          /* Aufgaben je Ausschreibung */
    nameMax: 40, klMax: 12, noteMax: 80,
    fensterTage: 28,           /* hoechstens 4 Wochen von..bis */
    tolMs: 10 * 60000,         /* Toleranz Zeitfenster (Uhr des Geraets) */
    top: 10,                   /* TFR1: Top 10 */
    medianMin: 3,              /* Klassenwert erst ab 3 Teilnehmenden */
    klassenMax: 20, sperrMax: 50,
    ausMax: 10, abgMax: 10,    /* lm4.wett: 10 Ausschreibungen, 10 Abgaben */
    parseMax: 2000, textMax: 1200000,   /* Sammeln: bis 2000 Codes je Text */
    msMax: 3 * 3600 * 1000, fMax: 50, mMax: 200, mpMax: 99,
    qrMax: 600,                /* Ergebnis mit 6 Aufgaben passt in einen QR */
    ausschluss: ['sig_falsch', 'ausserhalb', 'fremd', 'gesperrt']
  };
  const KEYS = { wett: 'lm4.wett', rang: 'lm4.wettrang', hist: 'lm4.duell', kuerzel: 'lm4.kuerzel', jahrgang: 'lm4.jahrgang' };

  /* Duell-Kern: im Browser window.Duell (duell.js vorher laden), in Node per require */
  let DU = null;
  const Dl = () => {
    if (DU) return DU;
    if (root.Duell && root.Duell.core) return (DU = root.Duell);
    try { if (typeof require === 'function') DU = require('./duell.js'); } catch (e) { DU = null; }
    return DU;
  };
  const C = () => { const d = Dl(); if (!d) throw new Error('duell.js fehlt'); return d.core; };

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const num = (x, d) => { const n = typeof x === 'number' ? x : (typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN); return isFinite(n) ? n : d; };
  const int = (x, a, b, d) => { const n = num(x, NaN); return isFinite(n) ? clamp(Math.round(n), a, b) : d; };
  const str = (x, re, d) => { const s = typeof x === 'string' ? x : ''; return re.test(s) ? s : d; };
  const p2 = n => String(n).padStart(2, '0');
  /* Freitext (Name, Hinweis): Steuerzeichen und HTML-Zeichen weg, Leerraum zusammen, Laenge begrenzt */
  const text = (x, max) => (typeof x === 'string' ? x : '').replace(/[\u0000-\u001f\u007f<>"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  const WRE = /^[0-9A-F]{6}$/, ARE = /^[A-Za-z0-9_-]{1,12}$/, KLRE = /^[A-Za-z0-9_-]{1,12}$/, APRE = /^v\d{1,3}\.\d{1,4}$/;
  const klasse = x => { const s = typeof x === 'string' ? x.trim() : ''; return KLRE.test(s) && /\d/.test(s) ? s : ''; };
  const kuerzel = x => { const s = typeof x === 'string' ? x.replace(/"/g, '').trim() : ''; return C().KRE.test(s) ? s : ''; };

  function newWid() {
    let out = '';
    try {
      const c = root.crypto || (typeof require === 'function' ? require('crypto').webcrypto : null);
      if (c && c.getRandomValues) { const a = c.getRandomValues(new Uint8Array(3)); for (let i = 0; i < 3; i++) out += p2(a[i].toString(16)); return out.toUpperCase(); }
    } catch (e) {}
    for (let i = 0; i < 6; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out.toUpperCase();
  }

  /* ---------- Kalendertage und KW (zeitzonenfrei, A1) ---------- */
  const DRE = /^(\d{4})-(\d{2})-(\d{2})$/;
  function ymd(x) {
    if (typeof x === 'string') {
      const m = DRE.exec(x.trim()); if (!m) return '';
      const y = +m[1], mo = +m[2], d = +m[3], u = new Date(Date.UTC(y, mo - 1, d));
      return (y >= 2020 && y <= 2100 && u.getUTCMonth() === mo - 1 && u.getUTCDate() === d) ? m[0] : '';
    }
    if (typeof x === 'number' && isFinite(x) && x > 1.5e12 && x < 4.1e12) { const d = new Date(x); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
    return '';
  }
  const dayNum = s => { const m = DRE.exec(s); return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5); };
  const fromDay = n => { const u = new Date(n * 864e5); return u.getUTCFullYear() + '-' + p2(u.getUTCMonth() + 1) + '-' + p2(u.getUTCDate()); };
  /* ISO-8601-KW eines Kalendertags; gleich auf jedem Geraet, gleich wie Duell.core.kw(lokale Mitternacht dieses Tags) */
  function kwOf(s) {
    const m = typeof s === 'string' ? DRE.exec(s) : null; if (!m) return 0;
    const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), day = u.getUTCDay() || 7; u.setUTCDate(u.getUTCDate() + 4 - day);
    return Math.ceil(((u - Date.UTC(u.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  }
  const localStart = s => { const m = DRE.exec(s); return new Date(+m[1], +m[2] - 1, +m[3]).getTime(); };
  /* Zeitfenster in Ortszeit: { a: von 00:00, b: bis 23:59:59.999 } */
  function fenster(aus) { return { a: localStart(aus.von), b: localStart(fromDay(dayNum(aus.bis) + 1)) - 1 }; }
  function imFenster(t, aus) { if (!aus || !aus.von) return false; const w = fenster(aus), x = num(t, NaN); return isFinite(x) && x >= w.a - WW.tolMs && x <= w.b + WW.tolMs; }
  /* Vorschlag fuer die Ausschreibung: aktuelle KW Mo-Fr (Ortszeit) */
  function vorschlag(now) {
    const d = new Date(now == null ? Date.now() : now), mo = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    const von = ymd(mo.getTime()), bis = fromDay(dayNum(von) + 4); return { von, bis, kw: kwOf(von) };
  }

  /* ---------- Runden-Ableitung (3.3, A2) ---------- */
  const hex4 = n => (n & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  function runden(aus) {
    if (!aus || !WRE.test(aus.wid || '') || !Array.isArray(aus.a)) return [];
    const pre = 'K' + p2(kwOf(aus.von)) + '-', out = [], seen = {}, H = C().hash;
    for (let i = 0; i < aus.a.length; i++) {
      let h = hex4(H(aus.wid + ':' + i)), z = 0;
      while (seen[h] && z < 50) { z++; h = hex4(H(aus.wid + ':' + i + '#' + z)); }
      seen[h] = 1; out.push(pre + h);
    }
    return out;
  }
  const runde = (aus, i) => runden(aus)[i] || null;
  const task = (aus, i, aufgaben) => { const id = aus && aus.a ? aus.a[i] : null; return id && Array.isArray(aufgaben) ? aufgaben.find(r => r && r[0] === id) || null : null; };
  const unbekannt = (aus, aufgaben) => (aus && aus.a ? aus.a : []).filter(id => !(Array.isArray(aufgaben) && aufgaben.some(r => r && r[0] === id)));

  /* ---------- Normalisierung ---------- */
  function normAus(o) {
    if (!o || typeof o !== 'object') return null;
    const wid = str(typeof o.wid === 'string' ? o.wid.toUpperCase() : '', WRE, ''), von = ymd(o.von); let bis = ymd(o.bis);
    if (!wid || !von || !bis || dayNum(bis) < dayNum(von)) return null;
    if (dayNum(bis) - dayNum(von) > WW.fensterTage) bis = fromDay(dayNum(von) + WW.fensterTage);
    const a = []; (Array.isArray(o.a) ? o.a : []).forEach(x => { if (typeof x === 'string' && ARE.test(x) && a.indexOf(x) < 0 && a.length < WW.aMax) a.push(x); });
    if (a.length < WW.aMin) return null;
    return { v: 1, wid, n: text(o.n, WW.nameMax) || 'Wettbewerb', kl: klasse(o.kl), j: str(o.j, /^\d{4}$/, ''), von, bis,
      st: int(o.st, 1, 3, 2), a, prof: 'std', app: str(o.app, APRE, '') };   /* prof: nur 'std' (E5, Duell-Gewichte) */
  }
  /* ein res-Eintrag (Array oder Objekt) -> { i, p, ms, h, f, m, pr, wd, mp, _hRaw } oder null */
  function normEntry(x, nA) {
    if (x == null || typeof x !== 'object') return null;
    const g = Array.isArray(x) ? { i: x[0], p: x[1], ms: x[2], h: x[3], f: x[4], m: x[5], pr: x[6], wd: x[7], mp: x[8] } : x;
    const i = num(g.i, NaN); if (!Number.isInteger(i) || i < 0 || i >= WW.aMax || (nA != null && i >= nA)) return null;
    const hRaw = int(g._hRaw != null ? g._hRaw : g.h, 0, 9999, 0);   /* Rohwert behalten: Flag 'tipps' bei mehr als 2 */
    return { i, p: int(g.p, 0, 100, 0), ms: int(g.ms, 0, WW.msMax, 0), h: clamp(hRaw, 0, 2), f: int(g.f, 0, WW.fMax, 0),
      m: g.m == null ? null : int(g.m, 0, WW.mMax, null), pr: g.pr ? 1 : 0, wd: g.wd ? 1 : 0, mp: g.mp == null ? null : int(g.mp, 1, WW.mpMax, null), _hRaw: hRaw };
  }
  /* je Aufgabe ein Eintrag: erster wd:1, sonst erster wd:0 (A3) */
  function normRes(list, nA) {
    const by = Object.create(null);
    (Array.isArray(list) ? list : []).slice(0, 50).forEach(x => { const e = normEntry(x, nA); if (!e) return; const o = by[e.i]; if (!o || (!o.wd && e.wd)) by[e.i] = e; });
    return Object.keys(by).map(Number).sort((a, b) => a - b).map(i => by[i]);
  }
  function normErg(o) {
    if (!o || typeof o !== 'object' || o.q !== 'w') return null;
    const wid = str(typeof o.wid === 'string' ? o.wid.toUpperCase() : '', WRE, ''), k = str(o.k, C().KRE, '');
    if (!wid || !k) return null;
    return { v: 1, q: 'w', wid, kl: klasse(o.kl), k, j: str(o.j, /^\d{4}$/, ''), t: int(o.t, 0, 4e12, 0), res: normRes(o.res, null), app: str(o.app, APRE, '') };
  }
  const tuple = e => { const a = [e.i, e.p, e.ms, e.h, e.f, e.m == null ? null : e.m, e.pr, e.wd]; if (e.mp > 0) a.push(e.mp); return a; };
  function normRang(o) {
    if (!o || typeof o !== 'object') return null;
    const wid = str(typeof o.wid === 'string' ? o.wid.toUpperCase() : '', WRE, ''); if (!wid || !Array.isArray(o.rows)) return null;
    const KRE = C().KRE;
    const rows = o.rows.filter(r => Array.isArray(r) && KRE.test(r[0] || '')).slice(0, WW.top).map(r => [r[0], int(r[1], 0, 100, 0), int(r[2], 0, WW.aMax, 0)]);
    const klassen = (Array.isArray(o.klassen) ? o.klassen : []).filter(r => Array.isArray(r) && klasse(r[0])).slice(0, WW.klassenMax)
      .map(r => [klasse(r[0]), r[1] == null ? null : int(r[1], 0, 100, null), int(r[2], 0, 999, 0)]);
    const sperr = []; (Array.isArray(o.sperr) ? o.sperr : []).forEach(c => { const s = typeof c === 'string' ? c.toUpperCase() : ''; if (WRE.test(s) && sperr.indexOf(s) < 0 && sperr.length < WW.sperrMax) sperr.push(s); });
    return { v: 1, wid, n: text(o.n, WW.nameMax), kl: klasse(o.kl), t: int(o.t, 0, 4e12, 0), rows, klassen, note: text(o.note, WW.noteMax), sperr };
  }

  /* ---------- Codec (gemeinsam) ---------- */
  const reOf = p => new RegExp(p + '\\.[A-Za-z0-9_-]+\\.(?:[0-9a-f]{12}|u)(?![A-Za-z0-9_-])', 'g');
  const RE = { W: reOf('TFW1'), E: reOf('TFE1'), R: reOf('TFR1') };
  /* scan: findet alle Codes eines Praefixes im Text, ohne Ausnahme. norm(json) -> Datensatz oder null */
  function scan(txt, re, norm, max) {
    const out = [], seen = {}; let s;
    try { s = String(txt == null ? '' : txt); } catch (e) { return out; }
    if (s.length > WW.textMax) s = s.slice(0, WW.textMax);
    let list; try { re.lastIndex = 0; list = s.match(re) || []; } catch (e) { return out; }
    list.slice(0, max || WW.parseMax).forEach(c => {
      if (seen[c]) return; seen[c] = 1;   /* gleicher Code zweimal = einmal */
      try {
        const i = c.indexOf('.'), j = c.lastIndexOf('.'), body = c.slice(i + 1, j), sig = c.slice(j + 1);
        const rec = norm(JSON.parse(C().unb64(body))); if (rec) out.push({ rec, body, sig, code: c });
      } catch (e) {}
    });
    return out;
  }
  async function sigCheck(body, sig, keys) {
    if (sig === 'u') return { sig: 'unsigniert', key: null };
    for (let n = 0; n < keys.length; n++) {
      if (keys[n] == null || keys[n] === '') continue;
      const want = await C().sign(keys[n], body);
      if (want === 'u') return { sig: 'unsigniert', key: null };
      if (want === sig) return { sig: 'ok', key: n };
    }
    return { sig: 'falsch', key: null };
  }

  /* ---------- TFW1 Ausschreibung ---------- */
  /* o: { n, kl, j, von, bis, st, a, app, wid? }; fehlt wid, wird eine neue gezogen. Liefert Code oder null. */
  async function encodeAus(o) {
    if (!o || typeof o !== 'object') return null;
    const n = normAus(Object.assign({ app: root.LAB_VERSION || '' }, o, { wid: o.wid || newWid() })); if (!n) return null;
    const body = C().b64(JSON.stringify(n));
    return 'TFW1.' + body + '.' + await C().sign(n.wid, body);
  }
  const parseAus = txt => scan(txt, RE.W, normAus, 50).map(p => ({ aus: p.rec, body: p.body, sig: p.sig, code: p.code }));
  /* verifyAus -> { ok, sig:'ok'|'falsch'|'unsigniert', aus, code } oder null */
  async function verifyAus(txt) {
    try { const p = parseAus(txt)[0]; if (!p) return null; const s = await sigCheck(p.body, p.sig, [p.aus.wid]); return { ok: s.sig !== 'falsch', sig: s.sig, aus: p.aus, code: p.code }; } catch (e) { return null; }
  }

  /* ---------- TFE1 Ergebnis (q:'w') ---------- */
  /* rec: { wid, kl, k, j, t, res:[Tupel oder {i,p,ms,h,f,m,pr,wd,mp}], app }; key = Ausbilder-Schluessel (sonst wid). pts steht NIE im Code. */
  async function encodeErg(rec, key) {
    if (!rec || typeof rec !== 'object') return null;
    const n = normErg(Object.assign({ app: root.LAB_VERSION || '' }, rec, { q: 'w' })); if (!n) return null;
    const j = { v: 1, q: 'w', wid: n.wid, kl: n.kl, k: n.k, j: n.j, t: n.t, res: n.res.map(tuple), app: n.app };
    const body = C().b64(JSON.stringify(j));
    return 'TFE1.' + body + '.' + await C().sign(key == null || key === '' ? n.wid : key, body);
  }
  /* parseErg: nur q:'w'; Tausch-Ergebnisse (q:'f') werden still uebersprungen */
  const parseErg = txt => scan(txt, RE.E, normErg).map(p => ({ erg: p.rec, body: p.body, sig: p.sig, code: p.code }));
  const isWett = c => { try { return parseErg(c).length > 0; } catch (e) { return false; } };

  /* ---------- Wertung (4.1) ---------- */
  /* Punkte einer Aufgabe ueber Duell.core.score; pr:1 zaehlt halb (gerundet wie Duell.effPts) */
  function punkte(e, st) {
    const pts = C().score({ st, pct: e.p, ms: e.ms, h: e.h, f: e.f, m: e.m == null ? null : e.m, mp: e.mp == null ? null : e.mp }).pts;
    return { pts, L: e.pr ? Math.round(pts * WW.prFaktor) : pts };
  }
  /* Duell-Flags je Eintrag (geraten, zu_schnell, tipps); punkte/fremde_kw/zukunft entfallen hier bewusst */
  function eFlags(e, st, pts) {
    try { return C().flags({ st, p: e.p, ms: e.ms, h: e.h, f: e.f, m: e.m == null ? undefined : e.m, pts, _hRaw: e._hRaw, t: 0 }, { now: 1, mp: e.mp }).filter(f => f !== 'punkte' && f !== 'zukunft' && f !== 'fremde_kw'); } catch (x) { return []; }
  }
  /* wertung(aus, erg) -> { G, L:[je Aufgabe Zahl oder null = nicht gespielt], n (gewertete Aufgaben), ms, h, f, m, af:{i:[Flags]}, flags } */
  function wertung(aus, erg) {
    const N = aus && aus.a ? aus.a.length : 0, res = normRes(erg && erg.res, N), L = [], af = {}, fl = [];
    let sum = 0, n = 0, ms = 0, h = 0, f = 0, m = 0;
    for (let i = 0; i < N; i++) {
      const e = res.find(x => x.i === i && x.wd === 1);
      if (!e) { L.push(null); continue; }
      const p = punkte(e, aus.st); L.push(p.L); sum += p.L; n++; ms += e.ms; h += e.h; f += e.f; m += e.m || 0;
      const x = eFlags(e, aus.st, p.pts); if (x.length) { af[i] = x; x.forEach(y => { if (fl.indexOf(y) < 0) fl.push(y); }); }
    }
    return { G: N ? Math.round(sum / N) : 0, L, n, ms, h, f, m, af, flags: fl };
  }
  function median(arr) {
    const a = (Array.isArray(arr) ? arr : []).map(x => num(x, NaN)).filter(isFinite).sort((x, y) => x - y), n = a.length;
    if (!n) return null; return n % 2 ? a[(n - 1) / 2] : Math.round((a[n / 2 - 1] + a[n / 2]) / 2);
  }
  /* Klassenwerte: [[kl, Median|null, Anzahl]], Median erst ab WW.medianMin */
  function klassenwerte(rows) {
    const by = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(r => { if (r && r.gewertet && r.kl) (by[r.kl] = by[r.kl] || []).push(r.G); });
    return Object.keys(by).sort().slice(0, WW.klassenMax).map(kl => [kl, by[kl].length >= WW.medianMin ? median(by[kl]) : null, by[kl].length]);
  }
  /* Gleichstand: G hoeher, dann kleinere Gesamtzeit, dann weniger Tipps. Negativ = a besser. */
  const cmpRow = (a, b) => (b.G - a.G) || (a.ms - b.ms) || (a.h - b.h);

  /* ---------- Pruefen und Rangliste (Ausbilder) ---------- */
  /* pruefen(text, aus, opt) -> [{ code, erg, sig, flags, w }]. opt: { key (Ausbilder-Schluessel), now }. Wirft nie. */
  async function pruefen(txt, aus, opt) {
    opt = opt || {}; const out = []; if (!aus || !aus.wid) return out;
    const now = opt.now == null ? Date.now() : opt.now;
    let list = []; try { list = parseErg(txt); } catch (e) { list = []; }
    for (let n = 0; n < list.length; n++) {
      const p = list[n];
      try {
        const erg = Object.assign({}, p.erg, { kl: p.erg.kl || aus.kl }), fl = [];
        if (erg.wid !== aus.wid) fl.push('fremd');
        const keys = opt.key ? [opt.key, aus.wid] : [aus.wid], s = await sigCheck(p.body, p.sig, keys);
        if (s.sig === 'falsch') fl.push('sig_falsch'); else if (s.sig === 'unsigniert') fl.push('unsigniert'); else if (opt.key && s.key === 1) fl.push('ohne_schluessel');
        if (!imFenster(erg.t, aus)) fl.push('ausserhalb');
        if (erg.t > now + 5 * 60000) fl.push('zukunft');
        const w = wertung(aus, erg); w.flags.forEach(f => { if (fl.indexOf(f) < 0) fl.push(f); });
        out.push({ code: p.code, erg, sig: s.sig, flags: fl, w });
      } catch (e) {}
    }
    return out;
  }
  const ausgeschlossen = fl => fl.some(f => WW.ausschluss.indexOf(f) >= 0);
  /* rangliste(items, aus, opt) -> { rows:[{ platz, k, kl, G, n, ms, h, f, m, L, flags, af, gewertet, code }], ersetzt:[item], klassen }
     opt: { sperr:[k] } -> Flag 'gesperrt'. Gewertete zuerst (mit Platz), danach ausgeschlossene (platz null). */
  function rangliste(items, aus, opt) {
    opt = opt || {}; const sperr = Array.isArray(opt.sperr) ? opt.sperr : [], by = Object.create(null), ersetzt = [];
    (Array.isArray(items) ? items : []).forEach((it, idx) => {
      if (!it || !it.erg || !it.w) return;
      const x = Object.assign({}, it, { flags: (it.flags || []).slice(), _n: idx });
      if (sperr.indexOf(x.erg.k) >= 0 && x.flags.indexOf('gesperrt') < 0) x.flags.push('gesperrt');
      (by[x.erg.k] = by[x.erg.k] || []).push(x);
    });
    const rows = Object.keys(by).map(k => {
      const g = by[k].sort((a, b) => (a.erg.t - b.erg.t) || (a._n - b._n));
      const ok = g.filter(x => !ausgeschlossen(x.flags)), pick = (ok.length ? ok : g)[(ok.length ? ok : g).length - 1];
      if (g.length > 1) {
        const mine = {}; normRes(pick.erg.res).forEach(e => { if (e.wd) mine[e.i] = JSON.stringify(tuple(e)); });
        let konflikt = false;
        g.forEach(x => { if (x === pick) return; ersetzt.push(x); normRes(x.erg.res).forEach(e => { if (e.wd && mine[e.i] && mine[e.i] !== JSON.stringify(tuple(e))) konflikt = true; }); });
        if (konflikt && pick.flags.indexOf('doppelt') < 0) pick.flags.push('doppelt');
      }
      const w = pick.w;
      return { platz: null, k, kl: pick.erg.kl, G: w.G, n: w.n, ms: w.ms, h: w.h, f: w.f, m: w.m, L: w.L, flags: pick.flags, af: w.af, gewertet: !ausgeschlossen(pick.flags), code: pick.code };
    });
    const a = rows.filter(r => r.gewertet).sort((x, y) => cmpRow(x, y) || (x.k < y.k ? -1 : x.k > y.k ? 1 : 0));
    a.forEach((r, i) => { r.platz = i && !cmpRow(a[i - 1], r) ? a[i - 1].platz : i + 1; });
    const b = rows.filter(r => !r.gewertet).sort((x, y) => (x.k < y.k ? -1 : 1));
    const all = a.concat(b);
    return { rows: all, ersetzt, klassen: klassenwerte(all), teilnehmende: a.length };
  }
  /* Bequem: Text mit vielen TFE1 -> Rangliste */
  async function sammeln(txt, aus, opt) { return rangliste(await pruefen(txt, aus, opt), aus, opt); }

  /* ---------- TFR1 Rangliste ---------- */
  /* o: { aus, rang (aus rangliste), t, note, sperr:[cid] } oder schon fertig { wid, n, kl, t, rows, klassen, note, sperr } */
  async function encodeRang(o) {
    if (!o || typeof o !== 'object') return null;
    let j = o;
    if (o.aus && o.rang) {
      j = { wid: o.aus.wid, n: o.aus.n, kl: o.aus.kl, t: o.t == null ? Date.now() : o.t,
        rows: (o.rang.rows || []).filter(r => r.gewertet).slice(0, WW.top).map(r => [r.k, r.G, r.n]), klassen: o.rang.klassen || [],
        note: o.note == null ? 'Mittel je Aufgabe, erster Versuch zaehlt. Spiel, keine Bewertung.' : o.note, sperr: o.sperr || [] };
    }
    const n = normRang(j); if (!n) return null;
    const body = C().b64(JSON.stringify(n));
    return 'TFR1.' + body + '.' + await C().sign(n.wid, body);
  }
  /* Azubi-App prueft nur die Form (3.5) */
  const parseRang = txt => scan(txt, RE.R, normRang, 50).map(p => ({ rang: p.rec, body: p.body, sig: p.sig, code: p.code }));
  async function verifyRang(txt) { try { const p = parseRang(txt)[0]; if (!p) return null; const s = await sigCheck(p.body, p.sig, [p.rang.wid]); return { ok: s.sig !== 'falsch', sig: s.sig, rang: p.rang, code: p.code }; } catch (e) { return null; } }
  /* Platz des eigenen Anzeigenamens in einer TFR1 (1-basiert) oder 0; fuer Hervorhebung und Abzeichen wettpodium (Platz <= 3) */
  const platzVon = (rang, k) => { if (!rang || !Array.isArray(rang.rows) || !k) return 0; const i = rang.rows.findIndex(r => r[0] === k); if (i < 0) return 0; let p = 1; for (let n = 0; n < i; n++) if (rang.rows[n][1] > rang.rows[i][1]) p++; return p; };

  /* ---------- CSV-Zeilen (Ausbilder-Export, ';' fuer Excel de) ---------- */
  const cell = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function csvZeilen(rang, aus) {
    const N = aus && aus.a ? aus.a.length : 0, head = ['Platz', 'Anzeigename', 'Klasse', 'G', 'Aufgaben gewertet', 'Gesamtzeit s', 'Tipps', 'Fehlversuche', 'Messungen'];
    for (let i = 0; i < N; i++) head.push('A' + (i + 1) + ' ' + aus.a[i]);
    head.push('Flags', 'gewertet');
    const out = [head.map(cell).join(';')];
    ((rang && rang.rows) || []).forEach(r => {
      const z = [r.platz == null ? '' : r.platz, r.k, r.kl, r.G, r.n, Math.round(r.ms / 1000), r.h, r.f, r.m];
      for (let i = 0; i < N; i++) z.push(r.L && r.L[i] != null ? r.L[i] : '');
      z.push((r.flags || []).join(' '), r.gewertet ? 'ja' : 'nein'); out.push(z.map(cell).join(';'));
    });
    return out;
  }
  const csv = (rang, aus) => csvZeilen(rang, aus).join('\r\n');

  /* ---------- Aus der Duell-Historie: Fortschritt und eigenes Ergebnis (Azubi) ---------- */
  /* je Aufgabe der Wertungsdurchgang aus lm4.duell.hist (siehe Erwartung an duell.js oben) */
  function eintraege(aus, hist) {
    const rs = runden(aus), H = (Array.isArray(hist) ? hist : []).filter(e => e && typeof e === 'object'), out = [];
    rs.forEach((r, i) => {
      const m = H.filter(e => String(e.r || '').toUpperCase() === r && e.a === aus.a[i] && (e.w == null || String(e.w).toUpperCase() === aus.wid) && (e.wi == null || +e.wi === i))
        .sort((x, y) => num(x.t, 0) - num(y.t, 0));
      if (!m.length) return;
      let pick = null, wd = 1;
      if (m.some(e => e.wd != null)) { pick = m.find(e => +e.wd === 1); if (!pick) { pick = m[0]; wd = 0; } }   /* W2 markiert selbst */
      else { pick = m.find(e => imFenster(e.t, aus)); if (!pick) { pick = m[0]; wd = 0; } }                       /* ohne W2: erster im Fenster */
      const e = normEntry({ i, p: pick.pct != null ? pick.pct : pick.p, ms: pick.ms, h: pick.h, f: pick.f, m: pick.m, pr: pick.pr, wd, mp: pick.mp }, rs.length);
      if (e) { e.gespielt = m.length; out.push(e); }
    });
    return out;
  }
  /* Fortschritt "2 von 5": { gewertet, gesamt, je:[{ i, r, a, wd, gespielt, L|null }] } */
  function fortschritt(aus, hist) {
    const rs = runden(aus), es = eintraege(aus, hist);
    const je = rs.map((r, i) => { const e = es.find(x => x.i === i); return { i, r, a: aus.a[i], wd: e ? e.wd : 0, gespielt: e ? e.gespielt : 0, L: e && e.wd ? punkte(e, aus.st).L : null }; });
    return { gewertet: je.filter(x => x.wd).length, gesamt: rs.length, je };
  }
  /* Ergebnis-Datensatz fuer encodeErg. opt: { k, j, kl, now, app }. k MUSS lm4.kuerzel sein (nie lm4.name); ungueltig -> null */
  function ergebnis(aus, hist, opt) {
    opt = opt || {}; if (!aus || !aus.wid) return null;
    const k = kuerzel(opt.k); if (!k) return null;
    return { v: 1, q: 'w', wid: aus.wid, kl: klasse(opt.kl) || aus.kl, k, j: str(opt.j, /^\d{4}$/, '') || aus.j, t: opt.now == null ? Date.now() : opt.now,
      res: eintraege(aus, hist).map(e => ({ i: e.i, p: e.p, ms: e.ms, h: e.h, f: e.f, m: e.m, pr: e.pr, wd: e.wd, mp: e.mp })), app: str(opt.app == null ? root.LAB_VERSION : opt.app, APRE, '') };
  }

  /* ---------- Speicher lm4.wett / lm4.wettrang (austauschbar fuer Tests, Node ohne localStorage lauffaehig) ---------- */
  const ls = s => { if (s) return s; try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
  const jget = (s, k, d) => { try { const st = ls(s); if (!st) return d; const v = JSON.parse(st.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const jset = (s, k, v) => { try { const st = ls(s); if (!st) return false; st.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const sget = (s, k) => { try { const st = ls(s); return st ? String(st.getItem(k) || '') : ''; } catch (e) { return ''; } };
  /* load: { v:1, aus:{ wid:{ code, parsed } }, abg:{ wid:{ t, code } } }, defekte Eintraege fallen weg */
  function load(s) {
    const o = jget(s, KEYS.wett, null), out = { v: 1, aus: {}, abg: {} };
    if (!o || typeof o !== 'object') return out;
    try {
      Object.keys(o.aus && typeof o.aus === 'object' ? o.aus : {}).forEach(w => {
        const x = o.aus[w]; if (!x || typeof x.code !== 'string') return;
        const p = normAus(x.parsed) || ((parseAus(x.code)[0] || {}).aus); if (p && p.wid === w) out.aus[w] = { code: x.code, parsed: p };
      });
      Object.keys(o.abg && typeof o.abg === 'object' ? o.abg : {}).forEach(w => {
        const x = o.abg[w]; if (WRE.test(w) && x && typeof x.code === 'string' && /^TFE1\./.test(x.code)) out.abg[w] = { t: int(x.t, 0, 4e12, 0), code: x.code.slice(0, 2000) };
      });
    } catch (e) {}
    return out;
  }
  function trim(o) {
    const w = Object.keys(o.aus).sort((a, b) => (dayNum(o.aus[b].parsed.bis) - dayNum(o.aus[a].parsed.bis)) || (a < b ? -1 : 1));
    w.slice(WW.ausMax).forEach(x => { delete o.aus[x]; });
    const g = Object.keys(o.abg).sort((a, b) => o.abg[b].t - o.abg[a].t);
    g.slice(WW.abgMax).forEach(x => { delete o.abg[x]; });
    return o;
  }
  /* Ausschreibung uebernehmen (nur Form gepruft; Signatur prueft die UI mit verifyAus). Liefert aus oder null. */
  function addAus(code, s) {
    try { const p = parseAus(code)[0]; if (!p) return null; const o = load(s); o.aus[p.aus.wid] = { code: p.code, parsed: p.aus }; trim(o); return jset(s, KEYS.wett, o) && o.aus[p.aus.wid] ? p.aus : null; } catch (e) { return null; }
  }
  /* Liste, neueste zuerst (nach von) */
  const ausList = s => { const o = load(s); return Object.keys(o.aus).map(w => o.aus[w].parsed).sort((a, b) => (dayNum(b.von) - dayNum(a.von)) || (a.wid < b.wid ? -1 : 1)); };
  const getAus = (wid, s) => { const o = load(s), x = o.aus[String(wid || '').toUpperCase()]; return x ? x.parsed : null; };
  function setAbgabe(wid, code, s, now) {
    try { const w = String(wid || '').toUpperCase(); if (!WRE.test(w) || typeof code !== 'string' || !/^TFE1\./.test(code)) return false; const o = load(s); o.abg[w] = { t: now == null ? Date.now() : now, code }; trim(o); return jset(s, KEYS.wett, o); } catch (e) { return false; }
  }
  const getAbgabe = (wid, s) => load(s).abg[String(wid || '').toUpperCase()] || null;
  /* zuletzt eingelesene TFR1: { t, code, parsed } */
  function setRang(code, s, now) { try { const p = parseRang(code)[0]; if (!p) return null; const o = { t: now == null ? Date.now() : now, code: p.code, parsed: p.rang }; return jset(s, KEYS.rang, o) ? o : null; } catch (e) { return null; } }
  function getRang(s) { const o = jget(s, KEYS.rang, null); if (!o || typeof o.code !== 'string') return null; const p = parseRang(o.code)[0]; return p ? { t: int(o.t, 0, 4e12, 0), code: p.code, parsed: p.rang } : null; }
  const hist = s => { try { const d = Dl(); if (d && d.store && d.store.history) return d.store.history(s); } catch (e) {} const h = jget(s, KEYS.hist, null); return h && Array.isArray(h.hist) ? h.hist : []; };
  const meinFortschritt = (wid, s) => { const a = getAus(wid, s); return a ? fortschritt(a, hist(s)) : null; };
  /* eigenes Ergebnis aus Speicher: liest lm4.kuerzel und lm4.jahrgang (NIE lm4.name). opt: { kl, now, app } */
  function meinErgebnis(wid, s, opt) {
    opt = opt || {}; const a = getAus(wid, s); if (!a) return null;
    return ergebnis(a, hist(s), { k: sget(s, KEYS.kuerzel), j: sget(s, KEYS.jahrgang).replace(/"/g, '').trim(), kl: opt.kl, now: opt.now, app: opt.app });
  }

  const Wett = {
    WW, KEYS,
    core: { newWid, ymd, kwOf, fenster, imFenster, vorschlag, hex4, runden, runde, task, unbekannt,
      normAus, normErg, normRang, normEntry, normRes, tuple, klasse, text,
      encodeAus, parseAus, verifyAus, encodeErg, parseErg, isWett, encodeRang, parseRang, verifyRang, platzVon,
      punkte, wertung, median, klassenwerte, cmpRow, pruefen, rangliste, sammeln, csvZeilen, csv, eintraege, fortschritt, ergebnis },
    store: { load, addAus, ausList, getAus, setAbgabe, getAbgabe, setRang, getRang, hist, meinFortschritt, meinErgebnis },
    ui: (root.Wett && root.Wett.ui) || null   /* W3 haengt die Oberflaeche hier ein */
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Wett;
  root.Wett = Wett;
})(typeof window !== 'undefined' ? window : globalThis);
