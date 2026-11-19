'use strict';
/* matduell.js - Rechen-Duell des Rechen-Labs, Kern: reine Funktionen ohne DOM, in Node UND im Browser ladbar (window.MatDuell bzw. module.exports).
   Idee (Wunsch des Ausbilders, 17.11.2026): Alle im Raum rechnen dieselben Aufgaben mit denselben Zahlen. Wer mehr richtig hat, gewinnt. Bei Gleichstand gewinnt die kürzere Zeit.
   Die Runde endet, wenn alle Aufgaben beantwortet sind oder die Zeit abgelaufen ist.

   Rundencode  R<KW>-<5 Hex>   (KW = Kalenderwoche, 3 Hex Zufall, 2 Hex Einstellung). Der Code ist der Seed: gleicher Code = gleiche Aufgaben und gleiche Zahlen auf jedem Gerät
                               (bei gleicher App-Version). Die Einstellung steckt im Code: Stufe 1..3, Anzahl 5/10/15, Zeit 5/10/15 Minuten (27 Fälle, Byte mod 27).
   Rubriken    R<KW>-<5 Hex><3 Hex>  (ab v62.182): Sind nur einzelne Rubriken gewählt, hängen 3 Hex-Zeichen an (Bitmaske über RUB, 1..510). Ohne Anhang = gemischt, also wie bisher.
   Ergebniscode R<KW>-<5 Hex>-<richtig>-<Sekunden>-<Prüfzeichen>[-<Kürzel>]. Das Prüfzeichen hängt auch an den Aufgaben der Runde. Passt es nicht, hat das andere Gerät
                               andere Aufgaben gehabt (andere App-Version) oder der Code ist vertippt.
   Ehrlich: Das Prüfzeichen schützt vor Tippfehlern, nicht vor Schummeln. Im Raum sieht ohnehin jeder, wer fertig ist.
   Stufe = Lehrjahr: Stufe 1 nimmt Aufgaben des 1. Lehrjahres bis Schwierigkeit 2, Stufe 2 alles bis zum 2. Lehrjahr, Stufe 3 alle Aufgaben.
   Das Lehrjahr je Aufgabe steht hier als feste Liste (gleich wie lehrjahr.js, geprüft in quelle/mat/test_matduell.js), damit die Auswahl nicht davon abhängt, was eine Seite gerade geladen hat. */
