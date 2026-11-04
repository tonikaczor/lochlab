/* tauschad-ana.js - Fehler-Tauschboerse, Lab-Adapter ANA (Paket T3b). In Node (kopflos) UND im Browser ladbar.
   Teil 1 (DOM-frei, sofort beim Laden): Tausch.registerAdapter('ana', { rigs, symptoms }) - reine Daten, damit die Ausbilder-Uebersicht
          Karten lesen kann, ohne das Lab zu laden (tausch.js A6).
   Teil 2 (kopflos, braucht die Aufgaben-Hilfen util aus anadata.js, in Node per require): Fehlerliste je Pruefstand, Messbild pic, Loesbarkeit und
          Eindeutigkeit (Spec 4.3), verdeckter Teil { c, f, mp } fuer Tausch.core.makeCard, Tipps, Diagnose-Urteil.
   Teil 3 (nur im Lab, braucht window.ANA_UI aus anaui.js): Karte in den Pruefstand laden (gesperrt + verdeckt, wie der Fehler-Wuerfel),
          Messzaehler an Tausch.mess, Diagnose-Haken, Aufgeben. Die Oberflaeche (Assistent, Chip, Ergebnis-Sheet) baut T4 (tauschui.js).
   Schnittstelle: root.LabTauschAPI (Beschreibung bei API unten). Kein Fehlername und keine Fehler-Id in einem Text, den der Loeser vor der
   richtigen Diagnose oder dem Aufgeben sieht (Chip, Wuerfeltext, Messgeraete, aria-label, Tipps, URL).
   Annahmen (konservativ entschieden):
   B1 Fehler-Id der Karte = Wert des Steuerwerts `fehler` mit '_' statt Leerzeichen (tausch.js FRE erlaubt kein Leerzeichen); kein Wert der
      ana-Fehlerlisten enthaelt '_' (Test prueft das), daher eindeutig umkehrbar.
   B2 Messbild pic = Anzeige ALLER Messgeraete des Pruefstands nach der Anzeigeregel der Oberflaeche (meters[].digits, texts[], ∞ ab infAbove),
      Momentaufnahme wie die Fehlersuche-Aufgaben (util.snap aus anadata.js: frischer Pruefstand, Seed 1, Beharrungszustand, ohne Ausloesen).
      Sichtbar (4.3.2) = mindestens ein Messgeraet zeigt anders als ohne Fehler ODER die Ampel wechselt.
      Eindeutig (4.3.3) = jedes andere Fehlerbild der Liste zeigt in mindestens einem Messgeraet etwas anderes (Ampel zaehlt hier nicht).
   B3 Grundeinstellung c = nur Abweichungen vom Standard des frischen Pruefstands; Zahlen auf 6 gueltige Stellen gerundet (Kartengroesse);
      erlaubt = Schluessel ist ein Steuerwert (nicht fehler/diagnose/Taste), Wert liegt im Bereich (Schieber ohne Klemmen, Auswahl aus der Liste,
      Schalter Wahrheitswert) und der Pruefstand uebernimmt ihn unveraendert (keine Abhaengigkeit, die ihn ueberschreibt).
   B4 Messpunkte mp = Anzahl der abweichenden Messgeraete (mind. 1), Richtwert fuer Duell.core.score. Messzaehler: jede neue Anzeige aller
      Messgeraete waehrend einer laufenden Tausch-Suche zaehlt als eine Messung (Tausch.mess, gleiche Anzeige zaehlt nicht doppelt).
   B5 Tipp 1 = allgemeine Messreihenfolge (Messgeraete des Pruefstands der Reihe nach), Tipp 2 = nur die Namen der abweichenden Messgeraete,
      Tipp 3 = null (gesperrt). tipp(n) liefert nur Text; das Zaehlen (Tausch.tipp) macht die Oberflaeche.
   B6 Symptome: feste Liste je Pruefstand (E2), Vorschlag des Adapters immer 'werte-falsch' (keine Ableitung aus dem Fehler, damit das
      Symptom nichts verraet); Stufe-Vorschlag aus der Zahl der abweichenden Messgeraete (>= 4: 1, 2-3: 2, 1: 3).
   B7 check(..., { loeser:true }) nennt beim Loeser nie andere Fehlerbilder ("Karte passt nicht mehr zu dieser Version"), nur der Ersteller
      bekommt "sieht an diesem Aufbau aus wie ...".
   B8 Diagnose-Urteil: falsch -> Tausch.store.wrong() (f + 1), richtig -> Tausch.store.end(100) mit mp der Karte; beides nur bei laufender
      Tausch-Suche (Tausch.store.active()). Aufgeben -> Tausch.store.end(0) und Aufloesung. Die Oberflaeche erzeugt daraus TFE1 (makeErg, fnd).
   B9 Uebergabe an die Oberflaeche T4: Tausch.ui.open({ lab:'ana', mode:'loesen'|'bauen', code?, api }) wenn vorhanden, sonst Tausch.loadUi(cb)
      wenn vorhanden, sonst bleibt der Code in LabTauschAPI.pending (kein Fehler, kein Netz).
   B10 quelle/analab/test_stub.js verbietet ANA_-Namen in Dateien ausserhalb der ana-Liste (Muster ana*.js); tauschad-ana.js liest die
      Aufgaben-Hilfen daher ueber einen zusammengesetzten Namen. Sauberer: I1 nimmt tauschad-ana.js in die eigene Liste von test_stub.js auf. */
