/* tauschad-els.js - Fehler-Tauschboerse, Lab-Adapter Sicherheits-Lab els (Paket T3c, Spec quelle/SPEC-TAUSCH-WETTBEWERB.md 2.1, 2.2, 4.3, 4.5).
   Pruefstand: Pruefplatz Geraetepruefung (elsrig-pruefplatz.js), 14 Pruefling x 8 Maengel (Steuerwerte m_<mangel>, zufall/seed/anzahl).
   Eine Fehlerkarte = vorhandener Pruefstand + Grundeinstellung c { geraet, seed?, modus? } + Maengel-LISTE f (1-3 Mangel-Ids aus ELS_CORE.device.faults).
   Teil 1 (ohne DOM, auch Node/Ausbilder-Uebersicht): Tausch.registerAdapter('els', { rigs, symptoms }) beim Laden.
   Teil 2 LabTauschAPI (root.ElsTausch.api, im Lab zusaetzlich root.LabTauschAPI): rigs, faults(rig), symptoms(rig), build, check, diagnosed, tipp, messpunkte
   und Hilfen fuer T4 (draft, suggest, choices, diagnose, aufgeben, aufloesung, active, symptomLabel, rigLabel, blocked).
   Gerechnet wird NUR im Kern (ELS_CORE.device.measureAll / verdict); hier steht keine zweite Formel.
   Verdeckung (4.5): Die gebaute Karte laeuft in einem UMHUELLTEN Pruefstand: Steuerwerte geraet/modus/zufall/seed/anzahl/m_* gesperrt und aus
   controls/presets/roles entfernt; getControls/getControl/snapshot/state/pruefling/protokollWerte ohne Maengel; assess/diagnose/Meldungen/ariaLabel/
   Canvas-Text (fillText/strokeText/measureText) laufen durch mask(): Mangelnamen und Klammerzusaetze mit Mangelnamen fallen weg, Ids werden ersetzt.
   Tipp 1 = feste Pruefreihenfolge, Tipp 2 = abweichende Pruefschritte/Stellen (nie die Ursache), Stufe 3 und Aufloesung bis zur richtigen Diagnose
   oder zum Aufgeben gesperrt. Messzaehler: jeder neu durchgefuehrte Pruefschritt bzw. jede gepruefte Stelle -> Tausch.mess('els:<schritt>', mp).
   Annahmen (Spec offen, konservativ entschieden):
   E1 Nur der Pruefplatz ist Tausch-Pruefstand (rig 'pruefplatz'); netz/klassen (Steuerwert fehler) bleiben aussen vor (Spec E1: els-Pruefplatz).
   E2 Karte hat 1 bis 3 Maengel (wie der Zufall, anzahl 0-3); 0 Maengel = abgelehnt ('leer'), mehr als 3 = abgelehnt ('zuviel').
   E3 Befund = je Pruefschritt (sicht, rpe, riso, ipe/ber) Status (ok/rot) und Wert ohne Rauschen; Sichtpruefung = Menge der Stellen mit Mangel.
      Zwei Befunde gelten als gleich, wenn alle Status gleich sind und jeder Wert innerhalb EIND (25 %) liegt (Rauschen der Anzeige hoechstens 2 %);
      ueber dem Messbereich (>= 5e5 Ohm) ist ein eigener Wert. Sichtbarkeit (4.3.2): JEDER Mangel der Karte macht seinen Pruefschritt einzeln rot
      (bzw. zeigt seine Stelle bei der Sichtpruefung), sonst 'unsichtbar'. Eindeutigkeit (4.3.3): Befund unterscheidet sich von dem JEDER anderen
      gueltigen Maengel-Kombination (alle Teilmengen der am Pruefling moeglichen Maengel ohne Ausschluss-Paare, auch der leeren), sonst 'mehrdeutig'.
   E4 Grundeinstellung (4.3.4): c darf nur geraet (Katalog), seed (ganz 1-99), modus (wiederholung|instandsetzung) enthalten; zufall wird beim Bauen
      in eine feste Liste aufgeloest (draft). Mangel nicht moeglich am Pruefling -> 'unmoeglich', Ausschluss-Paar -> 'ausschluss'.
   E5 check(x) liefert why IMMER ohne Mangelnamen (laeuft auch beim Loeser, 4.3.5); detail mit Namen nur mit opt.ersteller = true.
   E6 Diagnose = Liste der Mangel-Ids, richtig nur bei GLEICHER Menge (Reihenfolge egal). Teilweise richtig = Fehlversuch (Tausch.store.wrong).
      Richtig -> Tausch.store.end(100), Aufgeben -> end(0); das Ergebnis enthaelt fnd (sortierte Liste) fuer den Beleg (Tausch.core.beleg).
   E7 Messpunkte mp (Richtwert fuer Duell A) = volle Pruefung: 3 Stellen + Schritte des Prueflings (SK I: rpe, riso, ipe = 6; SK II: riso, ber = 5).
   E8 tipp(n) zaehlt ueber Tausch.store.tipp nur beim ersten Erreichen einer Stufe (n > bisher genutzt) und nur bei laufender Suche; T4 zaehlt nicht
      zusaetzlich. n >= 3 -> { blocked:true } (Stufe 3 gesperrt).
   E9 Vorschlag Symptom = 'routine' (neutral, verraet nichts); Stufe: nur ein Sicht-Mangel 1, sonst 2, ab 2 Mess-Maengeln oder 3 Maengeln 3.
   E10 Im umhuellten Pruefstand sind auch Voreinstellungen (presets) und restore/applyPreset gesperrt; snapshot liefert Steuerwerte ohne Maengel
      (Vorher/Nachher zeigt dann einen Pruefling ohne Mangel). Proto-Tab, Teilen, Speichern, Wuerfel, Pruefstandwechsel sperrt T4 (Klick-Sperre).
   E11 Ohne ELS_UI (Node, Uebersicht) baut build(x) einen kopflosen Pruefstand und liefert { ok, rig }; im Lab laedt der Haken ELS_TAUSCH_UI.load
      den umhuellten Pruefstand in die Oberflaeche. Nur der Haken in elsui.js (Knopf, #t=) beruehrt die Oberflaeche; den Rest baut T4 (TauschUI).
*/
(function (root) {
  'use strict';
  const req = n => { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } };
  const T = () => root.Tausch || null;
  if (!root.Tausch && typeof module !== 'undefined' && module.exports) req('./tausch.js');

  const LAB = 'els', RIG = 'pruefplatz';
  const EIND = 0.25, OVER = 5e5, MAXF = 3;
  const SYM = [['routine', 'Wiederholungsprüfung fällig'], ['reparatur', 'Zurück aus der Reparatur'], ['rcd-loest', 'RCD löst beim Kunden aus'],
    ['kribbeln', 'Kunde spürt ein Kribbeln'], ['heruntergefallen', 'Gerät ist heruntergefallen'], ['feuchter-raum', 'Gerät stand im Feuchtraum']];
  const SYMIDS = SYM.map(s => s[0]);
  const SPOTS = ['leitung', 'stecker', 'gehaeuse'];
  const SPOT_FAULT = { leitung: 'leitung-beschaedigt', stecker: 'stecker-lose', gehaeuse: 'gehaeuse-gebrochen' };
  const SPOT_NAME = { leitung: 'Anschlussleitung', stecker: 'Stecker', gehaeuse: 'Gehäuse' };
  const STEP_NAME = { sicht: 'Sichtprüfung', rpe: 'Schutzleiterwiderstand', riso: 'Isolationswiderstand', ipe: 'Schutzleiterstrom', ber: 'Berührungsstrom' };
  const FREE = ['schritt', 'fire', 'sicht_leitung', 'sicht_stecker', 'sicht_gehaeuse'];       /* alles andere ist im Tausch gesperrt */
  const MODI = ['wiederholung', 'instandsetzung'];
  const WHY = {
    rig: 'Diese Karte gehört zu keinem Prüfstand dieses Labs.', grund: 'Die Grundeinstellung der Karte ist ungültig.',
    leer: 'Die Karte enthält keinen Mangel.', zuviel: 'Eine Karte darf höchstens ' + MAXF + ' Mängel enthalten.',
    unbekannt: 'Die Karte enthält einen Mangel, den dieses Lab nicht kennt.', unmoeglich: 'Ein Mangel der Karte ist an diesem Prüfling nicht möglich.',
    ausschluss: 'Zwei Mängel der Karte schließen sich aus.', unsichtbar: 'Ein Mangel der Karte zeigt sich bei keinem Prüfschritt.',
    mehrdeutig: 'Der Befund der Prüfschritte sieht an diesem Prüfling aus wie eine andere Mängel-Kombination.', symptom: 'Das Symptom der Karte ist unbekannt.',
    kern: 'Der Prüfplatz ist nicht geladen.'
  };

  /* ---------- Kern lazy (Node: require; Browser: ELS_CORE/ELS_RIGS der Seite) ---------- */
  function core() {
    if (!(root.ELS_CORE && root.ELS_CORE.device)) { req('./elscore.js'); req('./elscore-pruef.js'); }
    const c = root.ELS_CORE; return c && c.device && c.device.catalog ? c : null;
  }
  function rigsMod() {
    if (!(root.ELS_RIGS && root.ELS_RIGS.defs && root.ELS_RIGS.defs[RIG])) req('./elsrig-pruefplatz.js');
    const R = root.ELS_RIGS; return R && R.defs && R.defs[RIG] ? R : null;
  }
  const D = () => { const c = core(); return c ? c.device : null; };
  const allFaults = () => { const d = D(); return d ? d.faults.slice() : []; };
  const catOf = id => { const d = D(); return d ? d.catalog.find(x => x.id === id) || null : null; };
  const fkey = id => 'm_' + String(id).replace(/-/g, '_');
  const EXCL = [['pe-unterbrochen', 'pe-hochohmig'], ['isolation-feucht', 'isolation-defekt']];
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const uniqSorted = l => Array.from(new Set(l.map(String))).sort();

  /* ---------- Verdeckung: Text ohne Mangelnamen und -Ids ---------- */
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let MASK = null;
  function maskTab() {
    if (MASK) return MASK; const d = D(); if (!d) return null;
    const names = d.faults.map(id => d.faultName[id]).filter(Boolean).sort((a, b) => b.length - a.length);
    const ids = d.faults.slice().sort((a, b) => b.length - a.length);
    MASK = { names, nameRe: names.map(n => new RegExp(reEsc(n), 'gi')), idRe: ids.map(i => new RegExp(reEsc(i), 'gi')), keyRe: ids.map(i => new RegExp(reEsc(fkey(i)), 'gi')) };
    return MASK;
  }
  /* Klammerzusaetze (eine Ebene Schachtelung) mit Mangelnamen entfallen ganz, Reste werden zu "Mangel" */
  function mask(t) {
    if (t == null) return t; let s = String(t); const M = maskTab(); if (!M) return s;
    const low = s.toLowerCase();
    if (!M.names.some(n => low.indexOf(n.toLowerCase()) >= 0) && !/[a-z]-[a-z]/.test(s) && s.indexOf('m_') < 0) return s;
    s = s.replace(/\s*\((?:[^()]|\([^()]*\))*\)/g, p => (M.names.some(n => p.toLowerCase().indexOf(n.toLowerCase()) >= 0) ? '' : p));
    M.nameRe.forEach(r => { s = s.replace(r, 'Mangel'); });
    M.keyRe.forEach(r => { s = s.replace(r, 'Mangel'); });
    M.idRe.forEach(r => { s = s.replace(r, 'Mangel'); });
    return s;
  }
  /* leaks(text): gefundene Mangelnamen/Ids (fuer Tests und Selbstpruefung) */
  function leaks(text) {
    const M = maskTab(); if (!M) return []; const s = String(text == null ? '' : text).toLowerCase(), out = [];
    M.names.forEach(n => { if (s.indexOf(n.toLowerCase()) >= 0) out.push(n); });
    allFaults().forEach(i => { if (s.indexOf(i) >= 0) out.push(i); if (s.indexOf(fkey(i).toLowerCase()) >= 0) out.push(fkey(i)); });
    return out;
  }

  /* ---------- Befund ohne Rauschen (nur Kern) ---------- */
  function befund(geraet, faults, seed) {
    const d = D(), c = catOf(geraet); if (!d || !c) return null;
    const m = d.measureAll({ id: c.id, faults: faults.slice(), seed: seed || 1 }, { rauschen: false });
    const vd = d.verdict({ sicht: m.sicht, rpe: m.rpe, riso: m.riso, ipe: m.ipe, ber: m.ber }, { id: c.id });
    const b = { sk: c.sk, spots: SPOTS.filter(sp => m.sicht.indexOf(SPOT_FAULT[sp]) >= 0), steps: {} };
    vd.steps.forEach(s => { if (s.id !== 'sicht') b.steps[s.id === 'ipe' && c.sk === 'II' ? 'ber' : s.id] = { st: s.status, v: s.wert }; });
    b.sicht = b.spots.length ? 'rot' : 'ok';
    return b;
  }
  const near = (a, b) => { if (a == null || b == null) return a === b; if (a >= OVER || b >= OVER) return a >= OVER && b >= OVER; const m = Math.max(Math.abs(a), Math.abs(b)); return m === 0 || Math.abs(a - b) <= EIND * m; };
  function sameBefund(a, b) {
    if (!a || !b || a.spots.join() !== b.spots.join()) return false;
    const ks = Object.keys(a.steps); if (ks.join() !== Object.keys(b.steps).join()) return false;
    return ks.every(k => a.steps[k].st === b.steps[k].st && near(a.steps[k].v, b.steps[k].v));
  }
  /* abweichende Pruefschritte/Stellen gegen den Pruefling ohne Mangel (fuer Tipp 2, Sichtbarkeit) */
  function abweichend(geraet, faults, seed) {
    const b0 = befund(geraet, [], seed), b = befund(geraet, faults, seed); if (!b0 || !b) return null;
    const out = { spots: b.spots.slice(), steps: Object.keys(b.steps).filter(k => b.steps[k].st !== b0.steps[k].st || !near(b.steps[k].v, b0.steps[k].v)) };
    return out;
  }
  const exclOk = l => EXCL.every(g => !(l.indexOf(g[0]) >= 0 && l.indexOf(g[1]) >= 0));
  /* alle gueltigen Kombinationen (Teilmengen der moeglichen Maengel ohne Ausschluss-Paare), inkl. leer */
  function combos(geraet) {
    const c = catOf(geraet); if (!c) return [];
    const p = c.defekteMoeglich.slice(), out = [];
    for (let mk = 0; mk < (1 << p.length); mk++) { const l = p.filter((x, i) => mk & (1 << i)); if (exclOk(l)) out.push(l); }
    return out;
  }

  /* ---------- Karte lesen: { card, hidden } | { rig, c, f, mp, sym } ---------- */
  function parts(x) {
    x = isObj(x) ? x : {};
    if (isObj(x.hidden)) return { rig: x.card && x.card.rig, sym: x.card && x.card.sym, c: x.hidden.c, f: x.hidden.f, mp: x.hidden.mp };
    return { rig: x.rig == null ? RIG : x.rig, sym: x.sym, c: x.c, f: x.f, mp: x.mp };
  }
  function grund(c) {
    c = c == null ? {} : c; if (!isObj(c)) return null;
    const keys = Object.keys(c); if (keys.some(k => ['geraet', 'seed', 'modus'].indexOf(k) < 0)) return null;
    const g = c.geraet == null ? 'wasserkocher' : c.geraet; if (typeof g !== 'string' || !catOf(g)) return null;
    let seed = 1; if (c.seed != null) { if (typeof c.seed !== 'number' || !isFinite(c.seed) || Math.round(c.seed) !== c.seed || c.seed < 1 || c.seed > 99) return null; seed = c.seed; }
    const modus = c.modus == null ? 'wiederholung' : c.modus; if (MODI.indexOf(modus) < 0) return null;
    return { geraet: g, seed, modus };
  }
  const bad = (code, detail, ersteller) => { const r = { ok: false, code, why: WHY[code] }; if (ersteller && detail) r.detail = detail; return r; };
  const fname = id => { const d = D(); return (d && d.faultName[id]) || id; };
  /* check(x, opt): 4.3 Loesbarkeit und Eindeutigkeit. { ok, why, code, detail? (nur opt.ersteller) } */
  function check(x, opt) {
    opt = opt || {}; const er = !!opt.ersteller;
    try {
      if (!D()) return bad('kern');
      const p = parts(x);
      if (p.rig !== RIG) return bad('rig');
      if (p.sym != null && SYMIDS.indexOf(p.sym) < 0) return bad('symptom');
      const g = grund(p.c); if (!g) return bad('grund');
      const raw = typeof p.f === 'string' ? [p.f] : Array.isArray(p.f) ? p.f : null;
      if (!raw || !raw.length) return bad('leer');
      if (raw.some(v => typeof v !== 'string')) return bad('unbekannt');
      const f = uniqSorted(raw), all = allFaults();
      if (f.length > MAXF) return bad('zuviel');
      const unk = f.filter(id => all.indexOf(id) < 0); if (unk.length) return bad('unbekannt', 'Unbekannt: ' + unk.join(', '), er);
      const cat = catOf(g.geraet), um = f.filter(id => cat.defekteMoeglich.indexOf(id) < 0);
      if (um.length) return bad('unmoeglich', 'Am Prüfling ' + cat.name + ' nicht möglich: ' + um.map(fname).join(', ') + '.', er);
      const ex = EXCL.find(gp => f.indexOf(gp[0]) >= 0 && f.indexOf(gp[1]) >= 0);
      if (ex) return bad('ausschluss', 'Schließen sich aus: ' + fname(ex[0]) + ' und ' + fname(ex[1]) + '.', er);
      /* 4.3.2 jeder Mangel einzeln sichtbar */
      const b0 = befund(g.geraet, [], g.seed);
      const blind = f.filter(id => { const b = befund(g.geraet, [id], g.seed); return !b || sameBefund(b, b0) || !(b.spots.length > b0.spots.length || Object.keys(b.steps).some(k => b.steps[k].st === 'rot' && b0.steps[k].st !== 'rot')); });
      if (blind.length) return bad('unsichtbar', 'Zeigt sich am Prüfling ' + cat.name + ' nicht: ' + blind.map(fname).join(', ') + '.', er);
      /* 4.3.3 eindeutig gegen jede andere gueltige Kombination */
      const bf = befund(g.geraet, f, g.seed), key = f.join(',');
      const twin = combos(g.geraet).find(l => uniqSorted(l).join(',') !== key && sameBefund(befund(g.geraet, l, g.seed), bf));
      if (twin) return bad('mehrdeutig', 'Sieht an diesem Prüfling aus wie: ' + (twin.length ? twin.map(fname).join(', ') : 'kein Mangel') + '.', er);
      return { ok: true, why: '', code: 'ok', f, c: g, mp: messpunkte(g.geraet) };
    } catch (e) { return bad('kern'); }
  }
  function messpunkte(geraet) {
    if (geraet == null) geraet = A ? A.g.geraet : null;
    const c = catOf(geraet); return c ? SPOTS.length + (c.sk === 'I' ? 3 : 2) : 0;
  }
  /* Vorschlag fuer den Bau-Assistenten (E9) */
  function suggest(f) {
    const l = uniqSorted(Array.isArray(f) ? f : [f].filter(Boolean)), mess = l.filter(id => SPOTS.every(sp => SPOT_FAULT[sp] !== id)).length;
    const st = l.length >= 3 || mess >= 2 ? 3 : (l.length === 1 && mess === 0 ? 1 : 2);
    return { sym: 'routine', st };
  }

  /* ---------- Umhuellter (gesperrter, verdeckter) Pruefstand ---------- */
  let A = null;                                       /* aktive Karte { g, f, mp, rig, seen, done, res, h, s } */
  const LISTEN = [];
  function maskCtl(o, defs) {
    const out = {}; Object.keys(o || {}).forEach(k => { if (k === 'zufall' || k === 'anzahl' || /^m_/.test(k)) return; out[k] = o[k]; });
    const dz = (defs || []).find(c => c.key === 'zufall'); if (dz) out.zufall = false;
    return out;
  }
  const MASKED = typeof WeakSet === 'function' ? new WeakSet() : null;
  /* Canvas-Text verdecken: Methoden am Kontext-Objekt selbst ueberdecken (eigene Eigenschaft), danach wieder entfernen */
  function maskCtx(ctx) {
    if (!ctx || typeof ctx !== 'object' || !MASKED || MASKED.has(ctx)) return null;
    const ft = ctx.fillText, st = ctx.strokeText, mt = ctx.measureText;
    try {
      if (typeof ft === 'function') ctx.fillText = function (s, a, b, c) { return c === undefined ? ft.call(this, mask(s), a, b) : ft.call(this, mask(s), a, b, c); };
      if (typeof st === 'function') ctx.strokeText = function (s, a, b, c) { return c === undefined ? st.call(this, mask(s), a, b) : st.call(this, mask(s), a, b, c); };
      if (typeof mt === 'function') ctx.measureText = function (s) { return mt.call(this, mask(s)); };
      MASKED.add(ctx);
    } catch (e) { /* Kontext ohne ueberschreibbare Methoden: Text bleibt, Leak-Test zeigt es */ }
    return () => { try { delete ctx.fillText; delete ctx.strokeText; delete ctx.measureText; } catch (e) {} MASKED.delete(ctx); };
  }
  function wrap(rig, ctx) {
    if (!rig || rig.__tausch) return rig;
    ctx = ctx || {};
    const defs = rig.controls || [], hidden = new Set(defs.map(c => c.key).filter(k => FREE.indexOf(k) < 0));
    const o = {}; ['setControl', 'getControl', 'getControls', 'snapshot', 'restore', 'applyPreset', 'state', 'assess', 'diagnose', 'ariaLabel', 'draw', 'fire', 'do', 'inspect', 'pruefling', 'protokollWerte'].forEach(k => { if (typeof rig[k] === 'function') o[k] = rig[k]; });
    const defVal = k => { const d = defs.find(c => c.key === k); return d ? d.value : undefined; };
    const seen = ctx.seen || { done: [], spots: [] };
    const count = () => {
      try {
        const s = o.state(), mp = ctx.mp || 0;
        (s.inspected || []).forEach(sp => { if (seen.spots.indexOf(sp) < 0) { seen.spots.push(sp); if (T()) T().store.mess('els:sicht:' + sp, mp, ctx.s || null); } });
        (s.done || []).forEach(sp => { if (sp !== 'sicht' && seen.done.indexOf(sp) < 0) { seen.done.push(sp); if (T()) T().store.mess('els:' + sp, mp, ctx.s || null); } });
      } catch (e) {}
    };
    const after = r => { count(); return r; };
    rig.setControl = (k, v) => (hidden.has(k) ? false : after(o.setControl(k, v)));
    rig.getControl = k => (hidden.has(k) && (k === 'zufall' || k === 'anzahl' || /^m_/.test(k)) ? defVal(k) : o.getControl(k));
    rig.getControls = () => maskCtl(o.getControls(), defs);
    rig.snapshot = () => { const s = o.snapshot(); return Object.assign({}, s, { ctl: maskCtl(s.ctl, defs) }); };
    rig.restore = () => false;
    rig.applyPreset = () => false;
    rig.controls = defs.filter(c => !hidden.has(c.key));
    rig.presets = [];
    if (rig.roles) { const r = {}; Object.keys(rig.roles).forEach(k => { r[k] = (rig.roles[k] || []).filter(x => !hidden.has(x)); }); rig.roles = r; }
    rig.state = () => { const s = Object.assign({}, o.state()); delete s.faults; Object.keys(s).forEach(k => { if (/^m_/.test(k) || k === 'anzahl') delete s[k]; }); if ('zufall' in s) s.zufall = false; if (s.ctl) s.ctl = maskCtl(s.ctl, defs); return s; };
    rig.assess = () => { const a = Object.assign({}, o.assess()); a.text = mask(a.text); if (typeof a.zusatz === 'string') a.zusatz = mask(a.zusatz); if (Array.isArray(a.rows)) a.rows = a.rows.map(x => Object.assign({}, x, { text: mask(x.text) })); return a; };
    rig.diagnose = () => (o.diagnose() || []).map(x => Object.assign({}, x, { text: mask(x.text) }));
    if (o.ariaLabel) rig.ariaLabel = () => mask(o.ariaLabel());
    if (o.draw) rig.draw = function (c2) { const undo = maskCtx(c2); try { return o.draw.apply(rig, arguments); } finally { if (undo) undo(); } };
    if (o.fire) rig.fire = () => after(o.fire());
    if (o.do) rig.do = n => after(o.do(n));
    if (o.inspect) rig.inspect = sp => after(o.inspect(sp));
    if (o.pruefling) rig.pruefling = () => { const p = o.pruefling(); return p ? Object.assign({}, p, { faults: [] }) : p; };
    if (o.protokollWerte) rig.protokollWerte = () => { const p = o.protokollWerte(); if (!p) return p; const q = Object.assign({}, p); if (q.dev) q.dev = Object.assign({}, q.dev, { faults: [] }); if (Array.isArray(q.sicht)) q.sicht = q.sicht.map(() => 'mangel'); return q; };
    /* Meldungen: neue und vorhandene Texte verdeckt (say() schreibt mit push in dasselbe Feld) */
    const ev = rig.events;
    if (Array.isArray(ev)) {
      ev.forEach(e => { if (e && e.text) e.text = mask(e.text); });
      try { Object.defineProperty(ev, 'push', { configurable: true, writable: true, value: function () { for (let i = 0; i < arguments.length; i++) { const e = arguments[i]; if (e && typeof e.text === 'string') e.text = mask(e.text); } return Array.prototype.push.apply(this, arguments); } }); } catch (e) {}
    }
    Object.defineProperty(rig, '__tausch', { value: true });
    return rig;
  }
  /* kopfloser Pruefstand zur Karte (Node, Tests); im Lab baut ELS_TAUSCH_UI.load denselben Aufbau in die Oberflaeche */
  function controlsOf(g, f) {
    const ctl = { geraet: g.geraet, modus: g.modus, seed: g.seed, zufall: false, schritt: 'sicht' };
    allFaults().forEach(id => { ctl[fkey(id)] = f.indexOf(id) >= 0; });
    return ctl;
  }
  /* build(x, opt): Pruefung 4.3 (auch beim Loeser), dann gesperrter und verdeckter Pruefstand. opt { headless, s (Speicher), probe } */
  function build(x, opt) {
    opt = opt || {};
    const ck = check(x); if (!ck.ok) return { ok: false, why: ck.why, code: ck.code };
    const ctx = { mp: ck.mp, s: opt.s || null, seen: { done: [], spots: [] } };
    const st = { g: ck.c, f: ck.f, mp: ck.mp, seen: ctx.seen, done: false, res: null, s: opt.s || null, rig: null, probe: !!opt.probe };
    const controls = controlsOf(ck.c, ck.f);
    const UI = root.ELS_TAUSCH_UI;
    if (!opt.headless && UI && typeof UI.load === 'function') {
      let rig = null; try { rig = UI.load({ rig: RIG, controls, wrap: r => wrap(r, ctx) }); } catch (e) { rig = null; }
      if (!rig) return { ok: false, why: 'Der Prüfplatz konnte nicht geladen werden (läuft gerade eine Aufgabe?).', code: 'ui' };
      st.rig = rig;
    } else {
      const R = rigsMod(); if (!R) return { ok: false, why: WHY.kern, code: 'kern' };
      st.rig = wrap(R.create(RIG, { controls }), ctx);
    }
    A = st;
    return { ok: true, rig: st.rig, mp: ck.mp };
  }
  const active = () => !!(A && !A.done);
  /* Diagnose (E6): Liste der Mangel-Ids; Ergebnis { ok, p?, f?, rec?, fnd? } an alle diagnosed()-Rueckrufe */
  function diagnose(list, opt) {
    opt = opt || {}; if (!A || A.done) return null;
    const got = uniqSorted((Array.isArray(list) ? list : [list]).filter(v => typeof v === 'string')), ok = got.join(',') === A.f.join(',');
    const S = T() && T().store, s = opt.s || A.s;
    let r;
    if (ok) { const rec = S && !A.probe ? S.end(100, s, opt.now, { mp: A.mp }) : null; A.done = true; A.res = 'richtig'; r = { ok: true, p: 100, rec, fnd: A.f.slice() }; }
    else { const f = S && !A.probe ? S.wrong(s) : null; A.tries = (A.tries || 0) + 1; r = { ok: false, f: f == null ? A.tries : f }; }
    LISTEN.slice().forEach(cb => { try { cb(r); } catch (e) {} });
    return r;
  }
  function aufgeben(opt) {
    opt = opt || {}; if (!A || A.done) return null;
    const S = T() && T().store, rec = S && !A.probe ? S.end(0, opt.s || A.s, opt.now, { mp: A.mp }) : null;
    A.done = true; A.res = 'aufgegeben'; const r = { ok: false, aufgegeben: true, p: 0, rec };
    LISTEN.slice().forEach(cb => { try { cb(r); } catch (e) {} });
    return r;
  }
  function diagnosed(cb) { if (typeof cb !== 'function') return () => {}; LISTEN.push(cb); return () => { const i = LISTEN.indexOf(cb); if (i >= 0) LISTEN.splice(i, 1); }; }
  /* Aufloesung erst nach richtiger Diagnose oder Aufgeben */
  function aufloesung() {
    if (!A || !A.done) return null; const c = catOf(A.g.geraet);
    return { f: A.f.slice(), names: A.f.map(fname), geraet: c ? c.name : A.g.geraet, text: 'Mängel am Prüfling ' + (c ? c.name : '') + ': ' + A.f.map(fname).join(', ') + '.' };
  }
  /* Tipps (E8): 1 Reihenfolge, 2 abweichende Pruefschritte/Stellen, ab 3 gesperrt */
  function tippText(n) {
    if (!A) return null; const c = catOf(A.g.geraet); if (!c) return null;
    if (n === 1) return 'Prüfe in der festen Reihenfolge: Sichtprüfung an allen drei Stellen (' + SPOTS.map(s => SPOT_NAME[s]).join(', ') + '), ' + (c.sk === 'I' ? 'dann Schutzleiterwiderstand, Isolationswiderstand und Schutzleiterstrom.' : 'dann Isolationswiderstand und Berührungsstrom (Schutzklasse II: ohne Schutzleiterwiderstand).') + ' Vergleiche jeden Wert mit seinem Grenzwert.';
    const ab = abweichend(A.g.geraet, A.f, A.g.seed); if (!ab) return null;
    const parts2 = []; if (ab.spots.length) parts2.push('Sichtprüfung an der Stelle ' + ab.spots.map(s => SPOT_NAME[s]).join(' und '));
    ab.steps.forEach(k => parts2.push(STEP_NAME[k]));
    return 'Diese Prüfschritte weichen ab: ' + parts2.join('; ') + '.';
  }
  function tipp(n, opt) {
    opt = opt || {}; n = Math.round(+n || 0); if (!A || A.done) return null;
    if (n >= 3) return { blocked: true, n: A.h || 0, why: 'Stufe 3 und die Auflösung sind bis zur Diagnose gesperrt.' };
    if (n < 1) return null;
    const S = T() && T().store, s = opt.s || A.s;
    if (n > (A.h || 0)) {
      if (S && !A.probe && S.cur(s)) { for (let i = (A.h || 0); i < n; i++) { const r = S.tipp(s); if (!r || r.blocked) return { blocked: true, n: A.h || 0 }; } }
      A.h = n;
    }
    return { n, text: tippText(n) };
  }
  /* Entwurf aus dem aktuellen (unverdeckten) Pruefstand fuer "Als Fehlerkarte weitergeben" */
  function draft(rig) {
    try {
      if (!rig || rig.__tausch || rig.id !== RIG) return null; const ctl = rig.getControls(), d = D(); if (!d) return null;
      let f;
      if (ctl.zufall) { const m = d.make(ctl.geraet, { seed: ctl.seed, n: ctl.anzahl }); f = m && m.ok !== false ? m.faults.slice() : []; }
      else f = allFaults().filter(id => !!ctl[fkey(id)] && catOf(ctl.geraet) && catOf(ctl.geraet).defekteMoeglich.indexOf(id) >= 0);
      const c = { geraet: ctl.geraet }; if (ctl.seed !== 1 && ctl.seed != null) c.seed = ctl.seed; if (ctl.modus && ctl.modus !== 'wiederholung') c.modus = ctl.modus;
      f = uniqSorted(f); const ck = check({ rig: RIG, c, f }, { ersteller: true }), sg = suggest(f);
      return { lab: LAB, rig: RIG, c, f, mp: messpunkte(ctl.geraet), sym: sg.sym, st: sg.st, check: ck };
    } catch (e) { return null; }
  }
  const choices = geraet => { const c = catOf(geraet == null && A ? A.g.geraet : geraet); return c ? c.defekteMoeglich.map(id => ({ id, name: fname(id) })) : []; };
  const api = {
    lab: LAB,
    rigs: () => [{ id: RIG, name: 'Prüfplatz Geräteprüfung' }],
    faults: rig => (rig == null || rig === RIG ? allFaults().map(id => ({ id, name: fname(id) })) : []),
    symptoms: rig => (rig == null || rig === RIG ? SYM.map(s => ({ id: s[0], label: s[1] })) : []),
    symptomLabel: id => { const s = SYM.find(x => x[0] === id); return s ? s[1] : ''; },
    rigLabel: id => (id === RIG ? 'Prüfplatz Geräteprüfung' : ''),
    build, check, diagnosed, tipp, messpunkte,
    diagnose, aufgeben, aufloesung, active, choices, suggest, draft,
    blocked: ['aufloesung', 'stufe3', 'merken', 'teilen', 'speichern', 'drucken', 'wuerfel', 'pruefstand', 'beispiele', 'aufgaben', 'proto'],
    rig: () => (A ? A.rig : null)
  };
  /* Knopf im Lab: Entwurf an T4 (TauschUI) geben; ohne T4 nur der Entwurf */
  function bau(rig) {
    const d = draft(rig); if (!d) return { ok: false, why: 'Am Prüfplatz einen Prüfling und mindestens einen Mangel einstellen.' };
    if (root.TauschUI && typeof root.TauschUI.bau === 'function') { try { root.TauschUI.bau(d, api); } catch (e) {} }
    return { ok: !!d.check.ok, draft: d, why: d.check.ok ? '' : (d.check.detail || d.check.why) };
  }
  /* #t=-Einstieg: Karte an T4; ohne T4 in den Eingang legen */
  function entry(h) {
    const TT = T(); if (!TT) return false; const txt = String(h || '');
    const c = TT.core.parseCards(txt)[0]; if (!c) return false;
    if (root.TauschUI && typeof root.TauschUI.einlesen === 'function') { try { root.TauschUI.einlesen(c.code, api); return true; } catch (e) { return false; } }
    try { TT.store.addInbox(c.code); } catch (e) {}
    return true;
  }

  const ElsTausch = { api, wrap, mask, leaks, befund, sameBefund, combos, abweichend, controlsOf, draft, bau, entry, EIND, MAXF, SYM, _reset: () => { A = null; LISTEN.length = 0; } };
  /* Teil 1: Registrierung ohne DOM */
  try { if (T()) T().registerAdapter(LAB, { rigs: [RIG], symptoms: SYMIDS }); } catch (e) {}
  root.ElsTausch = ElsTausch;
  if (typeof document !== 'undefined') root.LabTauschAPI = api;          /* nur die els-Seite laedt diese Datei */
  if (typeof module !== 'undefined' && module.exports) module.exports = ElsTausch;
})(typeof window !== 'undefined' ? window : globalThis);