(function (root) {
  const ANZ = [5, 10, 15], MIN = [5, 10, 15];
  /* Rubriken in fester Reihenfolge (Bit 0 = Einheiten ...). Muss zu den Kategorien in matdata.js passen (geprüft in quelle/mat/test_matduell.js). Nur hinten anhängen, nie umsortieren. */
  const RUB = ['Einheiten', 'Dreisatz', 'Prozent', 'Bruchrechnung', 'Klammern', 'Umstellen', 'Geometrie', 'Messwerte', 'Prüfung Teil 1', 'Elektrotechnik', 'Elektronik vertieft'], VOLL = (1 << RUB.length) - 1;
  /* Auswahl (Liste von Namen oder Zahl) -> Maske; 0 = gemischt (nichts oder alles gewählt) */
  const maske = rub => { let m = 0; if (typeof rub === 'number') m = rub & VOLL; else (Array.isArray(rub) ? rub : []).forEach(n => { const i = RUB.indexOf(n); if (i >= 0) m |= 1 << i; }); return m === VOLL ? 0 : m; };
  const rubriken = m => RUB.filter((n, i) => m & (1 << i));
  /* Lehrjahr der Rechen-Lab-Aufgaben, die nicht ins 1. Lehrjahr gehören (muss zu lehrjahr.js passen) */
  const LJ = { mat32: 4, mat33: 2, mat34: 4, mat35: 4, mat43: 4, mat61: 2, mat62: 2, mat63: 2, mat64: 2, mat65: 2, mat66: 2, mat67: 2, mat68: 2, mat69: 2, mat70: 2, mat103: 2, mat104: 2, mat105: 2, mat106: 2, mat107: 2, mat108: 2, mat109: 2, mat110: 2, mat111: 2, mat112: 2, mat113: 2, mat114: 2, mat117: 2, mat118: 2, mat119: 2, mat120: 2, mat115: 3, mat116: 3, mat121: 3, mat122: 3, mat123: 3, mat124: 3, mat125: 4, mat126: 4, mat127: 4, mat128: 4, mat129: 4, mat130: 4, mat131: 4, mat132: 4, mat133: 4, mat134: 4, mat135: 4, mat136: 4, mat137: 4, mat138: 4, mat139: 4, mat140: 4, mat141: 4, mat142: 4, mat143: 4, mat144: 4 };
  const ljOf = id => LJ[id] || 1;

  const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = s => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  function kw(ts) {
    const d = new Date(ts == null ? Date.now() : ts), t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
    const w1 = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
  }

  /* ---------- Rundencode ---------- */
  const RRE = /R(\d{2})-([0-9A-F]{5})([0-9A-F]{3})?/;
  /* opt: { st 1..3, n 5|10|15, min 5|10|15, rub: [Rubriken] (leer = gemischt) }; rnd = Zufallsfunktion (Tests) */
  function neu(opt, ts, rnd) {
    opt = opt || {}; rnd = rnd || Math.random;
    const st = Math.min(3, Math.max(1, Math.round(+opt.st) || 1)), ni = Math.max(0, ANZ.indexOf(+opt.n)), ti = Math.max(0, MIN.indexOf(+opt.min));
    const cfg = (st - 1) * 9 + ni * 3 + ti, k = Math.floor(rnd() * Math.floor((255 - cfg) / 27 + 1)), b = cfg + 27 * k;
    let hex = ''; for (let i = 0; i < 3; i++) hex += Math.floor(rnd() * 16).toString(16);
    const mk = maske(opt.rub);
    return ('R' + String(kw(ts)).padStart(2, '0') + '-' + hex + b.toString(16).padStart(2, '0') + (mk ? mk.toString(16).padStart(3, '0') : '')).toUpperCase();
  }
  /* Code aus beliebigem Text lesen (getippt, aus QR, aus einem Ergebniscode): { code, st, n, min, maske, rub } oder null. rub = gewählte Rubriken, leer = gemischt */
  function lies(txt) {
    const m = RRE.exec(String(txt == null ? '' : txt).toUpperCase().replace(/\s+/g, '')); if (!m) return null;
    const cfg = parseInt(m[2].slice(3), 16) % 27, mk = m[3] ? parseInt(m[3], 16) : 0;
    if (m[3] && (mk < 1 || mk >= VOLL)) return null;
    return { code: m[0], maske: mk, rub: rubriken(mk), st: Math.floor(cfg / 9) + 1, n: ANZ[Math.floor(cfg / 3) % 3], min: MIN[cfg % 3] };
  }

  /* ---------- Aufgaben der Runde ---------- */
  /* tasks = MAT_DATA.tasks ([{ id, cat, level, title }]); Ergebnis: [{ id, seed }] in fester Reihenfolge (leicht zuerst). Gemischt: höchstens ein Drittel aus einer Kategorie.
     Mit Rubriken: nur Aufgaben daraus, gleichmäßig verteilt. Reichen die Aufgaben nicht, kommt eine Aufgabe noch einmal mit anderen Zahlen. */
  function auswahl(code, tasks) {
    const r = lies(code); if (!r) return [];
    const T = (Array.isArray(tasks) ? tasks : []).slice().sort((a, b) => +a.id.slice(3) - +b.id.slice(3));
    let pool = T.filter(t => r.st === 1 ? ljOf(t.id) === 1 && t.level <= 2 : r.st === 2 ? ljOf(t.id) <= 2 : true);
    if (r.maske) { const inR = t => r.rub.indexOf(t.cat) >= 0, p2 = pool.filter(inR); pool = p2.length ? p2 : T.filter(inR); if (!pool.length) return []; }
    else if (pool.length < r.n) pool = T;
    const R = seeded(hash(r.code)), mix = pool.map(t => [R(), t]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const max = Math.ceil(r.n / (r.maske ? Math.min(3, r.rub.length) : 3)), cnt = {}, out = [];
    mix.forEach(t => { if (out.length < r.n && (cnt[t.cat] || 0) < max) { cnt[t.cat] = (cnt[t.cat] || 0) + 1; out.push(t); } });
    mix.forEach(t => { if (out.length < r.n && out.indexOf(t) < 0) out.push(t); });
    for (let i = 0; out.length < r.n; i++) out.push(mix[i % mix.length]);
    out.sort((a, b) => (a.level - b.level) || (mix.indexOf(a) - mix.indexOf(b)));
    return out.map((t, i) => ({ id: t.id, seed: hash(r.code + ':' + i) }));
  }
  /* fertige Aufgaben: build = MAT_DATA.build */
  function runde(code, tasks, build) {
    const by = {}; (tasks || []).forEach(t => { by[t.id] = t; });
    return auswahl(code, tasks).map(a => build(by[a.id], a.seed));
  }
  /* Fingerabdruck der Runde: gleiche Aufgaben und gleiche Lösungen = gleicher Wert */
  const abdruck = ps => hash((ps || []).map(p => p.id + '=' + p.value).join('|')).toString(16);
  const richtig = (p, v) => typeof v === 'number' && isFinite(v) && Math.abs(v - p.value) <= p.tol + 1e-9;

  /* ---------- Ergebniscode ---------- */
  const kurz = k => String(k == null ? '' : k).toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const pz = (code, ok, sek, name, fp) => (hash([code, ok, sek, name, fp].join('|')) % 1296).toString(36).toUpperCase().padStart(2, '0');
  function ergebnis(code, ok, sek, name, fp) {
    const r = lies(code); if (!r) return ''; name = kurz(name); ok = Math.max(0, Math.min(r.n, Math.round(ok))); sek = Math.max(0, Math.min(r.min * 60, Math.round(sek)));
    return r.code + '-' + ok + '-' + sek + '-' + pz(r.code, ok, sek, name, fp) + (name ? '-' + name : '');
  }
  /* { ok:true, code, n, richtig, sek, name } oder { ok:false, why } ; fp = Fingerabdruck der eigenen Runde, runde = eigener Rundencode */
  function liesErgebnis(txt, fp, eigen) {
    const s = String(txt == null ? '' : txt).toUpperCase().replace(/\s+/g, ''), m = /(R\d{2}-[0-9A-F]{5}(?:[0-9A-F]{3})?)-(\d{1,2})-(\d{1,3})-([0-9A-Z]{2})(?:-([A-Z0-9]{1,12}))?/.exec(s);
    if (!m) return { ok: false, why: 'Das ist kein Ergebniscode. Er sieht so aus: R47-1A2B3-8-272-K7.' };
    const r = lies(m[1]), ok = +m[2], sek = +m[3], name = m[5] || '';
    if (!r) return { ok: false, why: 'Das ist kein Ergebniscode. Er sieht so aus: R47-1A2B3-8-272-K7.' };
    if (eigen && r.code !== (lies(eigen) || {}).code) return { ok: false, why: 'Dieser Ergebniscode gehört zu einer anderen Runde (' + r.code + ').' };
    if (ok > r.n || sek > r.min * 60) return { ok: false, why: 'Der Ergebniscode ist nicht plausibel. Bitte noch einmal eintippen.' };
    if (pz(r.code, ok, sek, name, fp) !== m[4]) return { ok: false, why: 'Das Prüfzeichen passt nicht. Entweder ist der Code vertippt oder das andere Gerät hat eine andere App-Version und damit andere Aufgaben.' };
    return { ok: true, code: r.code, n: r.n, richtig: ok, sek, name };
  }
  /* Reihenfolge: mehr richtig zuerst, dann kürzere Zeit. vergleich < 0: a ist besser. */
  const vergleich = (a, b) => (b.richtig - a.richtig) || (a.sek - b.sek);
  const zeit = sek => { sek = Math.max(0, Math.round(sek)); return Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0'); };

  const MatDuell = { ANZ, MIN, RUB, maske, rubriken, LJ, ljOf, kw, hash, neu, lies, auswahl, runde, abdruck, richtig, kurz, ergebnis, liesErgebnis, vergleich, zeit };
  if (typeof module !== 'undefined' && module.exports) module.exports = MatDuell;
  root.MatDuell = MatDuell;
})(typeof window !== 'undefined' ? window : globalThis);
