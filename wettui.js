/* wettui.js - Wettbewerb, Azubi-Oberflaeche (Paket W3, Spec quelle/SPEC-TAUSCH-WETTBEWERB.md 2.4, 4.1, 4.5, 6, 7).
   UMD: im Browser haengt sich das Modul als Wett.ui an Wett (wett.js), in Node liefert require('./wettui.js') { core, T, cfg, ... } fuer Tests.
   Dieses Modul laedt sich NICHT selbst nach und hat keinen Boot-Code. Es legt nur Wett.ui an; gezeigt wird erst, wenn jemand etwas aufruft.

   WAS I1 EINBINDEN UND AUFRUFEN MUSS
   1) Script-Tags (Reihenfolge): ... badges.js, auswertung.js, duell.js, wett.js, wettui.js. Optional davor codebus.js; fehlt es, laedt wettui.js
      codebus.js (und dieses qr.js/qrscan.js) bei Bedarf selbst nach, ebenso duell.css (Link) und duellui.js (ueber Duell.loadUi).
      WICHTIG: Eine Wettbewerbsrunde endet in der LAB-Seite der Aufgabe. Duell.onFinish ruft dort nur dann Wett.ui.finished, wenn wett.js und
      wettui.js DORT geladen sind. Also wett.js + wettui.js in jeder Lab-Seite einbinden, die duell.js einbindet (oder in duell.js onFinish bei
      rec.w die beiden Skripte lazy nachladen). Ohne das bleibt die Runde korrekt gespeichert (lm4.duell.hist), aber ohne Ergebnis-Sheet.
   2) Werkbank-Zeile (T4/I1), Knopf "Wettbewerb":  Wett.ui.open()  (Sheet "Wettbewerb"; Duell-Lobby: derselbe Aufruf).
      Statuszeile der Werkbank:  Wett.ui.statusZeile()  -> '' oder "Wettbewerb ‚Name‘ bis Fr 06.11. · 3 von 5" (Datenstand Duell-Historie, kein DOM).
      Link/Scan mit TFW1: Wett.ui.open({ code: 'TFW1....' }) liest die Ausschreibung ein (Signatur wird geprueft) und zeigt die Liste.
   3) Abzeichen: Wett.ui meldet NUR Zaehler ueber Badges.stat (falls vorhanden): 'wettteil' (1, Modus 'max', bei jeder erzeugten Abgabe) und
      'wettpodium' (1, Modus 'max', wenn der eigene Anzeigename Platz 1-3 einer eingelesenen TFR1 hat UND fuer diese wid eine Abgabe vorliegt).
      I1 traegt in badges.js ein: wettteil -> c.st.wettteil >= 1, wettpodium -> c.st.wettpodium >= 1. Die Abzeichen-Daten stehen hier NICHT.
      Zusaetzlich meldet finished() die Duell-Zaehler (duelle, duellmess, duellwoche) wie duellui.js, weil Wettbewerbsrunden als Duelle zaehlen.
   4) Kein CSS-Eintrag noetig: ein kleiner Stilblock (<= 30 Zeilen) wird beim ersten Oeffnen inline eingefuegt, duell.css (.dl-* Variablen) wird bei Bedarf verlinkt.

   Verhalten: Jede Aufgabe startet als Duell-Runde Duell.store.start(Wett.core.runde(aus, i), AUFGABEN-Zeile, aus.st, ..., { w, wi }) mit 3-2-1 und
   dann Navigation in die Lab-Seite (cfg.nav ersetzbar, Tests). Tipp-Abzug (-5), Stufe-3-Sperre und Klick-Sperre gelten, weil es eine Duell-Runde ist;
   normales Ueben ist unberuehrt. Start nur im Zeitfenster (sonst Hinweis, keine Runde). Wiederholung (Aufgabe schon gespielt) zaehlt als Uebung.
   Es werden nie Fehler, Ursache oder Loesung angezeigt, nur Titel (AUFGABEN) und Zahlen. Der Code enthaelt nur lm4.kuerzel, nie lm4.name.

   Annahmen:
   B1 Eine Runde ausserhalb des Zeitfensters wird gar nicht gestartet (auch nicht als Uebung): sonst wuerde sie den Wertungsdurchgang (wd) belegen.
   B2 Das Abzeichen wettpodium zaehlt nur, wenn zur wid der TFR1 auch eine eigene Abgabe gespeichert ist (Schutz gegen zufaellig gleichen Namen).
   B3 Die Duell-Chip-Aufgabe-Aufgeben-Taste (duellui.js) ruft ihre eigene finished-Funktion; fuer Wettbewerbsrunden erscheint dort das Duell-Sheet.
      Der Fortschritt stimmt trotzdem (Historie). Empfehlung an duellui.js: im Chip-Handler stattdessen Duell.onFinish(rec) aufrufen. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api || {};
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  let Wt = root.Wett || null; if (!Wt) { try { if (typeof require === 'function') Wt = require('./wett.js'); } catch (e) { Wt = null; } }
  if (!Wt || !Wt.core) return null;
  const Dl = () => { if (root.Duell && root.Duell.core) return root.Duell; try { if (typeof require === 'function') return require('./duell.js'); } catch (e) {} return null; };
  const D = () => Dl(), WC = Wt.core, WS = Wt.store, WW = Wt.WW;
  const hasDoc = () => typeof document !== 'undefined' && !!document.body;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const p2 = n => String(n).padStart(2, '0');
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const tipp = () => { const d = D(); return d && d.W ? d.W.tipp : 5; };

  /* ================= Kern ohne DOM (Node-testbar) ================= */
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const YRE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dmy = (s, mitJahr) => { const m = YRE.exec(String(s || '')); return m ? m[3] + '.' + m[2] + '.' + (mitJahr ? m[1] : '') : ''; };
  const wtag = s => { const m = YRE.exec(String(s || '')); return m ? WT[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : ''; };
  const tagDatum = s => wtag(s) + ' ' + dmy(s);
  function zeitraum(aus) { return aus && aus.von ? tagDatum(aus.von) + ' bis ' + wtag(aus.bis) + ' ' + dmy(aus.bis, true) : ''; }
  /* 'bevor' | 'offen' | 'vorbei' (gleiche Regel wie Wett.core.imFenster, inkl. Toleranz) */
  function status(aus, now) {
    if (!aus || typeof aus.von !== 'string' || typeof aus.bis !== 'string') return 'vorbei';
    try { const t = now == null ? Date.now() : now; if (WC.imFenster(t, aus)) return 'offen'; return t < WC.fenster(aus).a ? 'bevor' : 'vorbei'; } catch (e) { return 'vorbei'; }
  }
  const fortText = f => (f ? f.gewertet + ' von ' + f.gesamt : '');
  const titel = (aus, i, aufgaben) => { const r = WC.task(aus, i, aufgaben); return r ? String(r[3]) : 'Aufgabe ' + (i + 1) + ' (in dieser App-Version nicht vorhanden)'; };
  /* je Aufgabe: { i, titel, zustand:'gewertet'|'geuebt'|'offen', L, bekannt } */
  function aufgabenListe(aus, fort, aufgaben) {
    if (!aus || !Array.isArray(aus.a)) return [];
    return aus.a.map((id, i) => { const je = fort && fort.je ? fort.je[i] : null, row = WC.task(aus, i, aufgaben);
      return { i, id, titel: titel(aus, i, aufgaben), bekannt: !!row, zustand: je && je.wd ? 'gewertet' : je && je.gespielt ? 'geuebt' : 'offen', L: je && je.wd ? je.L : null }; });
  }
  const naechste = fort => { const je = fort && fort.je ? fort.je : []; for (let i = 0; i < je.length; i++) if (!je[i].wd) return i; return -1; };
  const T = {
    titel: 'Wettbewerb',
    intro: () => 'Dein Ausbilder schreibt einen Wettbewerb aus. Jede Aufgabe läuft wie ein Duell: Tipps kosten ' + tipp() + ' Punkte, nachschlagen geht nicht, nur der erste vollständige Versuch zählt. Die Abgabe ist freiwillig. Das ist ein Spiel und keine Bewertung.',
    leer: 'Noch keine Ausschreibung eingelesen. Lies den Code (Text oder QR) von deinem Ausbilder ein.',
    status: { offen: 'läuft', bevor: 'startet bald', vorbei: 'beendet' },
    bevor: aus => 'Der Wettbewerb startet am ' + tagDatum(aus.von) + '. Vorher gibt es keine Wertung.',
    vorbei: aus => 'Der Wettbewerb ist seit ' + tagDatum(aus.bis) + ' beendet. Es gibt keine Wertung mehr.',
    unbekannt: 'Diese Aufgabe gibt es in dieser App-Version nicht. Aktualisiere die App und lies die Ausschreibung neu ein.',
    uebung: 'Du hast diese Aufgabe schon gespielt. Die Wiederholung zählt als Übung, dein erster Durchgang bleibt gewertet.',
    zustand: { gewertet: 'gewertet', geuebt: 'geübt, zählt nicht', offen: 'offen' },
    keineAbgabe: { vorbei: 'Die Abgabe ist nur bis zum Ende des Zeitraums möglich.', bevor: 'Der Wettbewerb hat noch nicht begonnen.', leer: 'Spiele zuerst mindestens eine Aufgabe, dann kannst du abgeben.' },
    nameHinweis: 'Wähle einen Fantasienamen, nicht deinen echten Namen.',
    nameFehler: 'Bitte einen Anzeigenamen mit 2 bis 24 Zeichen eintragen (Buchstaben, Ziffern, _ . -).',
    wdJa: 'Wertungsdurchgang: zählt für den Wettbewerb.',
    wdNein: 'Wiederholung: zählt als Übung. Dein erster Durchgang bleibt gewertet.',
    alle: 'Alle Aufgaben sind gewertet. Du kannst jetzt abgeben.',
    rangKein: 'Das ist keine gültige Rangliste (sie beginnt mit TFR1.).',
    ausKein: 'Das ist keine gültige Ausschreibung (sie beginnt mit TFW1.).',
    sigFalsch: 'Die Signatur stimmt nicht (Tippfehler oder geändert). Der Code wurde nicht übernommen.',
    sigU: 'Ohne Signaturprüfung gelesen (z. B. Datei-Modus).',
    podium: 'Du stehst auf dem Podium. Glückwunsch!'
  };
  /* Startplan fuer Aufgabe i: { ok, grund, hinweis, wertung, wiederholung, row, r, w, wi, st } */
  function startPlan(aus, i, fort, now, aufgaben) {
    if (!aus || !Array.isArray(aus.a) || !Number.isInteger(i) || i < 0 || i >= aus.a.length) return { ok: false, grund: 'index', hinweis: T.unbekannt };
    const row = WC.task(aus, i, aufgaben); if (!row) return { ok: false, grund: 'unbekannt', hinweis: T.unbekannt };
    const s = status(aus, now); if (s !== 'offen') return { ok: false, grund: s, hinweis: T[s](aus) };
    const je = fort && fort.je ? fort.je[i] : null, wdh = !!(je && je.gespielt > 0);
    return { ok: true, grund: '', hinweis: wdh ? T.uebung : '', wertung: !wdh, wiederholung: wdh, row, r: WC.runde(aus, i), w: aus.wid, wi: i, st: aus.st };
  }
  const KRE = () => { const d = D(); return d && d.core ? d.core.KRE : /^[A-Za-z0-9ÄÖÜäöüß_.-]{2,24}$/; };
  /* Abgabeplan: { ok, grund:''|'vorbei'|'bevor'|'leer'|'name', vollstaendig } */
  function abgabePlan(aus, fort, now, k) {
    if (!aus) return { ok: false, grund: 'leer', vollstaendig: false };
    const s = status(aus, now); if (s !== 'offen') return { ok: false, grund: s, vollstaendig: false };
    if (!fort || !fort.gewertet) return { ok: false, grund: 'leer', vollstaendig: false };
    const vol = fort.gewertet === fort.gesamt;
    if (!KRE().test(String(k || ''))) return { ok: false, grund: 'name', vollstaendig: vol };
    return { ok: true, grund: '', vollstaendig: vol };
  }
  /* Rangliste fuer die Anzeige: [{ platz, k, G, n, ich }]; Platz wie Wett.core.platzVon (Gleichstand = gleicher Platz) */
  function rangZeilen(rang, k) {
    if (!rang || !Array.isArray(rang.rows)) return [];
    return rang.rows.map(r => ({ platz: WC.platzVon(rang, r[0]), k: r[0], G: r[1], n: r[2], ich: !!k && r[0] === k }));
  }
  const podiumPlatz = (rang, k) => { const p = WC.platzVon(rang, k); return p >= 1 && p <= 3 ? p : 0; };
  const klassenText = r => r[1] == null ? 'Klasse ' + r[0] + ': noch kein Wert (weniger als ' + WW.medianMin + ' Teilnehmende, ' + r[2] + ' dabei)' : 'Klasse ' + r[0] + ': Mittelwert ' + r[1] + ' (' + r[2] + ' Teilnehmende)';
  /* Statuszeile fuer die Werkbank-Zeile: laufender Wettbewerb mit dem naechsten Ende; '' wenn keiner laeuft. s = Speicher (Tests) */
  function statusZeile(now, s) {
    try {
      const l = WS.ausList(s).filter(a => status(a, now) === 'offen').sort((a, b) => (a.bis < b.bis ? -1 : a.bis > b.bis ? 1 : 0))[0]; if (!l) return '';
      const f = WS.meinFortschritt(l.wid, s); return 'Wettbewerb ‚' + l.n + '‘ bis ' + tagDatum(l.bis) + (f ? ' · ' + fortText(f) : '');
    } catch (e) { return ''; }
  }
  const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + p2(s % 60); };
  const gueltigerName = () => { const k = lsGet('lm4.kuerzel').replace(/"/g, '').trim(); return KRE().test(k) ? k : ''; };

  /* ================= DOM ================= */
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const cfg = { nav: u => { location.href = u; } };
  const CSS = '.wt-hd{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px 10px}.wt-hd b{overflow-wrap:anywhere}'
    + '.wt-st{font-size:13px;font-weight:700;padding:1px 9px;border-radius:10px;border:1px solid var(--dl-line);white-space:nowrap}'
    + '.wt-st-offen{color:var(--dl-ok)}.wt-st-bevor{color:var(--dl-warn)}.wt-st-vorbei{color:var(--dl-mute)}'
    + '.wt-fort{margin:8px 0 2px}.wt-fort b{font-size:18px}.wt-tasks{list-style:none;margin:6px 0 0;padding:0}'
    + '.wt-tasks li{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--dl-line)}'
    + '.wt-tt{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}.wt-tt small{display:block}.wt-tasks .dl-btn{flex:none;min-width:84px}'
    + '.wt-z{display:inline-block;width:1.4em;font-weight:800}.wt-me td{background:var(--dl-acc);color:#fff;font-weight:800}'
    + '.wt-box .dl-tbl td{overflow-wrap:anywhere}.wt-sec{margin:14px 0 4px;font-weight:700}'
    + '@media (max-width:480px){.wt-tasks li{flex-wrap:wrap}.wt-tasks .dl-btn{flex:1 1 100%}}';
  function ensureUi() {
    if (!hasDoc()) return;
    if (!document.querySelector('link[href$="duell.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'duell.css'; document.head.appendChild(l); }
    if (!document.getElementById('wtCss')) { const s = document.createElement('style'); s.id = 'wtCss'; s.textContent = CSS; document.head.appendChild(s); }
  }
  function toast(msg) {
    const old = document.getElementById('wtToast'); if (old) old.remove();
    const t = el('div', 'dl dl-toast', esc(msg)); t.id = 'wtToast'; t.setAttribute('role', 'status'); document.body.appendChild(t); setTimeout(() => t.remove(), 3600);
  }
  function modal(title) {
    ensureUi();
    const old = document.getElementById('wtBox'); if (old && old.__close) old.__close(); else if (old) old.remove();
    const back = document.activeElement;
    const ov = el('div', 'dl dl-ov'); ov.id = 'wtBox';
    const box = el('div', 'dl-box wt-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const hd = el('div', 'dl-hd', '<b>' + esc(title) + '</b>'), x = el('button', 'dl-x0', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Schließen'); hd.appendChild(x);
    const body = el('div'); box.appendChild(hd); box.appendChild(body); ov.appendChild(box); document.body.appendChild(ov);
    const key = e => { if (e.key === 'Escape' && !document.getElementById('cbBox')) close(); };
    function close() { ov.remove(); document.removeEventListener('keydown', key, true); if (back && back.focus && document.contains(back)) { try { back.focus(); } catch (e) {} } }
    ov.__close = close; x.onclick = close; ov.addEventListener('mousedown', e => { if (e.target === ov) close(); }); document.addEventListener('keydown', key, true);
    setTimeout(() => { try { x.focus(); } catch (e) {} }, 0);
    return { ov, box, body, close };
  }
  function countdown(done) {
    let n = 3; const ov = el('div', 'dl dl-cd'); ov.setAttribute('role', 'timer'); ov.setAttribute('aria-live', 'assertive'); document.body.appendChild(ov);
    const step = () => { if (n > 0) { ov.textContent = n--; try { if (root.LochFX) root.LochFX.sound('tick'); } catch (e) {} setTimeout(step, 800); } else { ov.remove(); done(); } };
    step();
  }
  const labFile = id => (root.LAB_REG && root.LAB_REG[id] && root.LAB_REG[id].file) || 'index.html';
  const labApi = () => { try { const a = root.LabDuellAPI; return a ? { m: typeof a.messungen === 'function' ? a.messungen() : null, mp: a.messpunkte == null ? null : a.messpunkte } : {}; } catch (e) { return {}; } };
  const aufgaben = () => root.AUFGABEN || [];
  const chipRefresh = () => { try { const d = D(); if (d && d.ui && d.ui.chip) d.ui.chip(); else if (d && d.loadUi) d.loadUi(u => u.chip()); } catch (e) {} };
  const btn = (label, cls, attrs, aria) => '<button type="button" class="dl-btn' + (cls ? ' ' + cls : '') + '"' + (attrs ? ' ' + attrs : '') + (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + esc(label) + '</button>';

  /* Codebus bei Bedarf nachladen (wie duellui bei qr.js) */
  function withCodebus(cb) {
    if (root.Codebus) { cb(root.Codebus); return; }
    const s = document.createElement('script'); s.src = 'codebus.js'; s.onload = () => { if (root.Codebus) cb(root.Codebus); else toast('Einlesen nicht verfügbar.'); }; s.onerror = () => toast('Einlesen nicht verfügbar.'); document.head.appendChild(s);
  }

  /* ---------- Ausschreibung / Rangliste einlesen ---------- */
  /* text -> Promise<{ ok, aus?, sig, grund? }>; speichert nur bei gueltiger Signatur (oder unsigniert, A4) */
  async function addText(text) {
    const v = await WC.verifyAus(text);
    if (!v) return { ok: false, sig: '', grund: T.ausKein };
    if (!v.ok) return { ok: false, sig: v.sig, grund: T.sigFalsch };
    const a = WS.addAus(v.code); if (!a) return { ok: false, sig: v.sig, grund: 'Speicher gesperrt oder voll.' };
    return { ok: true, sig: v.sig, aus: a };
  }
  let mainRender = null;
  function lesenAus() {
    withCodebus(cb => cb.receive({ title: 'Ausschreibung einlesen', accept: /^TFW1\./, onCode: c => (WC.parseAus(c).length ? true : T.ausKein), onDone: async list => {
      let n = 0, last = null, err = '', un = false;
      for (const c of list) { const r = await addText(c); if (r.ok) { n++; last = r.aus; un = un || r.sig === 'unsigniert'; } else err = r.grund; }
      if (n) toast('Ausschreibung ‚' + last.n + '‘ gespeichert' + (un ? '. ' + T.sigU : '')); else if (err) toast(err);
      if (mainRender && document.getElementById('wtBox')) mainRender(); else if (n) open();
    } }));
  }
  function lesenRang() {
    withCodebus(cb => cb.receive({ title: 'Rangliste einlesen', accept: /^TFR1\./, onCode: c => (WC.parseRang(c).length ? true : T.rangKein), onDone: list => {
      const c = list[list.length - 1]; if (!c) return; if (!WS.setRang(c)) { toast('Speicher gesperrt oder voll.'); return; } rangSheet();
    } }));
  }

  /* ---------- Start einer Aufgabe ---------- */
  function begin(aus, plan, m) {
    const d = D(), go = () => { m.close(); countdown(() => {
      const c = d.store.start(plan.r, plan.row, plan.st, undefined, undefined, { w: plan.w, wi: plan.wi });
      if (!c) { toast('Die Aufgabe konnte nicht gestartet werden (Speicher gesperrt, z. B. privater Modus?).'); return; }
      const q = new URLSearchParams(location.search), same = location.pathname.split('/').pop() === labFile(plan.row[1]) && q.get('aufgabe') === plan.row[0];
      if (same) { chipRefresh(); return; }
      cfg.nav(labFile(plan.row[1]) + '?aufgabe=' + encodeURIComponent(plan.row[0]) + '&duell=' + encodeURIComponent(plan.r) + '&st=' + plan.st + (/^[a-z]{2,5}$/.test(plan.row[1]) ? '&lab=' + plan.row[1] : ''));
    }); };
    const cur = d.store.current(null);
    if (cur && cur.start && cur.r !== plan.r) {
      m.body.innerHTML = '<div class="dl-card"><p><b>Es läuft noch eine Runde (' + esc(cur.r) + ').</b></p><p>Soll sie mit Wertung beendet und die neue Aufgabe gestartet werden?</p><div class="dl-row">' + btn('Beenden und neu starten', 'pri', 'data-act="yes"') + btn('Abbrechen', '', 'data-act="no"') + '</div></div>';
      m.body.querySelector('[data-act=yes]').onclick = () => { try { d.store.giveUp(null, Date.now(), labApi()); } catch (e) {} chipRefresh(); go(); };
      m.body.querySelector('[data-act=no]').onclick = () => { if (mainRender) mainRender(); else m.close(); };
      try { m.body.querySelector('[data-act=yes]').focus(); } catch (e) {} return;
    }
    go();
  }
  function startAufgabe(wid, i, m) {
    const aus = WS.getAus(wid); if (!aus) return;
    const plan = startPlan(aus, i, WC.fortschritt(aus, WS.hist()), Date.now(), aufgaben());
    if (!plan.ok) { toast(plan.hinweis); return; }
    begin(aus, plan, m);
  }

  /* ---------- Hauptsheet ---------- */
  function cardHtml(aus, now) {
    const fort = WC.fortschritt(aus, WS.hist()), st = status(aus, now), list = aufgabenListe(aus, fort, aufgaben()), abg = WS.getAbgabe(aus.wid), nx = naechste(fort), on = st === 'offen';
    const items = list.map(a => {
      const z = a.zustand === 'gewertet' ? '✓' : a.zustand === 'geuebt' ? '↻' : '○', info = T.zustand[a.zustand] + (a.L != null ? ' · ' + a.L + ' Punkte' : '');
      const lab = (a.zustand === 'offen' ? 'Aufgabe ' + (a.i + 1) + ' starten: ' : 'Aufgabe ' + (a.i + 1) + ' wiederholen (Übung): ') + a.titel;
      return '<li><span class="wt-tt"><span class="wt-z" aria-hidden="true">' + z + '</span>' + esc(a.titel) + '<small>' + esc(info) + '</small></span>'
        + btn(a.zustand === 'offen' ? 'Start' : 'Üben', '', 'data-act="start" data-w="' + aus.wid + '" data-i="' + a.i + '"' + (on && a.bekannt ? '' : ' disabled'), lab) + '</li>';
    }).join('');
    return '<section class="dl-card" aria-label="Wettbewerb ' + esc(aus.n) + '"><div class="wt-hd"><b>' + esc(aus.n) + '</b><span class="wt-st wt-st-' + st + '">' + T.status[st] + '</span></div>'
      + '<small>' + (aus.kl ? 'Klasse ' + esc(aus.kl) + ' · ' : '') + esc(zeitraum(aus)) + ' · Stufe ' + aus.st + '</small>'
      + '<p class="wt-fort"><b>' + fortText(fort) + '</b> Aufgaben gewertet</p><ol class="wt-tasks">' + items + '</ol>'
      + (on ? '' : '<p class="dl-warn">' + esc(T[st](aus)) + '</p>')
      + (abg ? '<p class="dl-ok"><small>Abgegeben am ' + esc(new Date(abg.t).toLocaleDateString('de-DE') + ' ' + new Date(abg.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })) + '. Du kannst bis zum Ende neu abgeben.</small></p>' : '')
      + '<div class="dl-row">' + (on && nx >= 0 ? btn('Nächste Aufgabe starten', 'pri', 'data-act="start" data-w="' + aus.wid + '" data-i="' + nx + '"', 'Nächste Aufgabe starten: ' + titel(aus, nx, aufgaben())) : '')
      + btn('Abgeben', on && fort.gewertet ? 'pri' : '', 'data-act="abgabe" data-w="' + aus.wid + '"' + (on ? '' : ' disabled')) + '</div></section>';
  }
  function open(o) {
    o = o || {}; if (!hasDoc()) return null;
    const m = modal(T.titel);
    const render = () => {
      const now = Date.now(), list = WS.ausList(), rang = WS.getRang();
      m.body.innerHTML = '<p>' + esc(T.intro()) + '</p>' + (list.length ? list.map(a => cardHtml(a, now)).join('') : '<div class="dl-card"><p>' + esc(T.leer) + '</p></div>')
        + '<div class="dl-row">' + btn('Ausschreibung einlesen', list.length ? '' : 'pri', 'data-act="lesen"') + btn('Rangliste einlesen', '', 'data-act="rang"') + (rang ? btn('Rangliste ansehen', '', 'data-act="rangzeigen"') : '') + '</div>';
      m.body.querySelectorAll('[data-act=start]').forEach(b => { b.onclick = () => startAufgabe(b.dataset.w, +b.dataset.i, m); });
      m.body.querySelectorAll('[data-act=abgabe]').forEach(b => { b.onclick = () => abgabe(b.dataset.w); });
      m.body.querySelector('[data-act=lesen]').onclick = lesenAus; m.body.querySelector('[data-act=rang]').onclick = lesenRang;
      const z = m.body.querySelector('[data-act=rangzeigen]'); if (z) z.onclick = () => rangSheet();
    };
    mainRender = render; render();
    if (o.code) addText(o.code).then(r => { if (r.ok) toast('Ausschreibung ‚' + r.aus.n + '‘ gespeichert' + (r.sig === 'unsigniert' ? '. ' + T.sigU : '')); else toast(r.grund); render(); });
    return { close: m.close, render };
  }

  /* ---------- Abgabe ---------- */
  function abgabe(wid) {
    const aus = WS.getAus(wid); if (!aus || !hasDoc()) return null;
    const m = modal('Ergebnis abgeben');
    const view = nameForm => {
      const fort = WC.fortschritt(aus, WS.hist()), k = nameForm ? '' : gueltigerName(), plan = abgabePlan(aus, fort, Date.now(), k);
      if (plan.grund === 'vorbei' || plan.grund === 'bevor' || plan.grund === 'leer') { m.body.innerHTML = '<p>' + esc(T.keineAbgabe[plan.grund]) + '</p><div class="dl-row">' + btn('Zur Übersicht', 'pri', 'data-act="back"') + '</div>'; m.body.querySelector('[data-act=back]').onclick = () => open(); return; }
      if (plan.grund === 'name') {
        m.body.innerHTML = '<p>Dein Ergebnis trägt einen Anzeigenamen, den dein Ausbilder und deine Klasse sehen.</p><label for="wtK">Dein Anzeigename</label><input type="text" id="wtK" maxlength="24" autocomplete="off" autocapitalize="off" placeholder="z. B. blitz07" value="' + esc(lsGet('lm4.kuerzel').replace(/"/g, '')) + '">'
          + '<p><b>' + esc(T.nameHinweis) + '</b></p><div class="dl-err" id="wtE" role="alert"></div><div class="dl-row">' + btn('Speichern und weiter', 'pri', 'data-act="ok"') + '</div>';
        const inp = m.body.querySelector('#wtK');
        m.body.querySelector('[data-act=ok]').onclick = () => { const v = inp.value.trim(); if (!KRE().test(v)) { m.body.querySelector('#wtE').textContent = T.nameFehler; return; } lsSet('lm4.kuerzel', v); view(); };
        try { inp.focus(); } catch (e) {} return;
      }
      const erg = WS.meinErgebnis(wid), w = erg ? WC.wertung(aus, { res: erg.res }) : null;
      if (!erg || !w) { m.body.innerHTML = '<p class="dl-err">Das Ergebnis konnte nicht erstellt werden.</p>'; return; }
      const abg = WS.getAbgabe(wid), l = w.L.map((x, i) => '<li>' + esc(titel(aus, i, aufgaben())) + ': <b>' + (x == null ? '0 (nicht gespielt)' : x) + '</b></li>').join('');
      m.body.innerHTML = '<div class="dl-card"><div class="dl-mute">Dein Wert</div><div class="dl-big">' + w.G + '</div><p><small>Mittel über ' + fort.gesamt + ' Aufgaben, nicht gespielte zählen 0. Anzeigename: <b>' + esc(erg.k) + '</b>' + (erg.kl ? ' · Klasse ' + esc(erg.kl) : '') + '</small></p></div>'
        + '<ol class="wt-tasks" style="list-style:decimal;padding-left:22px">' + l + '</ol>' + (plan.vollstaendig ? '' : '<p class="dl-warn">Du hast noch nicht alle Aufgaben gespielt. Du kannst jetzt abgeben und später neu abgeben.</p>')
        + '<p><small>Der Code enthält nur deinen Anzeigenamen, Zähler und die Aufgabenzahlen, nie deinen Klarnamen. Es wird nichts automatisch gesendet.</small></p>'
        + '<div class="dl-row">' + btn(abg ? 'Code neu erzeugen und weitergeben' : 'Code erzeugen und weitergeben', 'pri', 'data-act="code"') + btn('Name ändern', '', 'data-act="name"') + '</div><div class="dl-err" id="wtE" role="alert"></div>';
      m.body.querySelector('[data-act=name]').onclick = () => view(true);
      m.body.querySelector('[data-act=code]').onclick = async () => {
        const e2 = WS.meinErgebnis(wid), code = e2 ? await WC.encodeErg(e2) : null, out = m.body.querySelector('#wtE');
        if (!code) { out.textContent = 'Der Code konnte nicht erstellt werden.'; return; }
        if (!WS.setAbgabe(wid, code)) { out.textContent = 'Speicher gesperrt oder voll.'; return; }
        try { if (root.Badges && root.Badges.stat) root.Badges.stat('wettteil', 1, 'max'); } catch (e) {}
        out.textContent = ''; view();
        const note = code.length > WW.qrMax ? ' Der Code ist lang: nimm lieber Text oder Datei als QR.' : '';
        withCodebus(cb => cb.send(code, { title: 'Ergebnis abgeben' }));
        if (note) toast(note.trim());
      };
    };
    view(); return { close: m.close };
  }

  /* ---------- Rangliste ---------- */
  function meldePodium(r, k) {
    try {
      const B = root.Badges, p = podiumPlatz(r.parsed, k);
      if (p && WS.getAbgabe(r.parsed.wid) && B && typeof B.stat === 'function') B.stat('wettpodium', 1, 'max');   /* B2 */
      return p;
    } catch (e) { return 0; }
  }
  function rangSheet() {
    const r = WS.getRang(); if (!r || !hasDoc()) return null;
    const m = modal('Rangliste'), k = gueltigerName(), z = rangZeilen(r.parsed, k), p = r.parsed, pod = meldePodium(r, k), mine = k ? WC.platzVon(p, k) : 0;
    m.body.innerHTML = '<p><b>' + esc(p.n || 'Wettbewerb') + '</b><br><small>' + (p.kl ? 'Klasse ' + esc(p.kl) + ' · ' : '') + (p.t ? 'Stand ' + esc(new Date(p.t).toLocaleDateString('de-DE')) : '') + '</small></p>'
      + (mine ? '<p class="dl-ok"><b>Du bist Platz ' + mine + '.</b> ' + (pod ? esc(T.podium) : '') + '</p>' : '')
      + (z.length ? '<table class="dl-tbl"><thead><tr><th class="n">Platz</th><th>Name</th><th class="n">Wert</th><th class="n">Aufg.</th></tr></thead><tbody>' + z.map(x => '<tr' + (x.ich ? ' class="wt-me" aria-current="true"' : '') + '><td class="n">' + x.platz + '</td><td>' + esc(x.k) + (x.ich ? ' (du)' : '') + '</td><td class="n">' + x.G + '</td><td class="n">' + x.n + '</td></tr>').join('') + '</tbody></table>' : '<p>Die Rangliste ist leer.</p>')
      + (p.klassen && p.klassen.length ? '<p class="wt-sec">Klassenwerte</p><ul>' + p.klassen.map(c => '<li>' + esc(klassenText(c)) + '</li>').join('') + '</ul>' : '')
      + (p.note ? '<p><small>' + esc(p.note) + '</small></p>' : '') + '<p><small>Das ist ein Spiel und keine Bewertung. Zeigt nur die ersten ' + WW.top + '.</small></p><p class="dl-warn" id="wtSig" role="status"></p>'
      + '<div class="dl-row">' + btn('Andere Rangliste einlesen', '', 'data-act="rang"') + btn('Zur Übersicht', 'pri', 'data-act="back"') + '</div>';
    m.body.querySelector('[data-act=rang]').onclick = lesenRang; m.body.querySelector('[data-act=back]').onclick = () => open();
    WC.verifyRang(r.code).then(v => { const s = m.body.querySelector('#wtSig'); if (s && v && !v.ok) s.textContent = 'Die Signatur der Rangliste stimmt nicht (Tippfehler oder geändert). Behandle sie mit Vorsicht.'; else if (s && v && v.sig === 'unsigniert') s.textContent = T.sigU; });
    return { close: m.close };
  }

  /* ---------- Duell-Zaehler (wie duellui.badges): Wettbewerbsrunden zaehlen als Duelle ---------- */
  function duellStats() {
    const B = root.Badges, d = D(); if (!B || !B.stat || !d) return;
    try {
      const C = d.core, h0 = d.store.history(null), seen = {}, h = h0.filter(x => { if (x.pct < 100 || seen[x.r]) return false; seen[x.r] = 1; return true; }), won = h.filter(x => x.win != null ? x.win === 1 : x.gp != null && Math.round(x.pts * (x.pr ? 0.5 : 1)) > x.gp), per = {}; h.forEach(x => { const k = C.kw(x.t); per[k] = (per[k] || 0) + 1; });
      B.stat('duelle', h.length + Object.keys(JSON.parse(lsGet('lm4.duels') || '{}')).length, 'max');
      B.stat('duellsieg', won.length, 'max'); B.stat('duellmess', won.filter(x => x.m >= 3).length, 'max'); B.stat('duellwoche', Math.max(0, ...Object.keys(per).map(k => per[k])), 'max');
    } catch (e) {}
  }

  /* ---------- Sheet nach einer Runde ---------- */
  function finishedImpl(rec) {
    if (!rec || typeof rec !== 'object' || !hasDoc()) return null;
    const d = D(), aus = rec.w ? WS.getAus(rec.w) : null;
    chipRefresh();
    try { if (root.Badges) { root.Badges.confetti && root.Badges.confetti(false); root.Badges.chime && root.Badges.chime(false); } } catch (e) {}
    duellStats();
    const sc = rec.sc || d.core.score({ st: rec.st, pct: rec.pct, ms: rec.ms, h: rec.h, f: rec.f, m: rec.m == null ? null : rec.m, mp: rec.mp == null ? null : rec.mp });
    const fort = aus ? WC.fortschritt(aus, WS.hist()) : null, nx = aus ? naechste(fort) : -1, on = aus ? status(aus, Date.now()) === 'offen' : false;
    const m = modal(rec.pct >= 100 ? '🏁 Aufgabe geschafft' : 'Aufgabe beendet'), b = m.body;
    b.innerHTML = '<div class="dl-card"><div class="dl-big">' + rec.pts + ' Punkte</div><p>Richtigkeit ' + sc.R + ' · Arbeitsweise ' + sc.A + ' · Zeit ' + sc.Z + (sc.T ? ' · Tipp-Abzug −' + sc.T : '') + '</p>'
      + '<p><small>' + (aus ? esc(titel(aus, rec.wi, aufgaben())) + '<br>' : '') + 'Zeit ' + fmt(rec.ms) + ' · Tipps ' + rec.h + ' (−' + rec.h * tipp() + ') · Versuche ' + rec.f + ' · Messungen ' + (rec.m == null ? '–' : rec.m) + (rec.pr ? '<br>Du kanntest die Aufgabe schon: sie zählt halb.' : '') + '</small></p>'
      + (rec.wd != null ? '<p class="' + (rec.wd ? 'dl-ok' : 'dl-warn') + '"><small>' + esc(rec.wd ? T.wdJa : T.wdNein) + '</small></p>' : '') + '</div>'
      + (fort ? '<p class="wt-fort"><b>' + fortText(fort) + '</b> Aufgaben gewertet</p>' : '') + '<p><small>Gespeichert auf diesem Gerät.</small></p>';
    const row = el('div', 'dl-row'); b.appendChild(row);
    if (aus && on && nx >= 0) { row.insertAdjacentHTML('beforeend', btn('Nächste Aufgabe: ' + titel(aus, nx, aufgaben()), 'pri', 'data-act="next"')); }
    else if (aus && fort && fort.gewertet === fort.gesamt && on) { row.insertAdjacentHTML('beforeend', btn('Abgeben', 'pri', 'data-act="abgabe"')); b.insertBefore(el('p', 'dl-ok', esc(T.alle)), row); }
    row.insertAdjacentHTML('beforeend', btn('Zur Übersicht', '', 'data-act="back"'));
    const nb = b.querySelector('[data-act=next]'); if (nb) nb.onclick = () => startAufgabe(aus.wid, nx, m);
    const ab = b.querySelector('[data-act=abgabe]'); if (ab) ab.onclick = () => abgabe(aus.wid);
    b.querySelector('[data-act=back]').onclick = () => open();
    return { close: m.close };
  }
  function finished(rec) { try { return finishedImpl(rec); } catch (e) { return null; } }

  const ui = { open, finished, abgabe, rangSheet, addText, statusZeile, cfg, T,
    core: { status, zeitraum, tagDatum, fortText, titel, aufgabenListe, naechste, startPlan, abgabePlan, rangZeilen, podiumPlatz, klassenText, statusZeile, fmt } };
  Wt.ui = ui;
  return ui;
});