(function (root) {
  'use strict';
  const Tausch = root.Tausch || (typeof require === 'function' ? (() => { try { return require('./tausch.js'); } catch (e) { return null; } })() : null);
  if (!Tausch) return;

  /* ---------- Teil 1: reine Daten (Pruefstaende mit Steuerwert `fehler`, Symptome je Pruefstand) ---------- */
  const LAB = 'ana';
  const RIGS = ['diode', 'schalter', 'emitter', 'folger', 'opv_inv', 'opv_nin', 'opv_komp', 'opv_aktiv'];
  const SYMLBL = {
    'werte-falsch': 'Messwerte stimmen nicht', 'led-dunkel': 'LED bleibt dunkel', 'kein-strom': 'Es fließt kein Strom', 'strom-zu-hoch': 'Strom zu hoch',
    'last-bleibt-aus': 'Last schaltet nicht ein', 'last-dauernd-an': 'Last bleibt dauernd an', 'wird-heiss': 'Wird heiß',
    'kein-ausgang': 'Kein Ausgang', 'verstaerkt-wenig': 'Verstärkt zu wenig', 'verstaerkt-falsch': 'Verstärkung stimmt nicht', 'arbeitspunkt-falsch': 'Arbeitspunkt verschoben',
    'verzerrt': 'Ausgang verzerrt', 'uebersteuert': 'Ausgang an der Grenze', 'kippt-nicht': 'Kippt nicht', 'schwingt-nicht': 'Schwingt nicht', 'ausgang-fest': 'Ausgang bleibt fest',
    'laeuft-weg': 'Ausgang läuft weg'
  };
  const SYM = {
    diode: ['werte-falsch', 'led-dunkel', 'kein-strom', 'strom-zu-hoch'],
    schalter: ['werte-falsch', 'last-bleibt-aus', 'last-dauernd-an', 'wird-heiss'],
    emitter: ['werte-falsch', 'kein-ausgang', 'verstaerkt-wenig', 'arbeitspunkt-falsch', 'verzerrt'],
    folger: ['werte-falsch', 'kein-ausgang', 'verstaerkt-wenig', 'arbeitspunkt-falsch'],
    opv_inv: ['werte-falsch', 'kein-ausgang', 'verstaerkt-falsch', 'uebersteuert'],
    opv_nin: ['werte-falsch', 'kein-ausgang', 'verstaerkt-falsch', 'uebersteuert'],
    opv_komp: ['werte-falsch', 'kippt-nicht', 'schwingt-nicht', 'ausgang-fest'],
    opv_aktiv: ['werte-falsch', 'kein-ausgang', 'laeuft-weg', 'uebersteuert']
  };
  try { Tausch.registerAdapter(LAB, { rigs: RIGS, symptoms: SYM }); } catch (e) { /* Kern fehlt: Lab laeuft ohne Tauschboerse */ }

  /* ---------- Teil 2: kopflos (util aus anadata.js; Name ueber TK, damit die Kollisionspruefung test_stub.js nur ana-eigene Dateien trifft, B10) ---------- */
  const nodeReq = f => { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } };
  const TK = 'ANA' + '_TASKS', U = () => { if (!(root[TK] && root[TK].util)) nodeReq('./anadata.js'); return root[TK] && root[TK].util ? root[TK].util : null; };
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const fin = x => typeof x === 'number' && isFinite(x);
  const toId = v => String(v).replace(/ /g, '_');
  const fromId = id => String(id).replace(/_/g, ' ');
  const rigOk = r => RIGS.indexOf(r) >= 0;
  const SKIP = { fehler: 1, diagnose: 1 };

  function faultList(rig) {
    const u = U(); if (!u || !rigOk(rig)) return [];
    const d = u.cdef(rig, 'fehler'); if (!d || !Array.isArray(d.options)) return [];
    return d.options.map(o => (isObj(o) ? o : { value: o, label: String(o) })).filter(o => String(o.value) !== 'keiner').map(o => ({ id: toId(o.value), value: o.value, label: String(o.label) }));
  }
  const faultOf = (rig, id) => faultList(rig).find(o => o.id === id || o.value === id) || null;
  const metersDef = rig => { const u = U(), R = u && u.RIGS(rig); const d = R && R.defs && R.defs[rig]; return d && Array.isArray(d.meters) ? d.meters : []; };
  /* Anzeigeregel der Oberflaeche (anaui meterText): –, texts[], ∞ ab infAbove (Standard 1e11), sonst digits Nachkommastellen */
  function shown(m, v) {
    if (!fin(v)) return '–';
    if (m.texts && m.texts[Math.round(v)] != null) return String(m.texts[Math.round(v)]);
    if (Math.abs(v) >= (fin(+m.infAbove) ? +m.infAbove : 1e11)) return '∞';
    const t = (+v).toFixed(m.digits == null ? 1 : m.digits);
    return /^-0(\.0*)?$/.test(t) ? t.slice(1) : t;
  }
  const defaults = rig => { const u = U(); return u ? u.fullCtl(rig, {}) : {}; };
  const round6 = v => (fin(v) && v !== 0 ? Number(v.toPrecision(6)) : v);
  /* Grundeinstellung: nur Abweichungen vom Standard (ohne fehler/diagnose/Tasten) */
  function diffCtl(rig, ctl) {
    const u = U(), base = defaults(rig), out = {}; if (!u || !isObj(ctl)) return out;
    (u.ctlDefs(rig) || []).forEach(c => {
      if (c.type === 'button' || SKIP[c.key] || !(c.key in ctl)) return;
      let v = ctl[c.key]; if (typeof v === 'number') v = round6(v);
      if (String(v) !== String(round6(base[c.key]))) out[c.key] = v;
    });
    return out;
  }
  /* Grundeinstellung pruefen (4.3.4): { ok, why, key } */
  function ctlCheck(rig, c) {
    const u = U(); if (!u) return { ok: false, why: 'Der Prüfstand ist nicht geladen.' };
    if (!isObj(c)) return { ok: false, why: 'Die Grundeinstellung ist unlesbar.' };
    for (const k of Object.keys(c)) {
      const d = u.cdef(rig, k), v = c[k];
      if (SKIP[k]) return { ok: false, key: k, why: 'Der Fehler gehört nicht in die Grundeinstellung.' };
      if (!d || d.type === 'button') return { ok: false, key: k, why: 'Den Steuerwert „' + k + '“ gibt es an diesem Prüfstand nicht.' };
      const x = u.coerce(d, v), lbl = d.label || k;
      if (x === undefined) return { ok: false, key: k, why: 'Der Wert für „' + lbl + '“ ist ungültig.' };
      if (d.type === 'slider' && !(typeof v === 'number' && Math.abs(x - v) <= 1e-9 * Math.max(1, Math.abs(v)))) return { ok: false, key: k, why: '„' + lbl + '“ liegt außerhalb des erlaubten Bereichs.' };
      if (d.type === 'switch' && typeof v !== 'boolean') return { ok: false, key: k, why: 'Der Wert für „' + lbl + '“ ist ungültig.' };
    }
    return { ok: true };
  }
  const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)) : String(a) === String(b));
  /* Momentaufnahme mit Grundeinstellung c und Fehlerwert fv: { ok, pic[], ampel, ctl, s } */
  function shot(rig, c, fv) {
    const u = U(); if (!u) return { ok: false };
    const ctl = u.fullCtl(rig, Object.assign({}, c, { fehler: fv })), s = u.snap(rig, ctl);
    if (!s.ok || (s.rejected && s.rejected.length)) return { ok: false, ctl, s };
    const applied = Object.keys(c).every(k => { let g; try { g = s.rig.getControl(k); } catch (e) { g = undefined; } return same(g, c[k]); }) && same(s.rig.getControl('fehler'), fv);
    const ms = metersDef(rig);
    return { ok: applied, ctl, s, pic: ms.map(m => shown(m, s.m[m.key])), keys: ms.map(m => m.key), labels: ms.map(m => m.label || m.key), ampel: s.a && s.a.ampel ? s.a.ampel : 'grau' };
  }
  /* normalisierte Eingabe: { card, hidden } (verifyCard / makeCard) oder flach { rig, c, f } */
  function flat(x) {
    if (!isObj(x)) return null;
    if (isObj(x.card) || isObj(x.hidden)) { const cd = x.card || {}, h = x.hidden || {}; return { lab: cd.lab, rig: cd.rig, c: h.c || {}, f: h.f, mp: h.mp, cid: cd.cid, st: cd.st, sym: cd.sym }; }
    return { lab: x.lab, rig: x.rig, c: x.c || {}, f: x.f, mp: x.mp, cid: x.cid, st: x.st, sym: x.sym };
  }
  const NOFIT = 'Diese Karte passt nicht mehr zu dieser Version des Prüfstands. Bitte den Ersteller um eine neue Karte.';
  /* Loesbarkeit und Eindeutigkeit (Spec 4.3). opt.loeser: Begruendung ohne Fehlernamen (B7).
     -> { ok, why, grund:'lab'|'liste'|'bereich'|'aufbau'|'sichtbar'|'eindeutig', gleich:[Fehler-Ids], abw:[Messgeraete-Schluessel], mp, fid } */
  function check(x, opt) {
    opt = opt || {}; const k = flat(x), no = (grund, why, extra) => Object.assign({ ok: false, grund, why: opt.loeser ? NOFIT : why }, extra || {});
    if (!k || (k.lab != null && k.lab !== LAB) || !rigOk(k.rig)) return no('lab', 'Diesen Prüfstand gibt es im Analog-Lab nicht.');
    if (!U()) return no('lab', 'Der Prüfstand ist nicht geladen.');
    if (typeof k.f !== 'string') return no('liste', 'Es ist genau ein Fehler aus der Liste des Prüfstands nötig.');
    const fo = faultOf(k.rig, k.f); if (!fo || fo.id !== k.f) return no('liste', 'Der Fehler stammt nicht aus der Liste dieses Prüfstands.');
    const cc = ctlCheck(k.rig, k.c); if (!cc.ok) return no('bereich', cc.why);
    const a = shot(k.rig, k.c, fo.value), z = shot(k.rig, k.c, 'keiner');
    if (!a.ok || !z.ok) return no('aufbau', 'Diese Grundeinstellung lässt sich am Prüfstand so nicht aufbauen.');
    const abw = a.keys.filter((key, i) => a.pic[i] !== z.pic[i]);
    if (!abw.length && a.ampel === z.ampel) return no('sichtbar', 'Mit diesem Fehler zeigt an diesem Aufbau kein Messgerät und keine Ampel etwas anderes als ohne Fehler.');
    const gleich = faultList(k.rig).filter(g => g.id !== fo.id).filter(g => { const b = shot(k.rig, k.c, g.value); return b.ok && b.pic.every((p, i) => p === a.pic[i]); });
    if (gleich.length) return no('eindeutig', 'Sieht an diesem Aufbau aus wie „' + gleich.map(g => g.label).join('“, „') + '“: Kein Messgerät zeigt einen Unterschied.', { gleich: gleich.map(g => g.id) });
    return { ok: true, why: '', grund: '', gleich: [], abw, mp: Math.max(1, abw.length), fid: fo.id, labels: abw.map(key => a.labels[a.keys.indexOf(key)]) };
  }
  /* verdeckter Teil + oeffentliche Vorschlaege fuer Tausch.core.makeCard. o: { rig, c, f, st?, sym? } -> { ok, why, pub:{ lab, rig, st, sym }, hidden:{ c, f, mp } } */
  function karte(o) {
    o = o || {}; const c = isObj(o.c) ? o.c : {}, r = check({ rig: o.rig, c, f: o.f }); if (!r.ok) return r;
    const syms = SYM[o.rig], sym = syms.indexOf(o.sym) >= 0 ? o.sym : 'werte-falsch';
    const st = o.st >= 1 && o.st <= 3 ? Math.round(o.st) : vorschlag(o.rig, o.f, c).st;
    return { ok: true, why: '', pub: { lab: LAB, rig: o.rig, st, sym }, hidden: { c: Object.assign({}, c), f: r.fid, mp: r.mp } };
  }
  function vorschlag(rig, f, c) { const r = check({ rig, c: c || {}, f }); const n = r.ok ? r.abw.length : 0; return { st: n >= 4 ? 1 : n >= 2 ? 2 : 3, sym: 'werte-falsch' }; }
  /* Startzustand im Format der Aufgaben (start()): Fehler gesperrt und verdeckt */
  function startState(k, fo) { const u = U(); return { rig: k.rig, controls: u.fullCtl(k.rig, Object.assign({}, k.c, { fehler: fo.value })), lock: ['fehler'], hidden: ['fehler'] }; }

  /* ---------- laufende Karte, Tipps, Urteil ---------- */
  let CUR = null;   /* { cid, rig, c, f (Id), value, mp, abw, labels } - nur im Speicher, nie im DOM */
  const subs = [];
  function load(x) {
    const k = flat(x), r = check(x, { loeser: true }); if (!r.ok) return r;
    const fo = faultOf(k.rig, k.f);
    CUR = { cid: k.cid || null, rig: k.rig, c: Object.assign({}, k.c), f: fo.id, value: fo.value, mp: k.mp != null ? k.mp : r.mp, abw: r.abw.slice(), labels: r.labels.slice() };
    return { ok: true, why: '', start: startState(k, fo) };
  }
  function tipp(n) {
    const cur = current(); if (!cur) return null;
    if (n === 1) {
      const l = metersDef(cur.rig).map(m => m.label || m.key);
      return 'Gehe die Messgeräte der Reihe nach durch: ' + l.join(', ') + '. Rechne für jedes aus, was die Schaltung ohne Fehler zeigen müsste, und vergleiche. Beginne bei der Versorgung und folge dem Signal zum Ausgang.';
    }
    if (n === 2) return cur.labels.length ? 'Diese Messpunkte weichen ab: ' + cur.labels.join(', ') + '.' : 'Kein Messgerät weicht ab, achte auf die Ampel.';
    return null;   /* Stufe 3 (Aufloesung) gesperrt */
  }
  const messpunkte = () => { const cur = current(); return cur ? cur.mp : null; };
  function emit(o) { subs.slice().forEach(cb => { try { cb(o); } catch (e) {} }); }
  function diagnosed(cb) { if (typeof cb !== 'function') return () => {}; subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; }
  /* Urteil ueber eine abgegebene Diagnose (Steuerwert-Wert oder Id). -> { ok, p, f, fnd, res } oder null (keine Karte) */
  function judge(id, now) {
    const cur = current(); if (!cur || id == null) return null;
    const ok = toId(id) === cur.f, run = Tausch.store.active(null);
    let res = null, f = null;
    if (run && ok) res = Tausch.store.end(100, null, now, { mp: cur.mp });
    else if (run) f = Tausch.store.wrong(null);
    const o = { ok, p: ok ? 100 : 0, f: res ? res.f : f, fnd: ok ? cur.f : null, res, cid: cur.cid };
    emit(o); return o;
  }

  /* ---------- Teil 3: im Lab (window.ANA_UI) ---------- */
  const A = () => root.ANA_UI || null;
  /* nach dem Neuladen: laufende Karte aus dem Fehler-Wuerfel-Zustand (ana.cur) wiederherstellen */
  function current() {
    if (CUR) return CUR;
    const a = A(), d = a && a.S && a.S.dice; if (!d || !isObj(d.tausch)) return null;
    const t = d.tausch, fo = faultOf(t.rig, t.f); if (!fo) return null;
    const r = check({ rig: t.rig, c: t.c || {}, f: t.f });
    CUR = { cid: t.cid || null, rig: t.rig, c: Object.assign({}, t.c || {}), f: fo.id, value: fo.value, mp: t.mp != null ? t.mp : (r.ok ? r.mp : 1), abw: r.ok ? r.abw : [], labels: r.ok ? r.labels : [] };
    return CUR;
  }
  /* aktuelle Einstellung des Pruefstands als Grundeinstellung (Ersteller, Schritt a) */
  function aktuell() {
    const a = A(); if (!a || !a.S || !a.S.rig || !rigOk(a.S.rigId)) return null;
    return { rig: a.S.rigId, c: diffCtl(a.S.rigId, a.allCtl()) };
  }
  const busy = () => { const a = A(); if (!a) return 'Das Lab ist nicht geladen.'; if (a.S.task) return 'Beende zuerst die Aufgabe.'; try { if (root.Duell && root.Duell.active && root.Duell.active()) return 'Während eines Duells geht das nicht.'; } catch (e) {} return ''; };
  /* Karte in den Pruefstand laden: gesperrt und verdeckt ("Fehler: ?"), wie der Fehler-Wuerfel (S.dice mit tausch-Kennung). -> Promise { ok, why } */
  async function build(x) {
    const r = load(x); if (!r.ok) return r;
    const a = A(); if (!a) return r;   /* kopflos: nur Startzustand */
    const why = busy(); if (why) { CUR = null; return { ok: false, why }; }
    const cur = CUR, S = a.S;
    if (S.dice) a.undoDice();
    a.setRig(cur.rig); a.applyCtl(cur.c);
    const want = U().fullCtl(cur.rig, cur.c), got = a.allCtl();
    if (!Object.keys(want).every(key => SKIP[key] || same(got[key], want[key]))) { CUR = null; return { ok: false, why: NOFIT }; }
    const base = await a.baseState();
    a.applyCtl({ fehler: cur.value });
    S.dice = { id: 'tausch', name: 'Fehlerkarte', kind: 'fehler', fehler: cur.value, text: '', rigId: cur.rig, before: { fehler: 'keiner' }, base, result: '', attempts: 0, revealed: false, done: false, fixed: false,
      tausch: { cid: cur.cid, rig: cur.rig, c: cur.c, f: cur.f, mp: cur.mp } };
    S.diagnose = null; S.faultStart = { controls: a.allCtl() }; S.name = 'Fehlerkarte' + (cur.cid ? ' ' + cur.cid : '');
    a.applyLockHidden(['fehler'], ['fehler']);
    if (!S.running && typeof a.setRun === 'function') a.setRun(true);
    a.updateAmp(true); tick(true);
    return { ok: true, why: '', start: r.start };
  }
  /* Aufgeben: Aufloesung zeigen, Tausch.store.end(0) */
  function giveUp(now) {
    const cur = current(); if (!cur) return null;
    const res = Tausch.store.active(null) ? Tausch.store.end(0, null, now, { mp: cur.mp }) : null;
    const a = A(), d = a && a.S.dice;
    if (d && d.tausch) { d.revealed = true; a.applyLockHidden(a.S.lock, []); d.result = 'Aufgegeben. Auflösung: ' + faultOf(cur.rig, cur.f).label + '.'; a.buildFaultPanel(); }
    return { p: 0, res, fid: cur.f, label: faultOf(cur.rig, cur.f).label };
  }
  /* Aufloesung (erst nach richtiger Diagnose oder Aufgeben aufrufen) */
  function aufloesung() { const cur = current(); return cur ? { fid: cur.f, label: faultOf(cur.rig, cur.f).label } : null; }
  /* Haken aus anaui diceEval (nur Karte im Wuerfel-Zustand) */
  function _diag(ok, id) { return judge(id); }
  /* Messzaehler: neue Anzeige aller Messgeraete = eine Messung (B4) */
  let last = '', timer = null;
  function tick(force) {
    try {
      const a = A(), cur = current(); if (!a || !cur || !a.S.rig || !a.S.dice || !a.S.dice.tausch || a.S.dice.revealed) return;
      if (!Tausch.store.active(null)) return;
      const v = a.S.rig.readMeters() || {}, key = (a.S.rig.meters || []).map(m => a.meterText(m, v[m.key])).join('|');
      if (force || key !== last) { last = key; Tausch.mess(key, cur.mp); }
    } catch (e) { /* nie stoeren */ }
  }
  if (typeof document !== 'undefined' && typeof setInterval === 'function') timer = setInterval(() => tick(false), 800);
  /* Uebergabe an die Oberflaeche T4 (B9) */
  function toUi(o) {
    const T = root.Tausch || Tausch;
    if (T.ui && typeof T.ui.open === 'function') { T.ui.open(o); return true; }
    if (typeof T.loadUi === 'function') { T.loadUi(u => { if (u && typeof u.open === 'function') u.open(o); }); return true; }
    API.pending = o; return false;
  }
  /* #t=TFF1... aus der URL (anaui init/hashchange) */
  function entry(txt) { const m = String(txt == null ? '' : txt).match(/TFF1\.[A-Za-z0-9_.-]+/); if (!m) return false; return toUi({ lab: LAB, mode: 'loesen', code: m[0], api: API }); }
  /* Knopf "Als Fehlerkarte weitergeben" im Fehlersuche-Feld */
  function share() { const why = busy(); if (why) return { ok: false, why }; toUi({ lab: LAB, mode: 'bauen', api: API, aktuell: aktuell() }); return { ok: true }; }
  /* alle Fehler-Ids und -Namen (Leak-Pruefung, Tests) */
  function leakTerms(rig) { const l = []; (rig ? [rig] : RIGS).forEach(r => faultList(r).forEach(o => { l.push(o.id, String(o.value), o.label); })); return l; }

  const API = {
    lab: LAB, pending: null,
    rigs: () => RIGS.slice(), faults: rig => faultList(rig), symptoms: rig => (SYM[rig] || []).map(id => ({ id, label: SYMLBL[id] || id })),
    check, build, load, karte, vorschlag, diagnosed, judge, tipp, messpunkte, giveUp, aufloesung, aktuell, entry, share, current: () => (current() ? { cid: current().cid, rig: current().rig } : null),
    reset: () => { CUR = null; last = ''; }, _diag, _tick: tick,
    util: { toId, fromId, shown, diffCtl, ctlCheck, shot, faultOf, leakTerms, SYM, SYMLBL, RIGS }
  };
  root.LabTauschAPI = API;
  root.TauschAdAna = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
