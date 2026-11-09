'use strict';
/* Tonfunk Lab: Wiederholen (Spaced Repetition nach Leitner).
   Aufgaben, die falsch oder nur mit Tipp gelöst wurden, und Aufgaben, die länger nicht geübt wurden, werden nach einigen Tagen von selbst wieder vorgeschlagen.
   Kernmodul ohne Browserbezug (node-testbar); der Browserteil unten liest und schreibt nur localStorage und zeigt die Hinweiszeile auf der Startseite.

   Speicher: lm4.wdh = { "<aufgabeId>": { b: Box 1..4, t: ms Zeitpunkt der letzten Bewertung, r: ms Zeitpunkt der letzten eigenen Bewertung auf der Seite (optional) } }
   Der Schlüssel liegt im Lernstand-Code und in der Lernstand-Datei (lernstand.js, Zusammenführen: höchster Wert); ältere Stände ohne lm4.wdh funktionieren unverändert,
   die Wiederholung baut sich dann beim ersten Öffnen aus den vorhandenen Ergebnissen (sim.done, lm4.tdone, sim.hints, lm4.when) neu auf.
   Der Export für den Ausbilder (stand.js) enthält die Wiederholung nicht.

   Regeln: richtig (100 %) und ohne Tipp = nächste Box (höchstens 4); falsch oder mit Tipp = zurück auf Box 1.
   Abstände je Box: 1, 3, 7, 14 Tage nach der letzten Bewertung. Nur Aufgaben, die schon bearbeitet wurden (Ergebnis oder Tipp vorhanden).
   Tageslimit: höchstens 5 Vorschläge am Tag (gezählt: heute auf der Seite bewertete Aufgaben + noch offene). Nur Labs des gewählten Berufs, keine Hubs. */
