'use strict';
/* Tonfunk Lab: Lernkarten aus falsch beantworteten Prüfungsfragen.
   Wird eine Frage im Prüfungs-Lab (Probeprüfung, Training, Rechenserie) oder in der 10-Minuten-Einheit falsch beantwortet, entsteht daraus automatisch eine Lernkarte
   (Frage, richtige Antwort, kurze Erklärung) im Leitner-Fach 1. Dieselbe Frage legt keine zweite Karte an (sie rutscht bei erneutem Fehler zurück in Fach 1).
   Es gibt höchstens 200 solcher Karten, die ältesten fallen heraus. Kernmodul ohne Browserbezug (node-testbar).

   Speicher: lm4.pkarten = { "<kartenId>": { q: Frage, a: richtige Antwort, e: Erklärung (optional), g: Teil "t1" | "t2" (optional), t: ms Zeitpunkt (angelegt oder zuletzt erneut falsch), f: Fach 1..5, d: ms fällig ab } }
   Kartenid: "p-<Pool-Id>" für Aufgaben des Prüfungs-Pools, "b-<Hash des Fragetextes>" für Aufgaben ohne feste Id (Rechenserie, Banken).
   Der Leitner-Stand (f, d) liegt bewusst in der Karte selbst: Zahlen werden beim Zusammenführen von Lernständen (lernstand.js) mit dem höchsten Wert übernommen, ältere Stände ohne den
   Schlüssel und alte Sicherungen funktionieren unverändert. Der Schlüssel wird beim Laden dieser Datei in Lernstand.PROGRESS eingetragen, damit der Lernstand-Code die Karten mitnimmt
   (die Datei-Sicherung nimmt ohnehin alle lm4.*-Schlüssel mit). */
