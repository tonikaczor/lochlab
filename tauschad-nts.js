/* tauschad-nts.js - Fehler-Tauschboerse, Lab-Adapter Netzteil-Lab (Paket T3a, SPEC-TAUSCH-WETTBEWERB 2.1, 2.2, 4.3, 4.5, 8).
   Pruefstand `fehler` (ntsrig-fehler.js). Gerechnet wird NUR im Kern NTS_CORE.fault (catalog, make, probe, parts, path, symptoms); hier steht keine zweite Formel.
   Teil 1 (DOM-frei, auch Node): Tausch.registerAdapter('nts', { rigs, symptoms }) als reine Daten (Ausbilder-Uebersicht liest Karten ohne Lab, A6 in tausch.js).
   Teil 2: TauschNts.core (Loesbarkeit/Eindeutigkeit 4.3, Verdeckung, Tipps) und TauschNts.makeApi(driver, opt) -> LabTauschAPI.
   Teil 3 (nur Browser mit NTS_UI): window.LabTauschAPI mit Treiber auf NTS_UI und Haken (hooks) fuer ntsui.js. Ohne Tausch/NTS_UI passiert nichts.

   LabTauschAPI (fuer T4 tauschui.js):
     lab 'nts'; rigs() -> [{id,name}]; current() -> { rig, c, f|null, sym, st, mp } (Bauen: "wie gerade eingestellt");
     faults(rig, c?) -> [{ id, name, netz[], sym[], ok }]  NUR fuer den Ersteller (enthaelt Namen);
     symptoms(rig, f?) -> [{ id, label }] (mit f: nur die zum Fehler passenden, erstes = Vorschlag); stufe(f, c) -> 1..3 (Vorschlag);
     cardInput({ rig, c, f, sym, st }) -> { lab, rig, st, sym, c, f, mp } fuer Tausch.core.makeCard (T4 ergaenzt k, j, app);
     check(card, { ersteller }) -> { ok, code, why }  (card = { rig, c, f, sym } oder Eintrag aus verifyCard/parseCards { card, hidden });
       why ohne ersteller:true ist neutral (Loeser sieht nie einen Fehlernamen);
     build(entry, { probe }) -> { ok, why?, cid, mp }  stellt den Pruefstand gesperrt und verdeckt ein und startet Tausch.store.begin;
     diagnosed(cb) -> abmelden(); cb({ richtig, f (Fehlversuche), res|null }) nach jeder Diagnose waehrend der Suche;
     diagnose(id) -> dasselbe Objekt (die UI ruft das ueber den Haken in ntsui.js setCtl('diagnose') auf);
     tipp(n) -> { n, h, text } | { gesperrt, text } (Stufe 1 Messreihenfolge, Stufe 2 abweichende Messpunkte, Stufe 3 gesperrt);
     messpunkte() -> mp der laufenden Karte; aufgeben() -> res (p 0); aufloesung() -> { id, name, ursache } erst nach Ende;
     active() -> bool; refresh(); hooks { active, locked, lockText, mask, maskList, filterMap, onMess, onDiagnose }.
   Buchfuehrung: der Adapter fuehrt Tausch.store.wrong / end(100|0, { m, mp }) selbst; T4 ruft fuer Diagnosen NICHT selbst wrong/end auf.
   res = Ergebnis von Tausch.store.end + fnd (gefundene Fehler-Id, nur bei p 100, fuer Tausch.core.makeErg).

   Annahmen (konservativ, Spec offen):
   N1 Grundeinstellung c = { netz } (immer ausdruecklich, auch beim Standard 'linear'). Weitere Steuerwerte (seed, messpunkt, ...) sind nicht Teil der Karte;
      unbekannte Schluessel in c -> Ablehnung. 'zufall', 'ok' und '' sind keine Fehler fuer eine Karte (die gewuerfelte Id wird uebernommen).
   N2 Eindeutigkeit (4.3.3): Messbild = probe() an ALLEN Messpunkten des Netzteils; zwei Fehler gelten als verschieden, wenn mindestens ein Messwert
      relativ um mehr als TA.eindeutig (0,5 % = Anzeigeregel der Fehlersuche) abweicht. Verglichen wird mit jedem anderen Fehler der Liste, der am
      selben Netzteil rechenbar ist (make().ok). Sichtbarkeit (4.3.2): facts().wichtig nicht leer (mindestens ein Messpunkt mit abweichung).
   N3 Symptom: nur aus der Symptomliste des Kerns (fault.symptoms) UND aus catalog[f].symptome (kein irrefuehrendes Symptom). Vorschlag = erstes.
   N4 Stufe-Vorschlag aus der Zahl abweichender Messpunkte: >= 5 -> 1, 3..4 -> 2, <= 2 -> 3.
   N5 mp (Messpunkte der Karte) = aufgerundet halbe Zahl der Messpunkte am Netzteil (linear/zener 4, buck/boost 5): Richtwert 2 x mp = jeder Punkt einmal.
   N6 Waehrend der Suche gesperrt: netz, fehler, seed, tausche (Tauschen verraet die Ursache durch Probieren) und die Sichtpruefung (TA.sicht = false:
      ihr Text nennt das defekte Bauteil, z. B. "Die Sicherung ist durchgebrannt"). Toni kann TA.sicht auf true stellen.
      Ebenfalls gesperrt (ntsui.js): Wuerfel, Voreinstellungen, Teilen-Link, Drucken, Laden/Oeffnen, Aufgabe starten, Ablauf-Aktionen ausser Messen.
   N7 Verdeckung: Texte (Meldungen, Hinweise, Ampel, aria-label) werden waehrend der Suche durch mask() gefuehrt: enthaelt ein Text Id, Name, Ursache
      oder Behebung des eingebauten Fehlers, wird er durch einen neutralen Text ersetzt. Die Meldung 'fehler-falsch' ("Gefunden werden sollte ...") faellt immer weg.
   N8 Richtige Diagnose = Diagnose-Id gleich eingebauter Fehler (ohne Begruendungs-Pflicht der Ampel); falsch = Fehlversuch, weiter.
   N9 Laufende Suche ueberlebt ein Neuladen: Karte steht in lm4.tauschnts { cid, code }, gilt nur solange Tausch.store.cur() dieselbe cid hat.
   N10 Probelauf (eigene Karte, build(entry, { probe:true })) laeuft gleich ab; ob ein TFE1 entsteht, entscheidet T4. */