(function (root) {
  const DAY = 86400000, TAGE = [0, 1, 3, 7, 14], MAXBOX = 4, LIMIT = 5, KEY = 'lm4.wdh';
  const ID = /^[A-Za-z0-9_.-]{1,40}$/;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => { const x = +v; return isFinite(x) ? x : 0; };
  const pctOf = v => Math.max(0, Math.min(100, Math.round(num(v))));

  /* gespeicherten Zustand säubern: nur gültige Ids, Box 1..4, Zeit > 0 */
  function norm(w) {
    const o = {}; if (!isObj(w)) return o;
    Object.keys(w).forEach(id => {
      const e = w[id]; if (!ID.test(id) || !isObj(e)) return;
      const b = Math.round(num(e.b)), t = num(e.t); if (b < 1 || b > MAXBOX || t <= 0) return;
      const n = { b, t }; if (num(e.r) > 0) n.r = num(e.r); o[id] = n;
    });
    return o;
  }
  /* Bewertung: gut = 100 % und kein Tipp. Gut: nächste Box, sonst Box 1. */
  function bewerte(e, gut, t, eigen) {
    const n = { b: gut ? Math.min(MAXBOX, (e ? e.b : 0) + 1) : 1, t };
    if (e && e.r) n.r = e.r; if (eigen) n.r = t; return n;
  }
  const frueh = (pct, tip) => pctOf(pct) >= 100 && num(tip) <= 0;
  /* Aus den vorhandenen Ergebnissen abgleichen. in: { done: {id: Prozent (Maximum aus sim.done/lm4.tdone)}, hints: {id: Stufe}, when: {id: ms}, wdh: gespeicherter Zustand, now }
     Neue Aufgabe: schwach (unter 100 % oder mit Tipp) = Box 1, sonst Box 2; Zeitpunkt = lm4.when, fehlt er, jetzt.
     Bekannte Aufgabe mit neuerem lm4.when als die letzte Bewertung: neue Bewertung nach Ergebnis. Liefert { wdh, changed }. */
  function abgleich(inp) {
    const now = num(inp && inp.now) || Date.now(), done = isObj(inp.done) ? inp.done : {}, hints = isObj(inp.hints) ? inp.hints : {}, when = isObj(inp.when) ? inp.when : {};
    const old = norm(inp.wdh), w = {}; let changed = JSON.stringify(old) !== JSON.stringify(isObj(inp.wdh) ? inp.wdh : {});
    Object.keys(old).forEach(k => { w[k] = old[k]; });
    const ids = {}; Object.keys(done).forEach(k => { ids[k] = 1; }); Object.keys(hints).forEach(k => { if (num(hints[k]) > 0) ids[k] = 1; });
    Object.keys(ids).forEach(id => {
      if (!ID.test(id)) return;
      const pct = pctOf(done[id]), tip = num(hints[id]), tw = Math.min(now, num(when[id])) || 0, e = w[id], gut = frueh(pct, tip);
      if (!e) { w[id] = { b: gut ? 2 : 1, t: tw > 0 ? tw : now }; changed = true; return; }
      if (tw > e.t) { w[id] = bewerte(e, gut, tw, false); changed = true; }
    });
    return { wdh: w, changed };
  }
  /* Beruf: Lab-Schlüssel dieses Berufs (ohne Hubs); ohne Berufsangabe im Lab gilt egs */
  function labsVon(reg, beruf) { reg = isObj(reg) ? reg : {}; return Object.keys(reg).filter(k => !reg[k].hub && (Array.isArray(reg[k].beruf) ? reg[k].beruf : ['egs']).indexOf(beruf || 'egs') >= 0); }
  const tagStart = now => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); };
  /* Fällige Aufgaben. in: { wdh, rows (AUFGABEN-Zeilen [id, lab, gruppe, titel, stufe]), reg (LAB_REG), beruf, now, limit }
     Sortierung: schwächere Box zuerst, dann am längsten überfällig. Ergebnis: { liste (höchstens Rest des Tageslimits), faellig (alle fälligen), heute (heute schon bewertet), rest } */
  function heute(inp) {
    const now = num(inp.now) || Date.now(), limit = inp.limit == null ? LIMIT : Math.max(0, Math.round(num(inp.limit))), w = norm(inp.wdh), reg = inp.reg || {};
    const labs = labsVon(reg, inp.beruf), rows = {}; (Array.isArray(inp.rows) ? inp.rows : []).forEach(r => { if (Array.isArray(r) && labs.indexOf(r[1]) >= 0) rows[r[0]] = r; });
    const t0 = tagStart(now); let schonHeute = 0; const faellig = [];
    Object.keys(w).forEach(id => {
      const r = rows[id]; if (!r) return;
      const e = w[id]; if (e.r && e.r >= t0 && e.r <= now) { schonHeute++; return; }
      const at = e.t + TAGE[e.b] * DAY;
      if (at <= now) faellig.push({ id, lab: r[1], labName: (reg[r[1]] && reg[r[1]].name) || r[1], file: reg[r[1]] && reg[r[1]].file || '', titel: String(r[3] || id), box: e.b, faelligSeit: at, tage: Math.floor((now - at) / DAY), zuletzt: e.t });
    });
    faellig.sort((a, b) => a.box - b.box || a.faelligSeit - b.faelligSeit || (a.id < b.id ? -1 : 1));
    const rest = Math.max(0, limit - schonHeute);
    return { liste: faellig.slice(0, rest), faellig: faellig.length, heute: schonHeute, rest, limit };
  }
  /* Eigene Bewertung auf der Seite ("Geschafft ohne Tipp" / "Wieder unsicher") */
  function bewerten(wdh, id, gut, now) { const w = norm(wdh); if (!ID.test(String(id))) return w; w[id] = bewerte(w[id], !!gut, num(now) || Date.now(), true); return w; }
  const naechste = (e, now) => e ? Math.max(0, Math.ceil((e.t + TAGE[e.b] * DAY - (num(now) || Date.now())) / DAY)) : 0;
  const text = n => n === 1 ? '1 Aufgabe zum Wiederholen' : n + ' Aufgaben zum Wiederholen';
  const api = { KEY, DAY, TAGE, MAXBOX, LIMIT, norm, abgleich, heute, bewerten, labsVon, naechste, text, tagStart };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Wiederholen = api;

  /* ---------- Browserteil ---------- */
  if (typeof document === 'undefined') return;
  const rd = (k, d) => { try { const v = localStorage.getItem(k); const o = v == null ? d : JSON.parse(v); return o == null ? d : o; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  function maxDone() { const m = {}; ['sim.done', 'lm4.tdone'].forEach(k => { const o = rd(k, {}); if (isObj(o)) Object.keys(o).forEach(id => { const v = num(o[id]); if (v > (m[id] || 0) || !(id in m)) m[id] = v; }); }); return m; }
  function beruf() { try { return root.BerufReg ? root.BerufReg.cur() : (rd('lm4.beruf', 'egs') || 'egs'); } catch (e) { return 'egs'; } }
  /* gleicht ab, speichert (nur bei Änderung) und gibt den Zustand zurück */
  function laden(now) {
    now = now || Date.now();
    const a = abgleich({ done: maxDone(), hints: rd('sim.hints', {}), when: rd('lm4.when', {}), wdh: rd(KEY, {}), now });
    if (a.changed) wr(KEY, a.wdh);
    return a.wdh;
  }
  function stand(now) {
    now = now || Date.now(); const w = laden(now);
    return heute({ wdh: w, rows: root.AUFGABEN || [], reg: root.LAB_REG || {}, beruf: beruf(), now });
  }
  function bewertenUndSpeichern(id, gut) { const w = bewerten(rd(KEY, {}), id, gut, Date.now()); wr(KEY, w); return w; }
  /* Hinweiszeile auf der Startseite: nur wenn mindestens eine Aufgabe zum Wiederholen ansteht; steht hinter dem Primärband #top */
  function hinweis() {
    const doc = document, top = doc.getElementById('top'); if (!top) return;
    let a = doc.getElementById('wdhHint'), s; try { s = stand(); } catch (e) { s = null; }
    if (!s || !s.liste.length) { if (a) a.remove(); return; }
    if (!a) {
      a = doc.createElement('a'); a.id = 'wdhHint'; a.href = 'wiederholen.html';
      a.style.cssText = 'display:flex;align-items:center;gap:10px;min-height:44px;margin:-8px 0 16px;padding:8px 14px;border-radius:12px;border:1px solid var(--accent,#3b9eff);background:var(--panel,#222830);color:var(--fg,#e8ecf0);text-decoration:none;font:600 15px/1.3 system-ui,sans-serif';
      top.insertAdjacentElement('afterend', a);
    }
    a.textContent = '🔁 ' + text(s.liste.length) + ' – jetzt wiederholen';
    a.setAttribute('aria-label', text(s.liste.length) + ', Wiederholen öffnen');
  }
  root.Wiederholen.laden = laden; root.Wiederholen.stand = stand; root.Wiederholen.beruf = beruf; root.Wiederholen.bewertenUndSpeichern = bewertenUndSpeichern; root.Wiederholen.hinweis = hinweis;
  if (document.getElementById('top') && document.getElementById('contGo')) {
    const go = () => { try { hinweis(); } catch (e) {} };
    go(); root.addEventListener('pageshow', go); document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