(function (root) {
  const KEY = 'lm4.pkarten', MAX = 200, DAY = 86400000, ABST = [0, 1, 3, 7, 14];
  const ID = /^[pb]-[A-Za-z0-9_.-]{1,60}$/;
  const TEIL = { Teil1: 't1', SysE: 't2', FuSa: 't2', WiSo: 't2' };
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => { const x = +v; return isFinite(x) ? x : 0; };
  const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '').slice(0, n);

  /* Zahl für die Anzeige: höchstens 4 gültige Stellen, Komma */
  function zahl(x) { return String(parseFloat((+x).toPrecision(4))).replace('.', ','); }
  function hash(s) { let h = 5381; s = String(s).toLowerCase().replace(/\s+/g, ' ').trim(); for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
  /* Id einer Frage: feste Pool-Id, sonst Hash des Fragetextes (Rechenaufgaben aus Generatoren haben je Zufallswert eine eigene Id) */
  function keyOf(q) { if (q && q.pool && q.id && /^[A-Za-z0-9_.-]{1,60}$/.test(String(q.id))) return 'p-' + q.id; return 'b-' + hash(q && q.q); }
  /* Antworttext der richtigen Lösung */
  function antwortText(q) {
    if (!q) return '';
    if (q.type === 'mc') return Array.isArray(q.opts) && q.opts[q.r] != null ? String(q.opts[q.r]) : '';
    if (q.type === 'num' && isFinite(+q.ans)) return zahl(q.ans) + (q.unit ? ' ' + q.unit : '');
    return '';
  }
  /* Karte aus einer Frage ({ id, q, type, opts, r, ans, unit, w, teil, pool }); null, wenn Frage oder Antwort fehlen */
  function fromFrage(q, now) {
    const t = str(q && q.q, 700), a = str(antwortText(q), 300); if (!t || !a) return null;
    const c = { q: t, a, t: num(now) || Date.now(), f: 1, d: num(now) || Date.now() }, e = str(q.w, 700), g = TEIL[q.teil]; if (e) c.e = e; if (g) c.g = g; return c;
  }
  /* gespeicherten Bestand säubern (ungültige Einträge fallen weg) */
  function norm(s) {
    const o = {}; if (!isObj(s)) return o;
    Object.keys(s).forEach(id => {
      const c = s[id]; if (!ID.test(id) || !isObj(c)) return;
      const q = str(c.q, 700), a = str(c.a, 300), t = num(c.t), f = Math.round(num(c.f)); if (!q || !a || t <= 0) return;
      const n = { q, a, t, f: f >= 1 && f <= 5 ? f : 1, d: num(c.d) > 0 ? num(c.d) : t }, e = str(c.e, 700); if (e) n.e = e; if (c.g === 't1' || c.g === 't2') n.g = c.g; o[id] = n;
    });
    return o;
  }
  /* auf höchstens max Karten kürzen, die ältesten (kleinstes t) fallen heraus */
  function trim(s, max) {
    max = max == null ? MAX : max; const ids = Object.keys(s); if (ids.length <= max) return s;
    const keep = ids.sort((a, b) => s[b].t - s[a].t || (a < b ? -1 : 1)).slice(0, max), o = {}; keep.forEach(k => { o[k] = s[k]; }); return o;
  }
  /* Fragen hinzufügen (reine Funktion). Rückgabe { store, neu, erneut }: neu = angelegte Karten, erneut = vorhandene Karte erneut falsch (zurück in Fach 1, sofort fällig) */
  function addAll(store, qs, now) {
    now = num(now) || Date.now(); const s = norm(store); let neu = 0, erneut = 0;
    (Array.isArray(qs) ? qs : []).forEach(q => {
      const k = keyOf(q), c = fromFrage(q, now); if (!c) return;
      if (s[k]) { s[k].f = 1; s[k].d = now; s[k].t = now; if (c.e && !s[k].e) s[k].e = c.e; erneut++; } else { s[k] = c; neu++; }
    });
    return { store: trim(s), neu, erneut };
  }
  /* Antwort in der Kartei verbuchen: gewusst = ein Fach höher (nach 1, 3, 7, 14 Tagen), sonst Fach 1 und sofort fällig (wie karten.js) */
  function antwort(store, id, gewusst, now) {
    now = num(now) || Date.now(); const s = norm(store), c = s[id]; if (!c) return s;
    const n = gewusst ? Math.min(5, c.f + 1) : 1; c.f = n; c.d = now + (gewusst ? ABST[n - 1] * DAY : 0); return s;
  }
  /* Kartei-Einträge im Format von karten-daten.js: [id, 'p', Frage, Antwort mit Erklärung, Teil]; neueste zuerst */
  function toKarten(store) {
    const s = norm(store);
    return Object.keys(s).sort((a, b) => s[b].t - s[a].t || (a < b ? -1 : 1)).map(id => { const c = s[id]; return [id, 'p', c.q, c.a + (c.e ? '\n\nErklärung: ' + c.e : ''), c.g || '']; });
  }
  const stateOf = c => (c ? [c.f, c.d] : undefined);
  const api = { KEY, MAX, TEIL, keyOf, antwortText, fromFrage, norm, trim, addAll, antwort, toKarten, stateOf, zahl, hash };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PKarten = api;

  /* ---------- Browserteil ---------- */
  if (typeof document === 'undefined') return;
  const rd = () => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : {}; } catch (e) { return {}; } };
  const wr = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } };
  const laden = () => trim(norm(rd()));
  /* falsch beantwortete Fragen als Karten ablegen; Rückgabe wie addAll (ohne store) */
  function speichern(qs, now) { const r = addAll(laden(), qs, now); if (r.neu || r.erneut) wr(r.store); return { neu: r.neu, erneut: r.erneut }; }
  function registrieren() { try { const L = root.Lernstand; if (L && Array.isArray(L.PROGRESS) && L.PROGRESS.indexOf(KEY) < 0) L.PROGRESS.push(KEY); } catch (e) {} }
  registrieren(); document.addEventListener('DOMContentLoaded', registrieren); document.addEventListener('click', registrieren, true);
  api.laden = laden; api.speichern = speichern; api.sichern = o => wr(trim(norm(o))); api.registrieren = registrieren;
})(typeof window !== 'undefined' ? window : globalThis);