(function (root) {
  'use strict';
  const req = n => { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } };
  const LAB = 'nts', RIG = 'fehler';
  const TA = { eindeutig: 0.005, sicht: false, tippMax: 2 };
  /* Symptomliste als reine Daten (gleich NTS_CORE.fault.symptoms, Test prueft die Gleichheit) */
  const SYMS = [['kein-ausgang', 'Kein Ausgang'], ['brummt', 'Es brummt'], ['zu-niedrig', 'Ausgangsspannung zu niedrig'], ['zu-hoch', 'Ausgangsspannung zu hoch'], ['wird-heiss', 'Das Gerät wird heiß'], ['schwingt', 'Der Ausgang schwingt']];
  const SYMIDS = SYMS.map(s => s[0]);
  const T0 = () => root.Tausch || req('./tausch.js');
  /* Teil 1: DOM-freie Registrierung (sofort beim Laden) */
  (function reg() { const T = T0(); if (T && typeof T.registerAdapter === 'function') T.registerAdapter(LAB, { rigs: [RIG], symptoms: { [RIG]: SYMIDS } }); })();

  /* ---------- Teil 2: Kern (braucht NTS_CORE.fault, lazy) ---------- */
  let CORE = null;
  const FT = () => {
    if (!CORE) { CORE = root.NTS_CORE && root.NTS_CORE.fault ? root.NTS_CORE : null; if (!CORE) { req('./ntscore-diag.js'); CORE = root.NTS_CORE && root.NTS_CORE.fault ? root.NTS_CORE : null; } }
    return CORE ? CORE.fault : null;
  };
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const catalog = () => { const F = FT(); return F && Array.isArray(F.catalog) ? F.catalog : []; };
  const catOf = id => catalog().find(f => f.id === id) || null;
  const netze = () => { const F = FT(); return F && Array.isArray(F.netze) ? F.netze.slice() : []; };
  const pointsOf = netz => { const F = FT(); if (!F || !F.probe) return []; const info = F.probe.info || {}; return (F.probe.points || []).filter(p => info[p] && Array.isArray(info[p].netz) && info[p].netz.indexOf(netz) >= 0); };
  const pname = p => { const F = FT(), i = F && F.probe && F.probe.info ? F.probe.info[p] : null; return i && i.name ? i.name : p; };
  const symLabel = id => { const F = FT(); const l = F && Array.isArray(F.symptoms) ? F.symptoms : null; const x = l ? l.find(s => s.id === id) : null; if (x) return x.name; const y = SYMS.find(s => s[0] === id); return y ? y[1] : id; };
  const memo = Object.create(null);
  /* Messbild: { ok, pts[], v[], abw[], wichtig[] } am Netzteil netz */
  function messbild(fid, netz) {
    const key = fid + '|' + netz; if (memo[key]) return memo[key];
    const F = FT(); if (!F) return { ok: false, why: 'Kern fehlt' };
    let st = null; try { st = F.make(fid, { netz }); } catch (e) { st = null; }
    if (!st || !st.ok) return (memo[key] = { ok: false, why: (st && st.why) || 'nicht rechenbar' });
    const pts = pointsOf(netz), v = [], abw = [];
    pts.forEach(p => { let q = null; try { q = F.probe(st, p); } catch (e) { q = null; } v.push(q && q.ok && isFinite(q.value) ? q.value : NaN); abw.push(!!(q && q.ok && q.abweichung === true)); });
    return (memo[key] = { ok: true, pts, v, abw, wichtig: pts.filter((p, i) => abw[i]) });
  }
  const differs = (a, b) => { if (!a.ok || !b.ok || a.pts.length !== b.pts.length) return true;
    return a.v.some((x, i) => { const y = b.v[i]; if (!isFinite(x) || !isFinite(y)) return isFinite(x) !== isFinite(y); return Math.abs(x - y) > TA.eindeutig * Math.max(Math.abs(x), Math.abs(y)) + 1e-12; }); };
  const mpOf = netz => Math.max(1, Math.ceil(pointsOf(netz).length / 2));
  const stufeOf = n => (n >= 5 ? 1 : n >= 3 ? 2 : 3);
  function normC(c) {
    if (c == null) c = {}; if (!isObj(c)) return null;
    const keys = Object.keys(c); if (keys.some(k => k !== 'netz')) return null;
    const n = c.netz == null ? 'linear' : c.netz; return netze().indexOf(n) >= 0 ? { netz: n } : null;
  }
  const symsFor = fid => { const f = catOf(fid); return f && Array.isArray(f.symptome) ? f.symptome.filter(s => SYMIDS.indexOf(s) >= 0) : []; };
  /* Pruefung 4.3. o = { rig, c, f, sym }. { ok, code, why (Ersteller), whyPub (Loeser), wichtig, mp, st } */
  const PUB = 'Diese Fehlerkarte passt nicht zu dieser Version des Netzteil-Labs. Bitte den Ersteller um eine neue Karte.';
  function pruef(o) {
    o = o || {}; const no = (code, why) => ({ ok: false, code, why, whyPub: PUB });
    if (!FT()) return no('kern', 'Der Kern des Netzteil-Labs (NTS_CORE.fault) ist nicht geladen.');
    if (o.rig !== RIG) return no('rig', 'Fehlerkarten gibt es im Netzteil-Lab nur am Prüfstand „Fehlersuche am Netzteil“.');
    const c = normC(o.c); if (!c) return no('einstellung', 'Die Grundeinstellung ist nicht erlaubt (nur ein Netzteil aus der Liste: ' + netze().join(', ') + ').');
    const f = catOf(typeof o.f === 'string' ? o.f : ''); if (!f) return no('liste', 'Wähle einen Fehler aus der Liste des Prüfstands (kein Zufall, kein eigener Fehler).');
    const mb = messbild(f.id, c.netz); if (!mb.ok) return no('netz', 'Der Fehler „' + f.name + '“ lässt sich am Netzteil „' + c.netz + '“ nicht einbauen: ' + mb.why);
    if (!mb.wichtig.length) return no('unsichtbar', 'Mit dem Fehler „' + f.name + '“ weicht an diesem Aufbau kein Messpunkt ab: Er wäre nicht zu finden.');
    const same = catalog().filter(g => g.id !== f.id).filter(g => { const b = messbild(g.id, c.netz); return b.ok && !differs(mb, b); });
    if (same.length) return no('gleich', 'Das Messbild sieht an diesem Aufbau aus wie „' + same.map(g => g.name).join('“, „') + '“: Die Karte wäre nicht eindeutig.');
    if (o.sym != null && symsFor(f.id).indexOf(o.sym) < 0) return no('symptom', 'Das Symptom passt nicht zum Fehler. Erlaubt: ' + symsFor(f.id).map(symLabel).join(', ') + '.');
    return { ok: true, code: 'ok', why: '', whyPub: '', wichtig: mb.wichtig.slice(), mp: mpOf(c.netz), st: stufeOf(mb.wichtig.length), c, f: f.id };
  }
  /* Begriffe, die vor dem Ende nirgends stehen duerfen (Id, Name, Ursache, Behebung des eingebauten Fehlers) */
  const terms = fid => { const f = catOf(fid); return f ? [f.id, f.name, f.ursache, f.behebung].filter(s => typeof s === 'string' && s.length >= 3) : [String(fid || '')].filter(s => s.length >= 3); };
  const NEUTRAL = 'Hinweis ausgeblendet (Fehler-Tausch: die Ursache bleibt bis zur richtigen Diagnose verdeckt).';
  const leaks = (s, fid) => { const t = String(s == null ? '' : s); return terms(fid).some(x => t.indexOf(x) >= 0); };
  const mask = (s, fid) => (leaks(s, fid) ? NEUTRAL : s);
  const maskList = (l, fid) => (Array.isArray(l) ? l : []).filter(d => !(d && d.id === 'fehler-falsch')).map(d => {
    if (!d || typeof d !== 'object') return mask(d, fid);
    return leaks(d.text, fid) || leaks(d.gegenprobe, fid) ? { id: d.id, kind: d.kind === 'error' ? 'warn' : (d.kind || 'info'), text: NEUTRAL } : d;
  });
  /* Tipps: Stufe 1 Messreihenfolge zum (oeffentlichen) Symptom, Stufe 2 abweichende Messpunkte (facts), nie die Ursache */
  function tippText(n, fid, netz, sym) {
    const F = FT(); if (!F) return '';
    if (n >= 3) return 'Stufe 3 (Auflösung) ist im Fehler-Tausch gesperrt. Gib eine Diagnose ab oder gib auf.';
    const have = pointsOf(netz);
    if (n === 1) {
      let p = null; try { p = F.path(sym || 'kein-ausgang'); } catch (e) { p = null; }
      const steps = p && p.ok && Array.isArray(p.steps) ? p.steps : [];
      const parts = steps.map(s => ({ name: s.name, pts: (s.punkte || []).filter(x => have.indexOf(x) >= 0) })).filter(s => s.pts.length);
      return 'Messreihenfolge: ' + parts.map(s => s.name + ' (' + s.pts.map(pname).join('; ') + ')').join(' → ') + '. Vergleiche jeden Messwert mit dem Soll.';
    }
    const mb = messbild(fid, netz);
    return mb.ok ? 'Diese Messpunkte weichen ab: ' + mb.wichtig.map(pname).join('; ') + '.' : '';
  }
  const LOCK = { netz: 1, fehler: 1, seed: 1, tausche: 1 };
  const LOCKTXT = { tausche: 'Im Fehler-Tausch zählt die Diagnose: Bauteile tauschen ist während der Suche gesperrt.', sicht: 'Im Fehler-Tausch zählt das Messen: Die Sichtprüfung ist während der Suche gesperrt.' };
  const lockText = k => LOCKTXT[k] || 'Während der Fehler-Tausch-Suche ist der Aufbau gesperrt.';
  const locked = k => !!LOCK[k] || (k === 'sicht' && !TA.sicht);

  /* ---------- makeApi(driver, opt): driver { setup(c, fid) -> bool, controls() -> {..}, refresh?() }; opt { store, now } ---------- */
  function makeApi(driver, opt) {
    opt = opt || {}; const ST = opt.store || null, now = () => (typeof opt.now === 'function' ? opt.now() : Date.now());
    const T = () => T0(), S = () => { const t = T(); return t ? t.store : null; };
    let SR = null, building = false; const cbs = [];
    const jget = k => { try { const s = ST || (typeof localStorage !== 'undefined' ? localStorage : null); return s ? JSON.parse(s.getItem(k) || 'null') : null; } catch (e) { return null; } };
    const jset = (k, v) => { try { const s = ST || (typeof localStorage !== 'undefined' ? localStorage : null); if (s) s.setItem(k, JSON.stringify(v)); } catch (e) {} };
    const cur = () => { const s = S(); try { return s ? s.cur(ST) : null; } catch (e) { return null; } };
    const active = () => { if (!SR || SR.done) return false; const c = cur(); return !!(c && c.start && c.cid === SR.cid); };
    const refresh = () => { try { if (driver && driver.refresh) driver.refresh(); } catch (e) {} };
    function restore() {
      const sv = jget('lm4.tauschnts'), c = cur(), t = T(); if (!sv || !c || !c.start || sv.cid !== c.cid || !t) return false;
      const e = t.core.parseCards(sv.code)[0]; if (!e || !e.card || !e.hidden || e.card.cid !== c.cid) return false;
      const n = normC(e.hidden.c); if (!n) return false;
      SR = { cid: c.cid, fid: e.hidden.f, netz: n.netz, sym: e.card.sym, mp: e.hidden.mp != null ? e.hidden.mp : mpOf(n.netz), done: false }; return true;
    }
    const entryOf = x => (x && x.card && x.hidden ? { rig: x.card.rig, c: x.hidden.c, f: x.hidden.f, sym: x.card.sym, card: x.card, hidden: x.hidden } : x);
    function finish(p) {
      const s = S(), c = cur(); if (!s || !SR) return null;
      const res = s.end(p, ST, now(), { m: c ? (c.mz || 0) : 0, mp: SR.mp }); SR.done = true;
      if (res && p >= 100) res.fnd = SR.fid;
      refresh(); return res;
    }
    function diagnose(id) {
      if (!active()) return { richtig: false, f: 0, res: null, aktiv: false };
      let out;
      if (id === SR.fid) out = { richtig: true, f: (cur() || {}).tries || 0, res: finish(100) };
      else { const f = S().wrong(ST); out = { richtig: false, f: f == null ? 0 : f, res: null }; }
      cbs.slice().forEach(cb => { try { cb(out); } catch (e) {} });
      return out;
    }
    const api = {
      lab: LAB, TA,
      rigs: () => [{ id: RIG, name: 'Fehlersuche am Netzteil' }],
      faults: (rig, c) => { if (rig !== RIG) return []; const n = normC(c); return catalog().map(f => ({ id: f.id, name: f.name, netz: f.netz.slice(), sym: symsFor(f.id), ok: n ? pruef({ rig, c: n, f: f.id }).ok : null })); },
      symptoms: (rig, f) => (rig !== RIG ? [] : (f ? symsFor(f) : SYMIDS).map(id => ({ id, label: symLabel(id) }))),
      stufe: (f, c) => { const n = normC(c), mb = n ? messbild(f, n.netz) : null; return mb && mb.ok ? stufeOf(mb.wichtig.length) : 2; },
      current: () => {
        let k = {}; try { k = (driver && driver.controls && driver.controls()) || {}; } catch (e) { k = {}; }
        const c = normC({ netz: k.netz }), f = catOf(k.fehler) ? k.fehler : null, p = c && f ? pruef({ rig: RIG, c, f }) : null;
        return { rig: RIG, c, f, sym: f ? (symsFor(f)[0] || null) : null, st: p && p.ok ? p.st : 2, mp: c ? mpOf(c.netz) : null };
      },
      cardInput: o => { o = o || {}; const p = pruef(o); if (!p.ok) return null; return { lab: LAB, rig: RIG, st: o.st == null ? p.st : o.st, sym: o.sym || symsFor(p.f)[0], c: p.c, f: p.f, mp: p.mp }; },
      check: (card, o) => { const e = entryOf(card) || {}; const p = pruef(e); return { ok: p.ok, code: p.code, why: o && o.ersteller ? p.why : p.whyPub }; },
      build: (x, o) => {
        o = o || {}; const e = entryOf(x) || {}, p = pruef(e), s = S();
        if (!p.ok) return { ok: false, why: p.whyPub };
        if (!e.card || !s) return { ok: false, why: 'Die Karte ist nicht lesbar.' };
        if (active()) return { ok: false, why: 'Es läuft schon eine Fehler-Tausch-Suche.' };
        SR = { cid: e.card.cid, fid: p.f, netz: p.c.netz, sym: e.card.sym, mp: e.hidden && e.hidden.mp != null ? e.hidden.mp : p.mp, done: false, probe: !!o.probe };
        building = true; let ok = false;
        try { ok = !!(driver && driver.setup(p.c, p.f)); } catch (er) { ok = false; } finally { building = false; }
        if (!ok) { SR = null; return { ok: false, why: 'Der Prüfstand ließ sich nicht einstellen.' }; }
        const b = s.begin(SR.cid, ST, now()); if (!b) { SR = null; return { ok: false, why: 'Es läuft schon eine andere Fehler-Tausch-Suche.' }; }
        jset('lm4.tauschnts', { cid: SR.cid, code: (x && x.code) || '' });
        refresh(); return { ok: true, cid: SR.cid, mp: SR.mp };
      },
      diagnosed: cb => { if (typeof cb !== 'function') return () => {}; cbs.push(cb); return () => { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); }; },
      diagnose,
      tipp: n => {
        n = Math.round(+n || 1); if (!active()) return null;
        if (n >= 3) return { gesperrt: true, text: tippText(3) };
        n = Math.max(1, Math.min(TA.tippMax, n)); const s = S();
        let c = cur(); while (c && (c.h || 0) < n) { const r = s.tipp(ST); if (!r || r.blocked) break; c = cur(); }
        return { n, h: c ? c.h || 0 : n, text: tippText(n, SR.fid, SR.netz, SR.sym) };
      },
      messpunkte: () => (SR ? SR.mp : null),
      aufgeben: () => (active() ? finish(0) : null),
      aufloesung: () => { if (!SR || active() || !SR.done) return null; const f = catOf(SR.fid); return f ? { id: f.id, name: f.name, ursache: f.ursache || '' } : null; },
      active, refresh, restore,
      hooks: {
        active: () => active() || building,
        locked: k => active() && !building && locked(k),
        lockText, mask: s => (active() || building ? mask(s, SR && SR.fid) : s), maskList: l => (active() || building ? maskList(l, SR && SR.fid) : l),
        filterMap: m => { if (!active() || building || !isObj(m)) return m; const o = {}; Object.keys(m).forEach(k => { if (!locked(k)) o[k] = m[k]; }); return o; },
        onMess: pt => { if (!active()) return null; const s = S(); try { return s.mess(String(pt || ''), SR.mp, ST); } catch (e) { return null; } },
        onDiagnose: id => (active() ? diagnose(id) : null)
      }
    };
    return api;
  }

  /* ---------- Teil 3: Browser-Treiber auf NTS_UI ---------- */
  function uiDriver() {
    const U = () => root.NTS_UI;
    return {
      setup(c, fid) {
        const u = U(); if (!u || !u.S) return false; const S = u.S;
        S.task = null; S.dice = null; S.live = null;
        u.setRig(RIG, { run: true });   /* frischer Pruefstand: leert auch Wuerfelband und Fehlersuche-Feld */
        if (!S.rig) return false;
        u.applyCtl({ netz: c.netz }); u.applyCtl({ fehler: fid }); u.applyCtl({ messpunkt: '', diagnose: '', tausche: 'keins', begruendung: false });
        S.clicks = []; S.diagnose = null; S.dirty = false;
        let ok = false; try { ok = S.rig.getControl('fehler') === fid && S.rig.getControl('netz') === c.netz; } catch (e) { ok = false; }
        if (u.setTab) u.setTab('rig'); return ok;
      },
      controls() { const u = U(); if (!u || !u.S || !u.S.rig || u.S.rigId !== RIG) return {}; const r = u.S.rig; return { netz: r.getControl('netz'), fehler: r.getControl('fehler') }; },
      refresh() { const u = U(); if (!u) return; try { if (u.buildFaultPanel) u.buildFaultPanel(); if (u.updateAmpel) u.updateAmpel(true); if (u.S && u.S.rig) u.applyCtl({}); } catch (e) {} }
    };
  }

  const TauschNts = { LAB, RIG, TA, SYMS, SYMIDS, core: { catalog, catOf, netze, pointsOf, messbild, differs, pruef, normC, symsFor, mpOf, stufeOf, terms, leaks, mask, maskList, tippText, locked, lockText, NEUTRAL }, makeApi, uiDriver };
  if (typeof module !== 'undefined' && module.exports) module.exports = TauschNts;
  root.TauschNts = TauschNts;
  if (typeof window !== 'undefined' && root === window && root.Tausch && root.NTS_UI) {
    root.LabTauschAPI = makeApi(uiDriver());
    try { root.LabTauschAPI.restore(); } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
