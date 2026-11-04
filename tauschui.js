/* tauschui.js - Fehler-Tauschboerse, Oberflaeche (Paket T4, Spec quelle/SPEC-TAUSCH-WETTBEWERB.md 2.1, 2.2, 4.2, 4.5, 6, 7).
   UMD: im Browser legt das Modul window.Tauschui (nts-Name), window.TauschUI (els-Name) und Tausch.ui / Tausch.loadUi (ana-Name) an, in Node liefert
   require('./tauschui.js') { core, cfg, ... } fuer Tests. Kein Boot-Code ausser: laufende Suche nach dem Neuladen wieder aufnehmen, ?tausch=neu,
   Klick-Sperre. Gezeigt wird sonst erst, wenn jemand etwas aufruft.

   WAS I1 EINBINDEN UND AUFRUFEN MUSS
   1) Script-Tags je Lab-HTML (ana, nts, els): ... badges.js, auswertung.js, duell.js, tausch.js, codebus.js, tauschad-<lab>.js, tauschui.js.
      Auf der Startseite (Werkbank-Zeile): duell.js, tausch.js, codebus.js, tauschui.js (ohne Adapter; dort gibt es Karten, Rueckmeldungen und Gueten,
      Loesen und Bauen laufen im Lab: "Los" oeffnet <labdatei>#t=<Karte>). codebus.js, qr.js, qrscan.js, duell.css werden bei Bedarf nachgeladen.
   2) Werkbank-Knopf "Fehler-Tausch" (und Duell-Lobby): Tauschui.open()  (Uebersicht: Karten, Eigene Karten, Karte bauen/einlesen).
      Statuszeile der Werkbank: Tauschui.statusZeile()  -> '' oder "2 Karten warten" (kein DOM).
   3) Einstiege der Labs (nichts anzupassen):
      nts:  Tauschui.build('nts'), Tauschui.open(text, 'nts');  ana: Tausch.ui.open({ lab, mode:'loesen'|'bauen', code?, api, aktuell? }) / Tausch.loadUi(cb);
      els:  TauschUI.bau(draft, api), TauschUI.einlesen(code, api).  Alle sind duenne Aliasse auf bauen() und einlesen()/los().
   4) Abzeichen: meldet NUR Zaehler ueber Badges.stat (Modus 'max'): tauschloeser (gewertete fremde Karten mit p 100), tauschbau (Karte mit >= 3 gueltigen
      Loesern, davon mindestens einer richtig), tauschguete (Guete >= 80). Die Abzeichen-Daten stehen in badges.js (I1).
   5) Kein CSS-File: ein Stilblock (<= 40 Zeilen) wird beim ersten Oeffnen eingefuegt, duell.css (.dl-*) wird bei Bedarf verlinkt.

   Buchfuehrung (nichts doppelt): nts begint/zaehlt Tipps/wrong/end selbst; els zaehlt Tipps/wrong/end selbst (nicht im Probelauf), begint NICHT;
   ana zaehlt Tipps NICHT (hier ueber Tausch.tipp), begint NICHT, wrong/end im Adapter. tauschui.js ruft Tausch.store.begin nur fuer ana/els (und nur wenn
   die Suche gewertet oder bei ana ein Probelauf ist; Probelauf in els laeuft ohne Speicher) und Tausch.store.cancel nur, wenn der Start scheitert.
   Annahmen:
   U1 Anzeige der Karten: nur Karten-Nr., Lab, Pruefstand, Symptom, Stufe, Anzeigename, gueltig bis. Nie Fehler-Id/-Name, auch nicht im Ergebnis-Sheet
      vor der Aufloesung; der Bau-Assistent zeigt die Fehlerliste nur dem Ersteller (Schritt 2), die Diagnose-Liste (els) traegt data-pick.
   U2 Wiederholung einer schon geloesten/aufgegebenen Karte und eigene Karte = Probelauf ohne Wertung und ohne TFE1 (nur der erste Versuch zaehlt).
   U3 Die laufende Suche ueberlebt ein Neuladen nur, wenn der Adapter sie fortsetzen kann (nts, ana); sonst wird sie mit Hinweis abgebrochen.
      Auf Seiten ohne Adapter bleibt der Zustand stehen (Chip mit "Abbrechen"), spaetestens nach 3 Stunden faellt er weg.
   U4 Wechsel-Sperre: waehrend einer Suche werden Auflosen/Fehler zeigen/wuerfeln und Links auf andere Seiten abgefangen (wie duellui BLOCK). */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api || {};
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  let T = root.Tausch || null; if (!T) { try { if (typeof require === 'function') T = require('./tausch.js'); } catch (e) { T = null; } }
  if (!T || !T.core) return null;
  const C = T.core, S = T.store, WT = T.WT;
  const Dl = () => { if (root.Duell && root.Duell.core) return root.Duell; try { if (typeof require === 'function') return require('./duell.js'); } catch (e) {} return null; };
  const tippKosten = () => { const d = Dl(); return d && d.W ? d.W.tipp : 5; };
  const hasDoc = () => typeof document !== 'undefined' && !!document.body;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const arr = a => Array.isArray(a) ? a : [];
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const p2 = n => String(n).padStart(2, '0');
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const MAXMS = 3 * 3600 * 1000;

  /* ================= Daten fuer die Anzeige (nur oeffentliche Angaben) ================= */
  const LABS = { nts: 'Netzteil-Lab', ana: 'Analogtechnik-Lab', els: 'Sicherheits-Lab' };
  const FILES = { nts: 'ntslab.html', ana: 'analab.html', els: 'elslab.html' };
  const RIGN = {
    nts: { fehler: 'Fehlersuche am Netzteil' }, els: { pruefplatz: 'Prüfplatz Geräteprüfung' },
    ana: { diode: 'Dioden, LED und Z-Diode', schalter: 'Transistor als Schalter', emitter: 'Emitterschaltung', folger: 'Kollektorschaltung und Grundschaltungen',
      opv_inv: 'Invertierender Verstärker und Summierer', opv_nin: 'Nichtinvertierender Verstärker, Folger und Differenzverstärker', opv_komp: 'Komparator, Schmitt-Trigger und Rechteckgenerator',
      opv_aktiv: 'Integrierer, Differenzierer, aktive Filter und realer OPV' }
  };
  const SYML = {
    nts: { 'kein-ausgang': 'Kein Ausgang', 'brummt': 'Es brummt', 'zu-niedrig': 'Ausgangsspannung zu niedrig', 'zu-hoch': 'Ausgangsspannung zu hoch', 'wird-heiss': 'Das Gerät wird heiß', 'schwingt': 'Der Ausgang schwingt' },
    ana: { 'werte-falsch': 'Messwerte stimmen nicht', 'led-dunkel': 'LED bleibt dunkel', 'kein-strom': 'Es fließt kein Strom', 'strom-zu-hoch': 'Strom zu hoch', 'last-bleibt-aus': 'Last schaltet nicht ein',
      'last-dauernd-an': 'Last bleibt dauernd an', 'wird-heiss': 'Wird heiß', 'kein-ausgang': 'Kein Ausgang', 'verstaerkt-wenig': 'Verstärkt zu wenig', 'verstaerkt-falsch': 'Verstärkung stimmt nicht',
      'arbeitspunkt-falsch': 'Arbeitspunkt verschoben', 'verzerrt': 'Ausgang verzerrt', 'uebersteuert': 'Ausgang an der Grenze', 'kippt-nicht': 'Kippt nicht', 'schwingt-nicht': 'Schwingt nicht',
      'ausgang-fest': 'Ausgang bleibt fest', 'laeuft-weg': 'Ausgang läuft weg' },
    els: { 'routine': 'Wiederholungsprüfung fällig', 'reparatur': 'Zurück aus der Reparatur', 'rcd-loest': 'RCD löst beim Kunden aus', 'kribbeln': 'Kunde spürt ein Kribbeln',
      'heruntergefallen': 'Gerät ist heruntergefallen', 'feuchter-raum': 'Gerät stand im Feuchtraum' }
  };
  const labName = l => LABS[l] || String(l || '');
  const rigName = (l, r) => (RIGN[l] && RIGN[l][r]) || String(r || '').replace(/_/g, ' ');
  const symLabel = (l, s) => (SYML[l] && SYML[l][s]) || String(s || '').replace(/-/g, ' ');
  const labFile = l => (root.LAB_REG && root.LAB_REG[l] && root.LAB_REG[l].file) || FILES[l] || (l + 'lab.html');
  const cardUrl = (code, lab) => { const rel = labFile(lab) + '#t=' + code; try { return typeof location !== 'undefined' && location.href ? new URL(rel, location.href).href : rel; } catch (e) { return rel; } };
  const WTG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const datum = ms => { const d = new Date(ms); return WTG[d.getDay()] + ' ' + p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.'; };
  const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + p2(s % 60); };
  const KEYN = { netz: 'Netzteil', geraet: 'Prüfling', seed: 'Startwert', modus: 'Modus' };
  const jahrgang = () => { const j = lsGet('lm4.jahrgang').replace(/"/g, '').trim(); return /^\d{4}$/.test(j) ? j : String(new Date().getFullYear()); };
  const appV = () => (typeof root.LAB_VERSION === 'string' && /^v\d{1,3}\.\d{1,4}$/.test(root.LAB_VERSION) ? root.LAB_VERSION : '');

  const TX = {
    titel: 'Fehler-Tausch',
    intro: () => 'Ein Mitazubi baut an einem Prüfstand einen Fehler ein und gibt ihn als Code weiter. Du findest ihn durch Messen. Tipps kosten ' + tippKosten() + ' Punkte, die Auflösung gibt es erst nach der Diagnose. Das ist ein Spiel und keine Bewertung.',
    leer: 'Noch keine Karte da. Lies einen Karten-Code (Text, QR oder Datei) ein.',
    eigeneLeer: 'Du hast noch keine eigene Karte gebaut.',
    nameHinweis: 'Wähle einen Fantasienamen, nicht deinen echten Namen.',
    nameFehler: 'Bitte einen Anzeigenamen mit 2 bis 24 Zeichen eintragen (Buchstaben, Ziffern, _ . -).',
    laeuft: 'Es läuft schon eine Fehlersuche. Beende sie zuerst (Diagnose oder Aufgeben).',
    duell: 'Während eines Duells ist der Fehler-Tausch gesperrt.',
    keinLab: 'Dieses Lab ist hier nicht geladen.',
    aufgabe: 'Beende zuerst die laufende Aufgabe.',
    passtNicht: 'Diese Karte passt nicht mehr zu dieser Version des Labs. Bitte den Ersteller um eine neue Karte.',
    sigFalsch: 'Die Signatur der Karte stimmt nicht (Tippfehler oder geändert). Die Karte wurde nicht übernommen.',
    unlesbar: 'Die Karte ist nicht lesbar oder passt nicht zu dieser App-Version.',
    abgelaufen: 'Die Karte ist abgelaufen.',
    keineKarte: 'Das ist kein gültiger Karten-Code (er beginnt mit TFF1.).',
    unsigniert: 'Ohne Signaturprüfung gelesen (z. B. Datei-Modus).',
    eigen: 'Das ist deine eigene Karte: Du kannst sie nur als Probelauf ohne Wertung lösen.',
    wdh: 'Diese Karte hast du schon gespielt. Die Wiederholung ist ein Probelauf und zählt nicht.',
    startFehler: 'Der Prüfstand ließ sich nicht einstellen.',
    tippGesperrt: 'Stufe 3 (Auflösung) gibt es im Fehler-Tausch nicht. Gib eine Diagnose ab oder gib auf.',
    keinePruefung: 'Der Prüfstand konnte die Karte nicht prüfen.',
    unterbrochen: 'Die Fehlersuche wurde unterbrochen und nicht gewertet (Seite neu geladen).',
    pruefOk: 'Prüfung bestanden: Der Fehler ist am Aufbau zu messen und eindeutig zu finden.',
    nichtOk: 'Prüfung nicht bestanden. ',
    falsch: 'Nicht ganz. Miss weiter und gib eine neue Diagnose ab.',
    fair: 'War das Fehlerbild eindeutig?',
    codeHinweis: 'Der Code enthält nur deinen Anzeigenamen und Zähler, nie deinen Klarnamen. Es wird nichts automatisch gesendet. Zeige ihn deinem Ersteller und auf Wunsch deinem Ausbilder (freiwillig).',
    probe: 'Probelauf ohne Wertung: Es entsteht kein Ergebnis-Code.',
    gueteWeniger: n => 'Noch ' + n + (n === 1 ? ' Rückmeldung' : ' Rückmeldungen') + ' nötig, dann erscheint die Güte (ab ' + WT.nMin + ' verschiedenen Lösern).',
    gueteBitte: 'Bitte prüfen: Niemand hat die Karte richtig gelöst. Dein Ausbilder sieht sie zuerst.'
  };

  /* ================= Karten und Status (Kern ohne DOM) ================= */
  const stGet = (s, now) => S.get(s, now == null ? Date.now() : now);
  function rowOf(e, now, own) {
    const p = C.peek(e.code); if (!p) return null;
    return { cid: p.cid, lab: p.lab, labName: labName(p.lab), rig: p.rig, rigName: rigName(p.lab, p.rig), sym: p.sym, symTxt: symLabel(p.lab, p.sym), st: p.st, k: p.k, bis: p.bis, bisTxt: datum(p.bis),
      status: e.status || '', abgelaufen: now > p.bis, eigen: !!own, code: e.code, t: e.t || p.t };
  }
  /* NUR diese sieben Angaben (Karten-Nr., Lab, Pruefstand, Symptom, Stufe, Anzeigename, gueltig bis) */
  const rowText = r => 'Karte ' + r.cid + ' · ' + r.labName + ' · ' + r.rigName + ' · ' + r.symTxt + ' · Stufe ' + r.st + ' · ' + r.k + ' · gültig bis ' + r.bisTxt;
  function inboxRows(now, s) { now = now == null ? Date.now() : now; const st = stGet(s, now); return st.inbox.map(e => rowOf(e, now, S.isOwn(e.cid, st))).filter(Boolean).sort((a, b) => b.t - a.t); }
  function ownRows(now, s) { now = now == null ? Date.now() : now; const st = stGet(s, now); return st.eigene.map(e => rowOf({ code: e.code, t: e.t, status: '' }, now, true)).filter(Boolean).sort((a, b) => b.t - a.t); }
  const warten = (now, s) => inboxRows(now, s).filter(r => r.status === 'neu' && !r.abgelaufen && !r.eigen).length;
  function statusZeile(now, s) { try { const n = warten(now, s); return n ? n + (n === 1 ? ' Karte wartet' : ' Karten warten') : ''; } catch (e) { return ''; } }
  const statusText = { neu: 'neu', laeuft: 'läuft', geloest: 'gelöst', aufgegeben: 'aufgegeben', probe: 'Probelauf' };

  /* Guete der eigenen Karte aus den gespeicherten Rueckmeldungen. -> Promise { n, gk|null, fehlt, pruefen, gesamt, unsigniert, text } */
  async function gueteInfo(cid, s, now) {
    now = now == null ? Date.now() : now; const st = stGet(s, now), e = st.eigene.find(x => x.cid === cid); if (!e) return null;
    const v = await C.verifyCard(e.code, { now }); if (!v || !v.card || !v.hidden) return null;
    const list = arr(st.rueck[cid]), ergs = list.length ? await C.verifyErgs(list.join('\n'), { card: v.card, hidden: v.hidden, now }) : [];
    const g = C.guete(ergs, v.card);
    const out = Object.assign({}, g, { gesamt: ergs.length, unsigniert: ergs.some(x => x.sig === 'unsigniert') });
    out.text = gueteText(out); return out;
  }
  function gueteText(g) {
    if (!g) return '';
    if (g.gk == null) return g.gesamt && g.gesamt > g.n ? TX.gueteWeniger(g.fehlt) + ' (' + g.n + ' von ' + g.gesamt + ' gültig)' : TX.gueteWeniger(g.fehlt);
    if (g.pruefen) return 'Güte 0 von 100. ' + TX.gueteBitte;
    return 'Güte ' + g.gk + ' von 100 · gelöst ' + Math.round(g.q * 100) + ' % · Messbedarf ' + Math.round(g.M * 100) + ' % · eindeutig ' + Math.round(g.F * 100) + ' % (' + g.n + ' gültige Löser)';
  }
  function badgeStats(g) {
    try {
      const B = root.Badges; if (!B || typeof B.stat !== 'function') return;
      if (g && g.gk != null && g.n >= WT.nMin && g.q > 0) B.stat('tauschbau', 1, 'max');
      if (g && g.gk != null && g.gk >= 80) B.stat('tauschguete', 1, 'max');
    } catch (e) {}
  }
  function loeserStat(s) { try { const B = root.Badges; if (!B || typeof B.stat !== 'function') return; const n = stGet(s).erg.filter(x => x.p >= 100).length; B.stat('tauschloeser', n, 'max'); } catch (e) {} }
  /* Punkte immer ueber Duell.core.score (Tausch.core.pts), nie eigene Formel */
  function scoreOf(res, entry) { const card = entry && entry.card, hid = entry && entry.hidden; return C.pts({ st: card ? card.st : 2, p: res.p, ms: res.ms, h: res.h, f: res.f, m: res.m == null ? null : res.m, mp: res.mp == null ? null : res.mp }, card, hid); }

  /* ================= Normalisierung der Lab-APIs (nts / ana / els) ================= */
  /* Einheitliche Form: { lab, label, multi, nativeDiag, beginsItself, rigs(), faults(rig,c), choices(), symptoms(rig,f), current(ctx), suggest(rig,c,f[]), check(rig,c,f[],sym),
     cardInput(rig,c,f[],sym,st), start(entry,probe), onDone(cb), tipp(n), giveUp(), diagnose(ids[]), reveal(), running(), mp() }.
     f ist hier immer eine Liste (nts/ana: genau ein Eintrag, els: 1-3). */
  const APIS = {};
  function normApi(raw) {
    if (!raw || typeof raw !== 'object') return null; if (raw.__norm) return raw;
    if (typeof raw.lab !== 'string' || !/^[a-z]{2,5}$/.test(raw.lab)) return null;
    const lab = raw.lab, els = lab === 'els', ana = lab === 'ana', nts = lab === 'nts';
    const call = (f, ...a) => { try { return typeof raw[f] === 'function' ? raw[f](...a) : undefined; } catch (e) { return undefined; } };
    const ad = { __norm: true, lab, raw, label: labName(lab), multi: els || raw.multi === true, nativeDiag: nts || ana || raw.nativeDiag === true, beginsItself: nts };
    const fid = x => ({ id: String(x.id), name: String(x.name || x.label || x.id), ok: x.ok === undefined ? null : x.ok });
    ad.rigs = () => arr(call('rigs')).map(r => (typeof r === 'string' ? { id: r, name: rigName(lab, r) } : { id: String(r.id), name: String(r.name || rigName(lab, r.id)) }));
    ad.faults = (rig, c) => arr(els && c && c.geraet && typeof raw.choices === 'function' ? call('choices', c.geraet) : call('faults', rig, c)).map(fid);
    ad.choices = () => arr(typeof raw.choices === 'function' ? call('choices') : call('faults')).map(fid);
    ad.symptoms = (rig, f) => arr(call('symptoms', rig, ad.multi ? undefined : f)).map(x => (typeof x === 'string' ? { id: x, label: symLabel(lab, x) } : { id: String(x.id), label: String(x.label || x.name || symLabel(lab, x.id)) }));
    ad.current = ctx => {
      ctx = ctx || {};
      const cur = ctx.draft || ctx.aktuell || (ana ? call('aktuell') : els ? null : call('current')) || null;
      if (!cur) return { rig: null, c: null, f: [], sym: null, st: null };
      return { rig: cur.rig || null, c: isObj(cur.c) ? cur.c : null, f: cur.f == null ? [] : (Array.isArray(cur.f) ? cur.f.map(String) : [String(cur.f)]), sym: cur.sym || null, st: cur.st || null };
    };
    ad.suggest = (rig, c, f) => {
      const first = () => { const l = ad.symptoms(rig, f[0]); return l.length ? l[0].id : null; };
      let r = null; c = c || {};
      if (nts) r = { st: call('stufe', f[0], c), sym: first() }; else if (ana) r = call('vorschlag', rig, f[0], c); else if (els) r = call('suggest', f);
      r = isObj(r) ? r : {}; return { st: r.st >= 1 && r.st <= 3 ? Math.round(r.st) : 2, sym: r.sym || first() };
    };
    ad.check = (rig, c, f, sym) => {
      const fa = ad.multi ? f.slice().sort() : f[0]; c = c || {};
      const r = ana ? call('check', { rig, c, f: fa }, {}) : call('check', { rig, c, f: fa, sym }, { ersteller: true });
      if (!isObj(r)) return { ok: false, why: TX.keinePruefung };
      return { ok: !!r.ok, why: String(r.detail || r.why || '') };
    };
    ad.cardInput = (rig, c, f, sym, st) => {
      c = c || {}; let x = null;
      if (ana) { const k = call('karte', { rig, c, f: f[0], st, sym }); x = k && k.ok ? { lab, rig, st: k.pub.st, sym: k.pub.sym, c: k.hidden.c, f: k.hidden.f, mp: k.hidden.mp } : null; }
      else if (els) x = { lab, rig, st, sym, c, f: f.slice().sort(), mp: call('messpunkte', c.geraet) };
      else x = call('cardInput', { rig, c, f: f[0], sym, st }) || null;
      if (x) { x.lab = lab; x.st = st; x.sym = sym; } return x;
    };
    const guard = async fn => { try { return await fn(); } catch (e) { return null; } };
    ad.start = async (entry, probe) => {
      const r = await guard(async () => (ana ? raw.build(entry) : raw.build(entry, { probe: !!probe })));
      return r && r.ok ? { ok: true } : { ok: false, why: r && r.why ? String(r.why) : TX.startFehler };
    };
    ad.onDone = cb => {
      const u = call('diagnosed', o => { o = o || {}; cb({ richtig: o.richtig === true || o.ok === true, aufgegeben: !!o.aufgegeben, f: o.f, res: o.res || o.rec || null, fnd: o.fnd || (o.res && o.res.fnd) || null }); });
      return typeof u === 'function' ? u : () => {};
    };
    /* Tipps: nts und els zaehlen selbst (Stufe 3 = gesperrt); ana liefert nur Text, hier wird ueber Tausch.tipp gezaehlt */
    ad.tipp = n => {
      const r = call('tipp', n);
      if (ana) {
        if (typeof r !== 'string' || !r) return { blocked: true, text: TX.tippGesperrt };
        let g = 0; while (g++ < 3) { const c = S.cur(null); if (!c || !c.start || (c.h || 0) >= n) break; const x = T.tipp(); if (!x || x.blocked) break; }
        return { text: r };
      }
      if (!r || r.gesperrt || r.blocked) return { blocked: true, text: TX.tippGesperrt };
      return { text: String(r.text || '') };
    };
    ad.giveUp = () => { const x = ana ? call('giveUp') : call('aufgeben'); if (!x) return { res: null }; return { res: x.cid ? x : (x.res || x.rec || null) }; };
    ad.diagnose = ids => { ids = arr(ids); return ana ? call('judge', ids[0]) : (els || ad.multi ? call('diagnose', ids) : call('diagnose', ids[0])); };
    ad.reveal = () => {
      const x = call('aufloesung'); if (!x) return null;
      if (nts) return { name: String(x.name || ''), text: String(x.ursache || '') };
      if (ana) return { name: String(x.label || ''), text: '' };
      if (els) return { name: arr(x.names).join(', '), text: x.geraet ? 'Prüfling: ' + x.geraet : '' };
      return { name: String(x.name || x.label || ''), text: String(x.text || '') };
    };
    ad.running = () => { try { if (typeof raw.active === 'function') return !!raw.active(); if (typeof raw.current === 'function') return !!raw.current(); } catch (e) {} return false; };
    ad.mp = () => call('messpunkte');
    ad.checkEntry = entry => { if (typeof raw.check !== 'function') return true; const r = call('check', entry, { loeser: true }); return !!(r && r.ok); };
    return ad;
  }
  function register(raw) { const n = normApi(raw); if (n) APIS[n.lab] = n; return n; }
  function adapterFor(lab) {
    [root.LabTauschAPI, lab === 'els' && root.ElsTausch && root.ElsTausch.api, lab === 'ana' && root.TauschAdAna].forEach(raw => { if (raw && raw.lab === lab && !(APIS[lab] && APIS[lab].raw === raw)) register(raw); });
    return APIS[lab] || null;
  }
  function ensureAdapter(lab) {
    return new Promise(res => {
      const a = adapterFor(lab); if (a || !hasDoc() || !/^(nts|ana|els)$/.test(lab)) { res(a); return; }
      const s = document.createElement('script'); s.src = 'tauschad-' + lab + '.js'; s.onload = () => res(adapterFor(lab)); s.onerror = () => res(null); document.head.appendChild(s);
    });
  }

  /* ================= Laufende Suche (Zustand im Speicher, Zaehler im Tausch.store) ================= */
  let RUN = null, LAST = null;
  const blocked = () => { try { return !!(T.active() || (RUN && !RUN.done)); } catch (e) { return false; } };
  const cfg = { nav: u => { location.href = u; }, cd: true };

  /* ================= DOM ================= */
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const CSS = '.tu-row{display:flex;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--dl-line);flex-wrap:wrap}.tu-tx{flex:1 1 220px;min-width:0;overflow-wrap:anywhere}.tu-tx small{display:block}'
    + '.tu-row .dl-btn{flex:none;min-width:84px}.tu-sec{margin:14px 0 4px;font-weight:700}.tu-list{max-height:44vh;overflow:auto;border:1px solid var(--dl-line);border-radius:10px;padding:2px 10px;margin:6px 0}'
    + '.dl label.tu-opt{display:flex;align-items:center;gap:10px;min-height:44px;margin:0;font-size:15px;color:var(--dl-fg);cursor:pointer;overflow-wrap:anywhere}.tu-opt input{width:22px;height:22px;flex:none}'
    + '.tu-steps{display:flex;gap:6px;margin:2px 0 10px}.tu-steps span{flex:1;height:6px;border-radius:3px;background:var(--dl-line)}.tu-steps .on{background:var(--dl-acc)}'
    + '.tu-ok{color:var(--dl-ok)}.tu-no{color:var(--dl-bad)}.tu-box .dl-tbl td{overflow-wrap:anywhere}'
    + '#tauschChip{height:44px;border-radius:22px;gap:6px}#tauschChip button{height:44px;min-width:44px;border-radius:22px}#tauschChip .dl-n{font-size:14px}'
    + 'html:has(#tauschChip) body>header,html:has(#tauschChip) #app>header,html:has(#tauschChip) body>.app>header{padding-top:calc(60px + env(safe-area-inset-top))!important}'
    + '@media (max-width:599px){#tauschChip{gap:4px;padding-left:8px}#tauschChip .dl-n{display:none}}@media (max-width:480px){.tu-row .dl-btn{flex:1 1 100%}}';
  function ensureUi() {
    if (!hasDoc()) return;
    if (!document.querySelector('link[href$="duell.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'duell.css'; document.head.appendChild(l); }
    if (!document.getElementById('tuCss')) { const s = document.createElement('style'); s.id = 'tuCss'; s.textContent = CSS; document.head.appendChild(s); }
  }
  function toast(msg) {
    if (!hasDoc()) return; ensureUi();
    const old = document.getElementById('tuToast'); if (old) old.remove();
    const t = el('div', 'dl dl-toast', esc(msg)); t.id = 'tuToast'; t.setAttribute('role', 'status'); document.body.appendChild(t); setTimeout(() => t.remove(), 3800);
  }
  function modal(title) {
    ensureUi();
    const old = document.getElementById('tuBox'); if (old && old.__close) old.__close(false); else if (old) old.remove();
    const back = document.activeElement;
    const ov = el('div', 'dl dl-ov'); ov.id = 'tuBox';
    const box = el('div', 'dl-box tu-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const hd = el('div', 'dl-hd', '<b>' + esc(title) + '</b>'), x = el('button', 'dl-x0', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Schließen'); hd.appendChild(x);
    const body = el('div'); box.appendChild(hd); box.appendChild(body); ov.appendChild(box); document.body.appendChild(ov);
    const key = e => { if (e.key === 'Escape' && !document.getElementById('cbBox')) close(true); };
    function close(focus) { ov.remove(); document.removeEventListener('keydown', key, true); if (focus !== false && back && back.focus && document.contains(back)) { try { back.focus(); } catch (e) {} } }
    ov.__close = close; x.onclick = () => close(true); ov.addEventListener('mousedown', e => { if (e.target === ov) close(true); }); document.addEventListener('keydown', key, true);
    setTimeout(() => { try { x.focus(); } catch (e) {} }, 0);
    return { ov, box, body, close };
  }
  const btn = (label, cls, attrs, aria) => '<button type="button" class="dl-btn' + (cls ? ' ' + cls : '') + '"' + (attrs ? ' ' + attrs : '') + (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + esc(label) + '</button>';
  function withCodebus(cb) {
    if (root.Codebus) { cb(root.Codebus); return; }
    const s = document.createElement('script'); s.src = 'codebus.js'; s.onload = () => { if (root.Codebus) cb(root.Codebus); else toast('Weitergeben und Einlesen sind nicht verfügbar.'); }; s.onerror = () => toast('Weitergeben und Einlesen sind nicht verfügbar.'); document.head.appendChild(s);
  }
  function countdown(done) {
    if (!cfg.cd) { done(); return; }
    let n = 3; const ov = el('div', 'dl dl-cd'); ov.setAttribute('role', 'timer'); ov.setAttribute('aria-live', 'assertive'); document.body.appendChild(ov);
    const step = () => { if (n > 0) { ov.textContent = n--; try { if (root.LochFX) root.LochFX.sound('tick'); } catch (e) {} setTimeout(step, 800); } else { ov.remove(); done(); } };
    step();
  }
  const busyMsg = () => { if (blocked()) return TX.laeuft; try { if (root.Duell && typeof root.Duell.active === 'function' && root.Duell.active()) return TX.duell; } catch (e) {} return ''; };
  const kuerzel = () => S.kuerzel(null) || '';
  const gruppe = c => { const o = c || {}; const k = Object.keys(o); return k.length ? k.map(x => (KEYN[x] || x) + ': ' + o[x]).join(', ') : ''; };
  function nameForm(host, onOk) {
    host.innerHTML = '<p>Dein Code trägt einen Anzeigenamen, den dein Ersteller und dein Ausbilder sehen.</p><label for="tuK">Dein Anzeigename</label><input type="text" id="tuK" maxlength="24" autocomplete="off" autocapitalize="off" placeholder="z. B. blitz07" value="' + esc(lsGet('lm4.kuerzel').replace(/"/g, '')) + '">'
      + '<p><b>' + esc(TX.nameHinweis) + '</b></p><div class="dl-err" id="tuKE" role="alert"></div><div class="dl-row">' + btn('Speichern und weiter', 'pri', 'data-act="nameok"') + '</div>';
    const inp = host.querySelector('#tuK');
    host.querySelector('[data-act=nameok]').onclick = () => { const v = inp.value.trim(); if (!Dl().core.KRE.test(v)) { host.querySelector('#tuKE').textContent = TX.nameFehler; return; } lsSet('lm4.kuerzel', v); onOk(v); };
    try { inp.focus(); } catch (e) {}
  }

  /* ---------- Chip oben ---------- */
  let chipEl = null, chipT = 0;
  const curH = () => { const c = S.cur(null); return c ? (c.h || 0) : (RUN ? RUN.h || 0 : 0); };
  function chip() {
    if (!hasDoc()) return;
    if (!blocked()) { if (chipT) clearInterval(chipT); chipT = 0; if (chipEl) { chipEl.remove(); chipEl = null; } return; }
    ensureUi();
    if (!chipEl) {
      chipEl = el('div', 'dl dl-chip'); chipEl.id = 'tauschChip'; chipEl.setAttribute('role', 'group'); chipEl.setAttribute('aria-label', 'Fehler-Tausch');
      chipEl.innerHTML = '<span class="dl-n"></span><span class="dl-t" aria-live="off"></span><span class="dl-m dl-h"></span><span class="dl-m dl-v"></span>'
        + '<button type="button" class="dl-tip" aria-label="Tipp holen">💡<span class="dl-m"> Tipp</span></button>'
        + '<button type="button" class="dl-dx" aria-label="Diagnose abgeben" hidden>🩺<span class="dl-m"> Diagnose</span></button>'
        + '<button type="button" class="dl-xx" aria-label="Fehlersuche aufgeben">✕<span class="dl-m"> Aufgeben</span></button>';
      document.body.appendChild(chipEl); let sure = 0;
      chipEl.querySelector('.dl-tip').onclick = () => tippSheet();
      chipEl.querySelector('.dl-dx').onclick = () => diagSheet();
      chipEl.querySelector('.dl-xx').onclick = e => {
        const bt = e.currentTarget;
        if (!sure) { sure = 1; bt.classList.add('sure'); bt.textContent = 'Sicher?'; setTimeout(() => { sure = 0; bt.classList.remove('sure'); bt.innerHTML = '✕<span class="dl-m"> Aufgeben</span>'; }, 3000); return; }
        sure = 0; aufgeben();
      };
    }
    const tick = () => {
      if (!blocked()) { chip(); return; }
      const c = S.cur(null), start = c ? c.start : (RUN ? RUN.start : Date.now()), h = curH(), tr = c ? (c.tries || 0) : (RUN ? RUN.tries || 0 : 0);
      if (c && Date.now() - c.start > MAXMS) { S.cancel(null); if (RUN) RUN.done = true; chip(); toast('Die Fehlersuche ist nach 3 Stunden abgelaufen.'); return; }
      chipEl.querySelector('.dl-n').textContent = '🔁 ' + ((c && c.cid) || (RUN && RUN.cid) || '');
      chipEl.querySelector('.dl-t').textContent = fmt(Date.now() - start);
      chipEl.querySelector('.dl-h').textContent = 'Tipps ' + h + (h ? ' (−' + h * tippKosten() + ')' : '');
      chipEl.querySelector('.dl-v').textContent = 'Versuche ' + tr;
      const dx = chipEl.querySelector('.dl-dx'); dx.hidden = !(RUN && !RUN.done && !RUN.ad.nativeDiag);
      chipEl.querySelector('.dl-tip').hidden = !(RUN && !RUN.done);
    };
    tick(); if (!chipT) chipT = setInterval(tick, 500);
  }

  /* ---------- Tipps ---------- */
  function tippSheet() {
    const run = RUN; if (!run || run.done || !hasDoc()) return null;
    const m = modal('Tipp'), cost = tippKosten();
    const view = () => {
      const h = curH(), l = [];
      for (let i = 1; i <= Math.min(h, WT.hMax); i++) { const r = run.ad.tipp(i); l.push('<div class="dl-card"><div class="dl-mute">Tipp ' + i + '</div>' + esc(r.text || '') + '</div>'); }
      const mehr = h < WT.hMax;
      m.body.innerHTML = (l.length ? l.join('') : '<p>Tipps kosten ' + cost + ' Punkte je Stufe' + (run.probe ? ' (im Probelauf ohne Abzug)' : '') + '. Probiere zuerst eine weitere Messung.</p>')
        + (mehr ? '' : '<p><small>' + esc(TX.tippGesperrt) + '</small></p>')
        + '<div class="dl-row">' + (mehr ? btn('Tipp ' + (h + 1) + ' holen (−' + cost + ' Punkte)', 'pri', 'data-act="tip"') : '') + btn('Schließen', '', 'data-act="x"') + '</div>';
      const b = m.body.querySelector('[data-act=tip]'); if (b) b.onclick = () => { const r = run.ad.tipp(h + 1); if (r.blocked) toast(r.text); else { run.h = Math.max(run.h || 0, h + 1); } chip(); view(); };
      m.body.querySelector('[data-act=x]').onclick = () => m.close(true);
    };
    view(); return m;
  }
  /* Diagnose-Liste (nur Labs ohne eigene Diagnose-Taste, z. B. els): Auswahl ist ein Stellmittel, kein Hinweis */
  function diagSheet() {
    const run = RUN; if (!run || run.done || !hasDoc()) return null;
    const m = modal('Diagnose abgeben'), l = run.ad.choices();
    m.body.innerHTML = '<p>' + (run.ad.multi ? 'Wähle alle Mängel, die du gefunden hast.' : 'Wähle den gefundenen Fehler.') + '</p><div class="tu-list" data-pick="1" role="group" aria-label="Auswahl zur Diagnose">'
      + l.map((x, i) => '<label class="tu-opt"><input type="' + (run.ad.multi ? 'checkbox' : 'radio') + '" name="tuD" value="' + esc(x.id) + '"> <span>' + esc(x.name) + '</span></label>').join('') + '</div>'
      + '<div class="dl-err" id="tuDE" role="alert"></div><div class="dl-row">' + btn('Diagnose abgeben', 'pri', 'data-act="d"') + btn('Abbrechen', '', 'data-act="x"') + '</div>';
    m.body.querySelector('[data-act=x]').onclick = () => m.close(true);
    m.body.querySelector('[data-act=d]').onclick = () => {
      const ids = [].map.call(m.body.querySelectorAll('input:checked'), i => i.value);
      if (!ids.length) { m.body.querySelector('#tuDE').textContent = 'Bitte mindestens eine Auswahl treffen.'; return; }
      m.close(true); run.ad.diagnose(ids);
    };
    return m;
  }

  /* ---------- Start (Loeser) ---------- */
  function verifyText(v) {
    if (!v || !Array.isArray(v.flags)) return TX.keineKarte;
    if (v.flags.indexOf('sig_falsch') >= 0) return TX.sigFalsch;
    if (v.flags.indexOf('ungueltig') >= 0) return TX.unlesbar;
    if (v.flags.indexOf('abgelaufen') >= 0) return TX.abgelaufen;
    return '';
  }
  /* Karte aus Text lesen und in den Eingang legen. -> Promise { ok, why, cid, v } */
  async function nimm(text, own) {
    const v = await C.verifyCard(text, { now: Date.now() }); const w = verifyText(v); if (w) return { ok: false, why: w };
    const cid = S.addInbox(v.code, null, Date.now()); if (!cid) return { ok: false, why: TX.unlesbar };
    return { ok: true, cid, v };
  }
  /* los(code, { probe? }): pruefen, 3-2-1, Adapter-build, Chip */
  async function los(code, opt) {
    opt = opt || {};
    const v = await C.verifyCard(code, { now: Date.now() }), w = verifyText(v); if (w) { toast(w); return null; }
    const b = busyMsg(); if (b) { toast(b); return null; }
    const card = v.card, lab = card.lab, cid = card.cid;
    S.addInbox(v.code, null, Date.now());
    let ad = adapterFor(lab);
    if (!ad) {
      const onLab = typeof location !== 'undefined' && location.pathname.endsWith(labFile(lab));
      if (hasDoc() && !onLab && /^(nts|ana|els)$/.test(lab)) { toast('Die Karte öffnet sich im ' + labName(lab) + '.'); cfg.nav(labFile(lab) + '#t=' + v.code); return null; }
      ad = await ensureAdapter(lab); if (!ad) { toast(TX.keinLab); return null; }
    }
    const st = stGet(null), e = st.inbox.find(x => x.cid === cid), eigen = S.isOwn(cid, st);
    const probe = !!(opt.probe || eigen || (e && (e.status === 'geloest' || e.status === 'aufgegeben')));
    if (!ad.checkEntry(v)) { toast(TX.passtNicht); return null; }
    if (typeof document !== 'undefined' && document.getElementById('tuBox')) { const bx = document.getElementById('tuBox'); if (bx.__close) bx.__close(false); }
    return new Promise(res => countdown(async () => {
      const b2 = busyMsg(); if (b2) { toast(b2); res(null); return; }
      const needBegin = !ad.beginsItself && !(probe && ad.lab === 'els');
      let began = false; if (needBegin) { if (!S.begin(cid, null, Date.now())) { toast(TX.laeuft); res(null); return; } began = true; }
      const r = await ad.start(v, probe);
      if (!r.ok) { if (began) S.cancel(null); toast(r.why || TX.startFehler); res(null); return; }
      RUN = { cid, entry: v, ad, probe, wdh: !eigen && probe, start: Date.now(), h: 0, tries: 0, done: false, unsub: null, tipps: 0 };
      RUN.unsub = ad.onDone(o => onDiag(RUN, o));
      S.setStatus(cid, probe ? 'probe' : 'laeuft', null, Date.now());
      chip(); toast(probe ? 'Probelauf läuft. Miss und gib eine Diagnose ab.' : 'Los! Miss und gib eine Diagnose ab.');
      res(RUN);
    }));
  }
  function onDiag(run, o) {
    if (!run || run.done) return;
    if (o.richtig || o.aufgegeben) { setTimeout(() => finish(run, o), 150); return; }
    run.tries = (run.tries || 0) + 1; chip(); toast(TX.falsch);
  }
  function aufgeben() {
    if (RUN && !RUN.done) { const x = RUN.ad.giveUp(); finish(RUN, { richtig: false, aufgegeben: true, res: x.res }); return; }
    S.cancel(null); chip(); toast('Die Fehlersuche wurde abgebrochen.');
  }

  /* ---------- Ergebnis ---------- */
  function finish(run, o) {
    if (!run || typeof run !== 'object' || run.done || !run.entry || !isObj(o)) return null; run.done = true; try { if (run.unsub) run.unsub(); } catch (e) {}
    const p = o.richtig ? 100 : 0, now = Date.now(), c = S.cur(null);
    let res = o.res && isObj(o.res) ? Object.assign({}, o.res) : { cid: run.cid, t: now, ms: Math.max(0, now - run.start), p, h: Math.min(WT.hMax, run.h || 0), f: run.tries || 0 };
    res.p = p; if (!res.cid) res.cid = run.cid;
    if (o.fnd) res.fnd = o.fnd;
    S.setStatus(run.cid, run.probe ? 'probe' : (p >= 100 ? 'geloest' : 'aufgegeben'), null, now);
    RUN = null; chip();
    if (!run.probe) { const sc = scoreOf(res, run.entry); S.addErg({ cid: run.cid, t: res.t || now, pts: sc.pts, p, ms: res.ms, h: res.h, f: res.f, m: res.m, b: '', code: '' }, null, now); loeserStat(null); }
    LAST = { run, res, o };
    return ergebnis(run, res, o);
  }
  /* TFE1 aus dem Ergebnis (Tausch.core.makeErg) und im Speicher zum Ergebnis ablegen. -> Promise Code|null */
  async function ergCode(run, res, o, fair, k) {
    const rec = { card: run.entry.card, k: k || kuerzel(), j: jahrgang(), t: res.t || Date.now(), ms: res.ms, p: res.p, h: res.h, f: res.f, m: res.m, mp: res.mp, fair: fair == null ? null : fair, fnd: res.fnd || (o && o.fnd) || null, app: appV() };
    const code = await C.makeErg(rec, {}); if (!code) return null;
    const st = stGet(null), e = st.erg.slice().reverse().find(x => x.cid === run.cid);
    if (e) { const pe = C.parseErgs(code)[0]; e.code = code; e.b = pe && pe.rec ? pe.rec.b : ''; S.save(st, null); }
    return code;
  }
  function ergebnis(run, res, o) {
    if (!hasDoc()) return null;
    const p = res.p, sc = run.probe ? null : scoreOf(res, run.entry), rv = run.ad.reveal(), m = modal(run.probe ? 'Probelauf beendet' : (p >= 100 ? '🏁 Gefunden' : 'Aufgegeben'));
    let fair = null;
    const info = '<p>Zeit ' + fmt(res.ms) + ' · Versuche ' + (res.f || 0) + ' · Tipps ' + (res.h || 0) + (res.m != null ? ' · Messungen ' + res.m : '') + '</p>';
    const auf = rv ? '<div class="dl-card"><div class="dl-mute">Auflösung</div><b>' + esc(rv.name) + '</b>' + (rv.text ? '<p>' + esc(rv.text) + '</p>' : '') + '</div>' : '';
    const punkte = sc ? '<div class="dl-card"><div class="dl-mute">Dein Wert</div><div class="dl-big">' + sc.pts + '</div><table class="dl-tbl"><tbody><tr><td>Richtigkeit</td><td class="n">' + sc.R + '</td></tr><tr><td>Aufwand</td><td class="n">' + sc.A + '</td></tr><tr><td>Zeit</td><td class="n">' + sc.Z + '</td></tr><tr><td>Tipp-Abzug</td><td class="n">−' + sc.T + '</td></tr></tbody></table></div>' : '';
    const kopf = '<p><small>' + esc(rowText(rowOf({ code: run.entry.code, status: '' }, Date.now(), false) || {})) + '</small></p>';
    if (run.probe) {
      m.body.innerHTML = '<p>' + esc(run.wdh ? TX.wdh : TX.eigen) + ' ' + esc(TX.probe) + '</p>' + info + auf + '<div class="dl-row">' + btn('Fertig', 'pri', 'data-act="x"') + '</div>';
      m.body.querySelector('[data-act=x]').onclick = () => m.close(true); return m;
    }
    const view = nameFirst => {
      if (nameFirst) { nameForm(m.body, () => view(false)); return; }
      m.body.innerHTML = kopf + punkte + info + auf
        + '<p class="tu-sec">' + esc(TX.fair) + '</p><div class="dl-seg" role="group" aria-label="Fairness-Stimme"><button type="button" class="dl-btn" data-fair="1" aria-pressed="false">Ja</button><button type="button" class="dl-btn" data-fair="0" aria-pressed="false">Nein</button></div>'
        + '<p><small>' + esc(TX.codeHinweis) + '</small></p><div class="dl-err" id="tuE" role="alert"></div>'
        + '<div class="dl-row">' + btn('Ergebnis-Code erzeugen', 'pri', 'data-act="code"') + btn('Fertig', '', 'data-act="x"') + '</div>';
      [].forEach.call(m.body.querySelectorAll('[data-fair]'), b => { b.onclick = () => { const v = +b.dataset.fair; fair = fair === v ? null : v; [].forEach.call(m.body.querySelectorAll('[data-fair]'), q => q.setAttribute('aria-pressed', String(fair !== null && +q.dataset.fair === fair))); }; });
      m.body.querySelector('[data-act=x]').onclick = () => m.close(true);
      m.body.querySelector('[data-act=code]').onclick = async () => {
        const k = kuerzel(); if (!k) { view(true); return; }
        const code = await ergCode(run, res, o, fair, k);
        if (!code) { m.body.querySelector('#tuE').textContent = 'Der Code konnte nicht erstellt werden.'; return; }
        m.body.querySelector('#tuE').textContent = '';
        withCodebus(cb => cb.send(code, { title: 'Ergebnis weitergeben' }));
      };
    };
    view(false); return m;
  }

  /* ---------- Rueckmeldungen einlesen (Ersteller) ---------- */
  function rueckEinlesen(onDone) {
    withCodebus(cb => cb.receive({ title: 'Rückmeldungen einlesen', accept: /^TFE1\./,
      onCode: code => {
        const e = C.parseErgs(code)[0]; if (!e || !e.rec) return 'Kein lesbares Ergebnis.';
        if (!S.isOwn(e.rec.cid)) return 'Gehört nicht zu einer deiner Karten.';
        return S.addRueck(e.rec.cid, code) ? true : 'Schon vorhanden.';
      },
      onDone: list => { if (typeof onDone === 'function') onDone(list); } }));
  }
  /* ---------- Karte einlesen (Loeser) ---------- */
  function karteEinlesen(onDone) {
    withCodebus(cb => cb.receive({ title: 'Karte einlesen', accept: /^TFF1\./,
      onCode: code => {
        const p = C.parseCards(code)[0]; if (!p || !p.card) return TX.unlesbar; if (Date.now() > p.card.bis) return TX.abgelaufen;
        if (!S.addInbox(p.code, null, Date.now())) return TX.unlesbar;
        C.verifyCard(p, { now: Date.now() }).then(v => { if (v && v.flags.indexOf('sig_falsch') >= 0) { const st = stGet(null); st.inbox = st.inbox.filter(x => x.cid !== p.card.cid); S.save(st, null); toast(TX.sigFalsch); } });
        return true;
      },
      onDone: list => { if (typeof onDone === 'function') onDone(list); } }));
  }

  /* ---------- Uebersicht (Werkbank-Zeile) ---------- */
  function overview() {
    if (!hasDoc()) return null;
    const m = modal(TX.titel), now = Date.now(), inb = inboxRows(now), own = ownRows(now);
    const pageLab = (() => { for (const l of ['nts', 'ana', 'els']) if (adapterFor(l)) return l; return ''; })();
    const row = (r, mine) => '<div class="tu-row" role="group" aria-label="Karte ' + esc(r.cid) + '"><div class="tu-tx">' + esc(rowText(r)) + '<small>' + (mine ? '<span class="tu-g" data-g="' + esc(r.cid) + '">Güte wird gelesen …</span>' : esc((statusText[r.status] || '') + (r.abgelaufen ? ' · abgelaufen' : ''))) + '</small></div>'
      + (mine ? btn('Weitergeben', '', 'data-act="send" data-cid="' + r.cid + '"', 'Karte ' + r.cid + ' weitergeben') + btn('Probelauf', '', 'data-act="probe" data-cid="' + r.cid + '"', 'Probelauf mit Karte ' + r.cid)
        : (r.abgelaufen ? '' : btn(r.status === 'geloest' || r.status === 'aufgegeben' ? 'Nochmal' : (r.eigen ? 'Probelauf' : 'Los'), r.status === 'neu' ? 'pri' : '', 'data-act="los" data-cid="' + r.cid + '"', (r.eigen ? 'Probelauf mit Karte ' : 'Karte ') + r.cid + ' starten'))) + '</div>';
    m.body.innerHTML = '<p>' + esc(TX.intro()) + '</p>'
      + (blocked() ? '<div class="dl-card"><b>Eine Fehlersuche läuft.</b> ' + btn('Suche abbrechen', '', 'data-act="abbr"') + '</div>' : '')
      + '<p class="tu-sec">Karten für dich</p>' + (inb.length ? inb.map(r => row(r, false)).join('') : '<p><small>' + esc(TX.leer) + '</small></p>')
      + '<p class="tu-sec">Meine Karten</p>' + (own.length ? own.map(r => row(r, true)).join('') : '<p><small>' + esc(TX.eigeneLeer) + '</small></p>')
      + '<div class="dl-row">' + btn('Karte einlesen', 'pri', 'data-act="lesen"') + btn(pageLab ? 'Karte bauen' : 'Karte bauen (im Lab)', '', 'data-act="bauen"') + btn('Rückmeldungen einlesen', '', 'data-act="rueck"') + '</div><div class="dl-err" id="tuE" role="status"></div>';
    const errOut = t => { const e = m.body.querySelector('#tuE'); if (e) e.textContent = t || ''; };
    const code = cid => { const st = stGet(null); const e = st.eigene.find(x => x.cid === cid) || st.inbox.find(x => x.cid === cid); return e ? e.code : ''; };
    m.body.onclick = ev => {
      const b = ev.target.closest ? ev.target.closest('[data-act]') : null; if (!b) return; const a = b.dataset.act, cid = b.dataset.cid;
      if (a === 'abbr') { S.cancel(null); if (RUN) { try { RUN.unsub && RUN.unsub(); } catch (e) {} RUN = null; } chip(); overview(); }
      else if (a === 'lesen') karteEinlesen(() => overview());
      else if (a === 'rueck') rueckEinlesen(() => overview());
      else if (a === 'bauen') { if (pageLab) { m.close(false); bauen({ lab: pageLab }); } else lablisteBauen(m, errOut); }
      else if (a === 'los') { const c = code(cid); if (c) { los(c).then(r => { if (!r) errOut(''); }); } }
      else if (a === 'probe') { const c = code(cid); if (c) los(c, { probe: true }); }
      else if (a === 'send') { const c = code(cid), p = C.peek(c); withCodebus(cb => cb.send(c, { title: 'Fehlerkarte weitergeben', url: cardUrl(c, p ? p.lab : '') })); }
    };
    own.forEach(r => gueteInfo(r.cid).then(g => { const s = m.body.querySelector('[data-g="' + r.cid + '"]'); if (s) s.textContent = g ? g.text : ''; badgeStats(g); }).catch(() => {}));
    return m;
  }
  /* ohne Adapter auf der Seite: Lab waehlen, dort ?tausch=neu */
  function lablisteBauen(m, errOut) {
    const labs = ['nts', 'ana', 'els'].filter(l => T.adapters()[l]);
    errOut('');
    const host = m.body.querySelector('#tuE'); if (!host) return;
    host.parentNode.insertBefore(Object.assign(el('div', 'dl-row'), { innerHTML: labs.map(l => btn(labName(l), '', 'data-lab="' + l + '"', 'Karte im ' + labName(l) + ' bauen')).join('') }), host);
    [].forEach.call(m.body.querySelectorAll('[data-lab]'), b => { b.onclick = () => cfg.nav(labFile(b.dataset.lab) + '?tausch=neu'); });
  }

  /* ---------- Einlesen (Einstieg per Link/Scan) ---------- */
  async function einlesen(text, labHint) {
    if (!hasDoc()) return null;
    const cards = C.parseCards(text);
    if (!cards.length) { toast(TX.keineKarte); return null; }
    const first = cards[0], r = await nimm(first.code);
    if (!r.ok) { toast(r.why); return null; }
    cards.slice(1).forEach(c => { try { S.addInbox(c.code, null, Date.now()); } catch (e) {} });
    const m = modal('Karte erhalten'), row = rowOf({ code: first.code, status: 'neu' }, Date.now(), S.isOwn(r.cid));
    m.body.innerHTML = '<div class="dl-card"><b>' + esc(rowText(row)) + '</b></div>' + (r.v.sig === 'unsigniert' ? '<p><small>' + esc(TX.unsigniert) + '</small></p>' : '')
      + '<p>' + esc(row.eigen ? TX.eigen : TX.intro()) + '</p><div class="dl-err" id="tuE" role="alert"></div>'
      + '<div class="dl-row">' + btn(row.eigen ? 'Probelauf starten' : 'Los (3, 2, 1)', 'pri', 'data-act="los"') + btn('Später', '', 'data-act="x"') + btn('Übersicht', '', 'data-act="ov"') + '</div>';
    m.body.querySelector('[data-act=x]').onclick = () => m.close(true);
    m.body.querySelector('[data-act=ov]').onclick = () => overview();
    m.body.querySelector('[data-act=los]').onclick = async () => { const w = await los(first.code); if (!w) { const e = m.body.querySelector('#tuE'); if (e && document.getElementById('tuBox')) e.textContent = ''; } };
    void labHint; return m;
  }

  /* ---------- Bau-Assistent (3 Schritte) ---------- */
  async function bauen(o) {
    o = o || {}; if (!hasDoc()) return null;
    let ad = o.api ? register(o.api) : adapterFor(o.lab);
    if (!ad && o.lab) ad = await ensureAdapter(o.lab);
    if (!ad) { toast(TX.keinLab); return null; }
    const b = busyMsg(); if (b) { toast(b); return null; }
    const cur = ad.current(o), rigs = ad.rigs();
    if (!rigs.length) { toast(TX.keinLab); return null; }
    const B = { rig: cur.rig, c: cur.c, f: cur.f.slice(), sym: cur.sym, st: cur.st, chk: null }, own = { rig: cur.rig, c: cur.c };
    if (!B.rig || !rigs.some(r => r.id === B.rig)) { B.rig = rigs[0].id; B.c = null; B.f = []; }
    const m = modal('🔁 Als Fehlerkarte weitergeben'), steps = n => '<div class="tu-steps" aria-hidden="true">' + [1, 2, 3].map(i => '<span' + (i <= n ? ' class="on"' : '') + '></span>').join('') + '</div>';
    const cOf = () => B.c || {};
    const s1 = () => {
      const same = B.rig === own.rig && own.c;
      m.body.innerHTML = steps(1) + '<p><b>Schritt 1 von 3: Prüfstand und Grundeinstellung</b></p>'
        + (rigs.length > 1 ? '<label for="tuRig">Prüfstand</label><select id="tuRig">' + rigs.map(r => '<option value="' + esc(r.id) + '"' + (r.id === B.rig ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select>' : '<p>Prüfstand: <b>' + esc(rigs[0].name) + '</b></p>')
        + '<div class="dl-card">' + (same ? 'Grundeinstellung wie gerade am Prüfstand' + (gruppe(own.c) ? ': ' + esc(gruppe(own.c)) : ' (Standard)') + '.' : 'Standardeinstellung des Prüfstands.') + '</div>'
        + '<p><small>Der Löser bekommt genau diesen Aufbau, mit gesperrtem und verdecktem Fehler.</small></p><div class="dl-row">' + btn('Weiter', 'pri', 'data-act="n"') + '</div>';
      const sel = m.body.querySelector('#tuRig'); if (sel) sel.onchange = () => { B.rig = sel.value; B.c = B.rig === own.rig ? own.c : null; B.f = []; B.chk = null; s1(); };
      m.body.querySelector('[data-act=n]').onclick = () => s2();
    };
    const pruefe = () => {
      const out = m.body.querySelector('#tuChk'), nx = m.body.querySelector('[data-act=n]'); if (!out) return;
      if (!B.f.length) { out.innerHTML = ''; if (nx) nx.disabled = true; return; }
      out.textContent = 'Prüfe …';
      setTimeout(() => {
        const r = ad.check(B.rig, cOf(), B.f, null); B.chk = r;
        out.className = r.ok ? 'tu-ok' : 'tu-no'; out.textContent = r.ok ? TX.pruefOk : TX.nichtOk + r.why; if (nx) nx.disabled = !r.ok;
      }, 20);
    };
    const s2 = () => {
      const fl = ad.faults(B.rig, cOf());
      m.body.innerHTML = steps(2) + '<p><b>Schritt 2 von 3: Welchen Fehler baust du ein?</b></p><p><small>Diese Liste siehst nur du. Der Löser sieht sie nie.</small></p>'
        + '<div class="tu-list" role="group" aria-label="Auswahl des Fehlers">' + fl.map(x => '<label class="tu-opt"><input type="' + (ad.multi ? 'checkbox' : 'radio') + '" name="tuF" value="' + esc(x.id) + '"' + (B.f.indexOf(x.id) >= 0 ? ' checked' : '') + '> <span>' + esc(x.name) + (x.ok === false ? ' (an diesem Aufbau nicht möglich)' : '') + '</span></label>').join('') + '</div>'
        + '<div id="tuChk" role="status" aria-live="polite"></div><div class="dl-row">' + btn('Zurück', '', 'data-act="b"') + btn('Weiter', 'pri', 'data-act="n"') + '</div>';
      const nx = m.body.querySelector('[data-act=n]'); nx.disabled = true;
      [].forEach.call(m.body.querySelectorAll('input[name=tuF]'), i => { i.onchange = () => { B.f = [].filter.call(m.body.querySelectorAll('input[name=tuF]'), q => q.checked).map(q => q.value); B.chk = null; pruefe(); }; });
      m.body.querySelector('[data-act=b]').onclick = () => s1(); nx.onclick = () => s3(); if (B.f.length) pruefe();
    };
    const s3 = () => {
      const sg = ad.suggest(B.rig, cOf(), B.f), sy = ad.symptoms(B.rig, B.f[0]); if (!B.sym || !sy.some(x => x.id === B.sym)) B.sym = sg.sym || (sy[0] && sy[0].id); if (!B.st) B.st = sg.st;
      m.body.innerHTML = steps(3) + '<p><b>Schritt 3 von 3: Symptom und Stufe</b></p><label for="tuSym">Symptom (das sieht der Löser)</label><select id="tuSym">'
        + sy.map(x => '<option value="' + esc(x.id) + '"' + (x.id === B.sym ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select>'
        + '<label id="tuStL">Stufe (Vorschlag: ' + sg.st + ')</label><div class="dl-seg" role="group" aria-labelledby="tuStL">' + [1, 2, 3].map(i => '<button type="button" class="dl-btn" data-st="' + i + '" aria-pressed="' + (B.st === i) + '">' + i + '</button>').join('') + '</div>'
        + '<p>Dein Anzeigename auf der Karte: <b>' + esc(kuerzel() || 'noch nicht gesetzt') + '</b></p><p><small>' + esc(TX.nameHinweis) + '</small></p>'
        + '<div class="dl-err" id="tuE" role="alert"></div><div class="dl-row">' + btn('Zurück', '', 'data-act="b"') + btn('Karte erzeugen', 'pri', 'data-act="mk"') + '</div>';
      m.body.querySelector('#tuSym').onchange = e => { B.sym = e.target.value; };
      [].forEach.call(m.body.querySelectorAll('[data-st]'), x => { x.onclick = () => { B.st = +x.dataset.st; [].forEach.call(m.body.querySelectorAll('[data-st]'), q => q.setAttribute('aria-pressed', String(+q.dataset.st === B.st))); }; });
      m.body.querySelector('[data-act=b]').onclick = () => s2();
      m.body.querySelector('[data-act=mk]').onclick = async () => {
        if (!kuerzel()) { nameForm(m.body, () => s3()); return; }
        const r = ad.check(B.rig, cOf(), B.f, B.sym), er = m.body.querySelector('#tuE'); if (!r.ok) { er.textContent = TX.nichtOk + r.why; return; }
        const bb = busyMsg(); if (bb) { er.textContent = bb; return; }
        const ci = ad.cardInput(B.rig, cOf(), B.f, B.sym, B.st); if (!ci) { er.textContent = 'Die Karte konnte nicht erzeugt werden (Prüfstand lehnt sie ab).'; return; }
        const t = Date.now(), made = await C.makeCard(Object.assign({}, ci, { k: kuerzel(), j: jahrgang(), t, app: appV() }), { now: t });
        if (!made || !S.addOwn(made.code, null, t)) { er.textContent = 'Die Karte konnte nicht gespeichert werden.'; return; }
        s4(made);
      };
    };
    const s4 = made => {
      const url = cardUrl(made.code, ad.lab);
      m.body.innerHTML = '<p class="tu-ok"><b>Karte ' + esc(made.cid) + ' ist fertig.</b></p><p>Gib sie als QR, Text oder Datei weiter. Sie ist bis ' + esc(datum(made.card.bis)) + ' gültig. Unter „Meine Karten“ liest du später die Rückmeldungen ein und siehst die Güte.</p>'
        + '<div class="dl-row">' + btn('Weitergeben (QR, Text, Datei)', 'pri', 'data-act="send"') + btn('Probelauf', '', 'data-act="probe"') + btn('Fertig', '', 'data-act="x"') + '</div>';
      const send = () => withCodebus(cb => cb.send(made.code, { title: 'Fehlerkarte weitergeben', url }));
      m.body.querySelector('[data-act=send]').onclick = send; m.body.querySelector('[data-act=x]').onclick = () => m.close(true);
      m.body.querySelector('[data-act=probe]').onclick = () => { m.close(false); los(made.code, { probe: true }); };
      send();
    };
    s1(); return { close: m.close };
  }

  /* ---------- Wiederaufnahme nach dem Neuladen, ?tausch=neu ---------- */
  function resume() {
    const c = S.cur(null); if (!c || !c.start) return;
    if (Date.now() - c.start > MAXMS) { S.cancel(null); return; }
    if (RUN && !RUN.done) { chip(); return; }
    const st = stGet(null), e = st.inbox.find(x => x.cid === c.cid), p = e ? C.parseCards(e.code)[0] : null, ad = p && p.card ? adapterFor(p.card.lab) : null;
    if (!ad) { chip(); return; }
    if (!ad.running()) { S.cancel(null); chip(); toast(TX.unterbrochen); return; }
    RUN = { cid: c.cid, entry: p, ad, probe: S.isOwn(c.cid, st), wdh: false, start: c.start, h: c.h || 0, tries: c.tries || 0, done: false, unsub: null };
    RUN.unsub = ad.onDone(o => onDiag(RUN, o)); chip();
  }
  function neuAusUrl() {
    try {
      if (!/(^|[?&])tausch=neu(&|$)/.test(location.search)) return;
      history.replaceState(null, '', location.pathname + location.hash);
      for (const l of ['nts', 'ana', 'els']) if (adapterFor(l)) { bauen({ lab: l }); return; }
    } catch (e) {}
  }
  /* #t= der Startseite UND Auffangnetz fuer Labs, deren eigener #t=-Haken zu frueh lief (elsui prueft root.Tausch schon beim Skriptstart, vor tausch.js) */
  function hashRest() {
    try { if (/^#t=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); einlesen(h.slice(3)); } } catch (e) {}
  }

  /* ---------- Klick-Sperre waehrend einer Suche ---------- */
  const BLOCK = '[data-d="show"],[data-dc="show"],[data-fa="reveal"],[data-fa="dice"],[data-fa="tausch"],[data-fa="tauschkarte"],[data-a="gdv"],[data-a="dreveal"],[data-a="a-sol"],[data-a="tausch"],[data-a="dice"],[data-a="tauschkarte"],#vbSol,#tSol,#hSol';
  const BLOCKTXT = /^\s*(?:\u{1F3B2}\s*)?(?:Auflösung(?: zeigen)?\??|Lösung (?:zeigen|anzeigen)|Fehler (?:zeigen|anzeigen|aufdecken|würfeln)|Musterlösung (?:laden|öffnen)|(?:\u{1F501}\s*)?Als Fehlerkarte weitergeben)\s*$/iu;
  function installGuard() {
    if (!hasDoc() || root.__tauschGuard) return; root.__tauschGuard = true;
    root.addEventListener('click', e => {
      if (!blocked()) return;
      const t = e.target && e.target.closest ? e.target.closest('button,a,[role=button]') : null; if (!t || t.closest('.dl')) return;
      let hit = false, nav = false;
      try { hit = t.matches(BLOCK) || BLOCKTXT.test(t.textContent || ''); } catch (x) {}
      try { if (!hit && t.tagName === 'A') { const h = t.getAttribute('href') || ''; if (h && !/^#/.test(h) && !/^javascript:/i.test(h)) { const u = new URL(h, location.href); nav = u.origin === location.origin && u.pathname !== location.pathname; } } } catch (x) {}
      if (hit || nav) { e.preventDefault(); e.stopImmediatePropagation(); toast(hit ? 'Während der Fehlersuche gibt es keine Auflösung und keinen Wechsel.' : 'Während der Fehlersuche gibt es keinen Wechsel. Gib zuerst eine Diagnose ab oder gib auf.'); }
    }, true);
  }

  /* ---------- Einstiege ---------- */
  function open(a, b) {
    if (a == null || a === '') return overview();
    if (isObj(a)) {
      const lab = a.lab || (a.api && a.api.lab) || ''; if (a.api) register(a.api);
      if (a.mode === 'bauen') return bauen(Object.assign({}, a, { lab }));
      if (a.code) return einlesen(a.code, lab);
      return overview();
    }
    return einlesen(String(a), b);
  }
  const build = lab => bauen({ lab: typeof lab === 'string' ? lab : undefined, api: isObj(lab) ? lab : undefined });
  const Tauschui = { open, build, bauen, einlesen, los, overview, statusZeile, chip, resume, finish, aufgeben, tippSheet, cfg, TX, register,
    core: { ergCode, normApi, rowOf, rowText, inboxRows, ownRows, warten, gueteInfo, gueteText, scoreOf, labFile, cardUrl, datum, fmt, adapterFor, blocked, SYML, RIGN, LABS, BLOCK, BLOCKTXT, verifyText, curH, getRun: () => RUN, last: () => LAST, _reset: () => { RUN = null; LAST = null; Object.keys(APIS).forEach(k => delete APIS[k]); } } };
  /* TauschUI (els): bau(draft, api), einlesen(code, api) */
  const TauschUIels = { bau: (draft, api) => bauen({ lab: (api && api.lab) || 'els', api, draft }), einlesen: (code, api) => { if (api) register(api); return einlesen(code, (api && api.lab) || 'els'); } };
  T.ui = Tauschui; T.loadUi = cb => { try { if (typeof cb === 'function') cb(Tauschui); } catch (e) { /* nie stoeren */ } };
  root.Tauschui = Tauschui; root.TauschUI = TauschUIels;
  /* Listen als reine Daten registrieren, wo kein Adapter geladen ist (Startseite): Karten lassen sich dort lesen (A6), die Adapter pruefen strenger beim Laden */
  Object.keys(RIGN).forEach(l => { try { if (!T.adapters()[l]) T.registerAdapter(l, { rigs: Object.keys(RIGN[l]), symptoms: Object.keys(SYML[l]) }); } catch (e) {} });
  if (typeof window !== 'undefined' && root === window) {
    installGuard();
    const go = () => setTimeout(() => { try { resume(); chip(); neuAusUrl(); hashRest(); } catch (e) { console.error(e); } }, 500);
    if (document.readyState === 'complete') go(); else root.addEventListener('load', go, { once: true });
  }
  return Tauschui;
});
