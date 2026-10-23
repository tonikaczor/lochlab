/* ntsrig-fehler.js - Netzteil-Lab (WP2d): Pruefstand 8 `fehler` - Fehlersuche am Netzteil (SPEC 5.8).
 * Die gemeinsame Huelle liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js (und ntscore-sw.js, ntscore-diag.js) laden (in Node holt sie sich alles per require).
 * Gerechnet wird NUR im Kern (NTS_CORE.fault: catalog, make, probe, sicht, repair, order, parts; NTS_CORE.diagnose); hier steht keine zweite Formel.
 * Die Fehlersuche beginnt am freigeschalteten Geraet in der Simulation, Messpunkte liegen nur hinter dem Transformator (Sekundaerseite, Kleinspannung) und im Gleichspannungskreis.
 * Dieses Lab ist keine Anleitung fuer Arbeiten an Netzspannung und kein Reparaturleitfaden.
 *
 * Steuerwerte: netz (linear, zener, buck, boost; in der SPEC `netzteil`, der Kern-Schluessel fuer NTS_CORE.assess heisst `netz`), fehler (Id aus NTS_CORE.fault.catalog, '' = kein Fehler,
 *   'zufall' wuerfelt mit `seed` und wird sofort durch die gewuerfelte Id ersetzt; bei Aenderung von netz oder seed wird neu gewuerfelt, solange der Fehler ein Wuerfelergebnis ist),
 *   seed, messpunkt (Auswahl; gemessen wird mit fire()), tausche (Auswahl 'keins' oder Bauteil; das Setzen tauscht), diagnose (abgegebene Ursache, '' = keine), begruendung (Schalter der Aufgabe),
 *   Tasten fire (Messen), sicht (Sichtpruefung).
 * Zusaetzlich: act(name) ('sicht' | 'messe:<punkt>' | 'tausche:<bauteil>', fuer NTS_CORE.runSeq), sicht() -> Text, messe(punkt), tausche(bauteil); state().fehlerId = Id des eingebauten Fehlers.
 * Der Zustand der Suche (clicks, getauscht) steht in getControls() und state(): NTS_CORE.assess('fehler', rig.getControls()) und rig.assess() geben dasselbe.
 * Messgeraete: wert (letzter Messwert, Einheit des Messpunkts), soll (Sollwert dazu), abw (1 = weicht ab), messungen, getauscht. Messwerte je Punkt: state().messwerte.
 * Die Leistungsbilanz zeigt nur das fehlerfreie Linearnetzteil (Soll); der Fehler verraet sich dort nicht.
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-fehler.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { isNum, fm, eng } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const F0 = C0 && C0.fault ? C0.fault : null;
  const CATALOG = F0 && Array.isArray(F0.catalog) ? F0.catalog : [];
  const POINTS = F0 && F0.probe && Array.isArray(F0.probe.points) ? F0.probe.points.slice() : [];
  const PINFO = F0 && F0.probe && F0.probe.info ? F0.probe.info : {};
  const NETZ_IDS = F0 && Array.isArray(F0.netze) ? F0.netze.slice() : ['linear', 'zener', 'buck', 'boost'];
  const NETZ_INFO = F0 && F0.netzInfo ? F0.netzInfo : {};
  const PART_NAME = {}, PART_IDS = [];
  NETZ_IDS.forEach(n => { try { (F0.parts(n) || []).forEach(p => { if (!PART_NAME[p.id]) { PART_NAME[p.id] = p.name; PART_IDS.push(p.id); } }); } catch (e) { /* ohne Kern keine Teile */ } });

  const G_E = 'Eingang und Transformator', G_R = 'Regelung', G_L = 'Last und Anzeige';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = [
    { key: 'netz', label: 'Netzteil', type: 'select', value: 'linear', options: opt(NETZ_IDS.map(n => [n, NETZ_INFO[n] ? NETZ_INFO[n].name : n])), stufe: null, group: G_E,
      help: 'Welches Netzteil in der Simulation steckt: Linearnetzteil (Transformator, Brücke, Ladekondensator, 7805), Z-Dioden-Stufe, Tiefsetzsteller oder Hochsetzsteller aus einer Gleichspannung. Nicht jeder Fehler kommt an jedem Netzteil vor.' },
    { key: 'fehler', label: 'Eingebauter Fehler', type: 'select', value: '', options: [{ value: '', label: 'Kein Fehler' }, { value: 'zufall', label: 'Zufall (Würfel mit Startwert)' }].concat(CATALOG.map(f => ({ value: f.id, label: f.name }))), stufe: null, group: G_R,
      help: 'Der Fehler, den die Simulation einbaut. Bei der Fehlersuche bleibt er verdeckt: Du grenzt ihn mit Sichtprüfung und Messpunkten ein. "Zufall" würfelt einen Fehler, der zum Netzteil passt, und ersetzt die Auswahl durch die gewürfelte Ursache.' },
    { key: 'seed', label: 'Startwert des Würfels', type: 'slider', scale: 'lin', min: 1, max: 99, step: 1, unit: '', unitKind: 'count', value: 1, stufe: null, group: G_R, visible: s => s.zufall === true,
      help: 'Startwert des Zufalls: Derselbe Startwert würfelt bei demselben Netzteil immer denselben Fehler (die Fehlersuche ist wiederholbar).' },
    { key: 'messpunkt', label: 'Messpunkt', type: 'select', value: '', options: [{ value: '', label: 'Keiner gewählt' }].concat(POINTS.map(p => ({ value: p, label: PINFO[p] ? PINFO[p].name : p }))), stufe: null, group: G_L,
      help: 'Wähle einen Messpunkt oder tippe ihn auf der Platine an, dann löst du die Messung aus. Es gibt nur Messpunkte hinter dem Transformator (Kleinspannung) und im Gleichspannungskreis, keine am Netz.' },
    { key: 'tausche', label: 'Bauteil tauschen', type: 'select', value: 'keins', options: [{ value: 'keins', label: 'Nichts tauschen' }].concat(PART_IDS.map(p => ({ value: p, label: PART_NAME[p] }))), stufe: null, group: G_L,
      help: 'Tauscht das gewählte Bauteil in der Simulation. Nur das defekte Bauteil behebt den Fehler; ein Tausch ohne Messung zählt als Fehler, ein falsches Bauteil bleibt wirkungslos und wird vermerkt.' },
    { key: 'diagnose', label: 'Abgegebene Diagnose', type: 'select', value: '', options: [{ value: '', label: 'Noch keine Diagnose' }].concat(CATALOG.map(f => ({ value: f.id, label: f.name }))), stufe: null, group: G_L,
      help: 'Die Ursache, die du für den Fehler hältst. Die Ampel prüft sie gegen den eingebauten Fehler und gegen deine Messungen: Grün heißt gefunden und mit einer Messung am typischen Messpunkt begründet.' },
    { key: 'begruendung', label: 'Begründung mitgeliefert', type: 'switch', value: false, stufe: null, group: G_L,
      help: 'Setzt die Aufgabe, wenn die Begründung anders als durch eine Messung geliefert wurde (zum Beispiel als Text). Gemessen am typischen Messpunkt zählt auch ohne diesen Schalter (F43).' },
    { key: 'fire', label: 'Messen', type: 'button', stufe: null, group: G_L, help: 'Misst den gewählten Messpunkt am simulierten Netzteil und zeigt Ist und Soll (nur Simulation, Gleichspannungs- und Sekundärseite).' },
    { key: 'sicht', label: 'Sichtprüfung', type: 'button', stufe: null, group: G_L, help: 'Sichtprüfung am freigeschalteten Gerät in der Simulation: verfärbte Bauteile, aufgewölbte Elkos, Brandgeruch. Die Sichtprüfung kostet nichts und steht in der empfohlenen Reihenfolge am Anfang.' }
  ];
  const METERS = [
    { key: 'wert', label: 'Letzter Messwert', unit: '', digits: 3, min: -100, max: 100, help: 'Messwert des zuletzt gemessenen Messpunkts in der Einheit des Messpunkts (Volt, Ampere; Temperaturanzeige als Stufe 0 kalt, 1 warm, 2 heiß). Ohne Messung steht dort 0.' },
    { key: 'soll', label: 'Soll zum letzten Messwert', unit: '', digits: 3, min: -100, max: 100, help: 'Sollwert desselben Messpunkts am fehlerfreien Netzteil, aus dem Kern gerechnet.' },
    { key: 'abw', label: 'Weicht vom Soll ab (1 = ja)', unit: '', digits: 0, min: 0, max: 1, texts: { 0: 'im Soll', 1: 'weicht ab' }, help: 'Code: 1 = der Messwert weicht um mehr als 0,5 % vom Soll ab (Anzeigeregel der Fehlersuche), 0 = im Soll oder noch nicht gemessen.' },
    { key: 'messungen', label: 'Messungen bisher', unit: '', digits: 0, min: 0, max: 100, help: 'Anzahl der Messungen in dieser Fehlersuche; wiederholtes Messen desselben Punkts hintereinander zählt einmal.' },
    { key: 'getauscht', label: 'Getauschte Bauteile', unit: '', digits: 0, min: 0, max: 20, help: 'Anzahl der Bauteile, die in dieser Fehlersuche getauscht wurden.' }
  ];
  const PRESETS = [
    { id: 'kein-ausgang', name: 'Kein Ausgang', info: 'Linearnetzteil ohne Ausgangsspannung: Welcher Fehler passt? Beginne mit der Sichtprüfung, dann Versorgung, Zwischenkreis, Regler, Last.', params: { netz: 'linear', fehler: 'sicherung-offen' } },
    { id: 'brummt', name: 'Es brummt', info: 'Linearnetzteil mit starkem Brumm: Prüfe die Brummspannung am Ladekondensator und überlege, ob Brücke oder Kapazität die Ursache ist.', params: { netz: 'linear', fehler: 'c-ausgetrocknet' } },
    { id: 'zu-niedrig', name: 'Spannung zu niedrig', info: 'Linearnetzteil mit zu niedriger Ausgangsspannung: Ist die Spannung am Ladekondensator hoch genug? Wenn nicht, liegt der Fehler davor.', params: { netz: 'linear', fehler: 'regler-eingang-niedrig' } },
    { id: 'wird-heiss', name: 'Wird heiß', info: 'Linearnetzteil, bei dem der Regler heiß wird und die Ausgangsspannung einbricht: Prüfe zuletzt den Ausgangsstrom und die Last.', params: { netz: 'linear', fehler: 'regler-ueberlast' } },
    { id: 'schwingt', name: 'Schwingt', info: 'Tiefsetzsteller, dessen Ausgang schwingt: Das kommt aus dem Regelkreis, prüfe den Ausgangskondensator.', params: { netz: 'buck', fehler: 'schwingen' } }
  ];
  const PFAD = { quelle: 'Freigeschaltetes Netzteil in der Simulation; Messpunkte nur hinter dem Transformator (Kleinspannung) und im Gleichspannungskreis', wandlung: 'Fehlersuche in der empfohlenen Reihenfolge: Sichtprüfung, Messen an Messpunkten, Bauteil tauschen, Diagnose abgeben', senke: 'Diagnose der Ursache mit Begründung durch Messwerte', art: 'diagnose' };

  /* Platine: Lage der Bauteile und Messpunkte (Zeichnung, schematisch); zwei Anordnungen: Linearnetzteile und Schaltregler */
  const LAYOUT = {
    lin: {
      parts: [{ stufe: 'trafo', name: 'Trafo', x: 0.03, y: 0.25, w: 0.2, h: 0.5 }, { stufe: 'gleich', name: 'Brücke', x: 0.28, y: 0.3, w: 0.17, h: 0.4 }, { stufe: 'sieb', name: 'Elko', x: 0.5, y: 0.3, w: 0.13, h: 0.4 }, { stufe: 'regel', name: 'Regler', x: 0.68, y: 0.3, w: 0.13, h: 0.4 }, { stufe: 'last', name: 'Last', x: 0.86, y: 0.3, w: 0.11, h: 0.4 }],
      pos: { u_sek: [0.25, 0.06], temp_gleich: [0.37, 0.94], u_c: [0.47, 0.06], brumm_c: [0.565, 0.94], temp_regler: [0.745, 0.94], u_aus: [0.835, 0.06], brumm_aus: [0.835, 0.94], i_aus: [0.915, 0.06] }
    },
    sw: {
      parts: [{ stufe: 'schalt', name: 'Schalter', x: 0.03, y: 0.25, w: 0.2, h: 0.5 }, { stufe: 'gleich', name: 'Diode', x: 0.28, y: 0.3, w: 0.17, h: 0.4 }, { stufe: 'sieb', name: 'Drossel', x: 0.5, y: 0.3, w: 0.13, h: 0.4 }, { stufe: 'regel', name: 'Regelung', x: 0.68, y: 0.3, w: 0.13, h: 0.4 }, { stufe: 'last', name: 'Last', x: 0.86, y: 0.3, w: 0.11, h: 0.4 }],
      pos: { u_c: [0.25, 0.06], temp_regler: [0.13, 0.06], u_gate: [0.13, 0.94], u_sw: [0.37, 0.94], i_l_spitze: [0.565, 0.06], u_fb: [0.745, 0.06], u_r2: [0.745, 0.94], u_aus: [0.835, 0.06], brumm_aus: [0.835, 0.94], i_aus: [0.915, 0.94] }
    }
  };
  const layoutOf = netz => (netz === 'buck' || netz === 'boost' ? LAYOUT.sw : LAYOUT.lin);

  function wrap(ctx, s, maxW, size, maxLines) {
    ctx.font = B.gfx.font(size, false);
    const words = String(s).split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    const wd = x => (ctx.measureText ? ctx.measureText(x).width : x.length * size * 0.55);
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (wd(t) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    return lines;
  }

  function plant(P0) {
    const CORE = P0.CORE, ctl = P0.ctl;
    const FT = CORE.fault;
    let clicks = [], getauscht = [], behoben = false, rnd = false, meas = {}, order = [], lastMeas = null, sichtText = '', last = null;
    const memo = {};
    const partName = id => PART_NAME[id] || id;
    const catOf = id => CATALOG.find(f => f.id === id) || null;
    const bump = () => P0.bump();

    function scen() { clicks = []; getauscht = []; behoben = false; meas = {}; order = []; lastMeas = null; sichtText = ''; ctl.tausche = 'keins'; }
    function roll() {
      const m = FT.make('zufall', { netz: ctl.netz, seed: ctl.seed });
      ctl.fehler = m && m.ok ? m.fehler : '';
    }
    function pushClick(c) { if (clicks[clicks.length - 1] !== c) clicks.push(c); }
    function liveState() { return FT.make(behoben || !ctl.fehler ? 'ok' : ctl.fehler, { netz: ctl.netz }); }
    /* Fakten zum eingebauten Fehler am Netzteil: Messpunkte, die abweichen, und das defekte Bauteil (alles aus dem Kern) */
    function facts(fid, netz) {
      const key = fid + '|' + netz; if (memo[key]) return memo[key];
      const st = FT.make(fid, { netz });
      if (!st || !st.ok) return (memo[key] = { ok: false, why: st && st.why || 'Eingabe' });
      const wichtig = POINTS.filter(p => { const q = FT.probe(st, p); return q && q.ok && q.abweichung === true; });
      let bt = null;
      (FT.parts(netz) || []).forEach(p => { if (bt === null) { const q = FT.repair(st, p.id); if (q && q.ok && q.behoben) bt = p.id; } });
      return (memo[key] = { ok: true, wichtig, bt });
    }
    function doSwap(part) {
      const parts = (FT.parts(ctl.netz) || []).map(p => p.id);
      if (parts.indexOf(part) < 0) { P0.say('Das Bauteil „' + partName(part) + '“ gibt es an diesem Netzteil nicht.', 'warn'); ctl.tausche = 'keins'; bump(); return false; }
      const live = liveState();
      if (!live || !live.ok) { P0.say('Tauschen nicht möglich: ' + (live && live.why || 'Eingabe prüfen') + '.', 'warn'); ctl.tausche = 'keins'; bump(); return false; }
      const rep = FT.repair(live, part);
      if (!rep || !rep.ok) { P0.say('Tauschen nicht möglich: ' + (rep && rep.why || 'Eingabe prüfen') + '.', 'warn'); ctl.tausche = 'keins'; bump(); return false; }
      pushClick('tausche:' + part); getauscht.push(part);
      if (rep.behoben) behoben = true;
      P0.say(rep.text, rep.behoben ? 'info' : 'warn');
      bump(); return true;
    }
    function sicht() {
      const live = liveState();
      if (!live || !live.ok) { P0.say('Sichtprüfung nicht möglich: ' + (live && live.why || 'Eingabe prüfen') + '.', 'warn'); return false; }
      const s = FT.sicht(live);
      if (!s || !s.ok) return false;
      sichtText = s.text; pushClick('sicht'); P0.say(s.text, 'info'); bump();
      return s.text;
    }
    function messe(point) {
      if (typeof point !== 'string' || POINTS.indexOf(point) < 0) { P0.say('Diesen Messpunkt gibt es nicht.', 'warn'); return false; }
      const live = liveState();
      if (!live || !live.ok) { P0.say('Messen nicht möglich: ' + (live && live.why || 'Eingabe prüfen') + '.', 'warn'); return false; }
      const q = FT.probe(live, point);
      if (!q || !q.ok) { P0.say('Messen nicht möglich: ' + (q && q.why || 'Eingabe prüfen') + '.', 'warn'); return false; }
      ctl.messpunkt = point;
      meas[point] = { point, name: q.name, unit: q.unit, value: q.value, text: q.text, soll: q.soll, sollText: q.sollText, abweichung: q.abweichung === true, temp: q.temp === true };
      order = order.filter(p => p !== point).concat([point]); lastMeas = meas[point];
      pushClick('messe:' + point);
      P0.say('Messung ' + q.name + ': Ist ' + q.text + ', Soll ' + q.sollText + (q.abweichung ? ' (weicht ab).' : ' (im Soll).'), q.abweichung ? 'warn' : 'info');
      bump();
      return meas[point];
    }
    function act(name) {
      const m = /^(sicht|messe|tausche)(?::(.+))?$/.exec(String(name));
      if (!m) return false;
      if (m[1] === 'sicht') return sicht() !== false;
      if (!m[2]) return false;
      if (m[1] === 'messe') return messe(m[2]) !== false;
      ctl.tausche = m[2]; return doSwap(m[2]);
    }

    function compute() {
      if (ctl.fehler === 'zufall') { rnd = true; roll(); }
      const live = liveState(), ref = FT.make('ok', { netz: ctl.netz });
      return { ok: !!(live && live.ok), error: live && live.ok ? '' : (live && live.why) || 'Eingabe', live, ref };
    }
    function meters() {
      return { wert: lastMeas && isNum(lastMeas.value) ? lastMeas.value : 0, soll: lastMeas && isNum(lastMeas.soll) ? lastMeas.soll : 0, abw: lastMeas && lastMeas.abweichung ? 1 : 0,
        messungen: clicks.filter(c => /^messe:/.test(c)).length, getauscht: getauscht.length };
    }
    function bilanz(r) {
      if (ctl.netz !== 'linear' || !r.ref || !r.ref.ok) return null;
      const g = p => { const q = FT.probe(r.ref, p); return q && q.ok && isNum(q.value) ? q.value : NaN; };
      const uc = g('u_c'), ua = g('u_aus'), ia = g('i_aus');
      if (!isNum(uc) || !isNum(ua) || !isNum(ia)) return null;
      return { pzu: uc * ia, pab: ua * ia, pv: [{ stufe: 'regel', w: Math.max(0, (uc - ua) * ia) }] };
    }
    /* Ampel (SPEC 4.10, ABWEICHUNGEN WP1c 4): kein Fehler = grau; falsches Bauteil getauscht = rot; ohne Diagnose = grau; richtig + begruendet = gruen; richtig ohne Begruendung = gelb; falsch = rot */
    function assess(r, c) {
      const fid = c.fehler;
      if (!fid) return { ok: false, ampel: 'grau', text: 'Es ist kein Fehler eingebaut.' };
      const cat = catOf(fid);
      if (!cat) return { ok: false, ampel: 'grau', text: 'Den Fehler „' + fid + '“ gibt es nicht.' };
      const netz = c.netz || cat.netz[0];
      if (cat.netz.indexOf(netz) < 0) return { ok: false, ampel: 'grau', text: 'Der Fehler „' + fid + '“ kommt am Netzteil „' + netz + '“ nicht vor.' };
      const f = facts(fid, netz);
      if (!f.ok) return { ok: false, ampel: 'grau', text: String(f.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.') };
      const tausch = clicks.filter(x => /^tausche:/.test(x)).map(x => x.slice(8)).concat(getauscht);
      const falsch = tausch.filter(b => b !== f.bt);
      const gemessen = clicks.filter(x => /^messe:/.test(x)).map(x => x.slice(6));
      const begruendet = c.begruendung === true || gemessen.some(p => f.wichtig.indexOf(p) >= 0);
      const typ = f.wichtig.slice(0, 3).map(p => (PINFO[p] ? PINFO[p].name : p));
      if (falsch.length) { const nm = partName(falsch[0]); return { ok: false, ampel: 'rot', text: 'Das Bauteil „' + nm + '“ war nicht defekt und ist getauscht worden: Der Fehler bleibt.' }; }
      if (!c.diagnose) return { ok: false, ampel: 'grau', text: 'Noch keine Diagnose abgegeben (' + gemessen.length + ' Messung' + (gemessen.length === 1 ? '' : 'en') + ').' };
      if (c.diagnose === fid) return begruendet ? { ok: true, ampel: 'gruen', text: 'Fehler gefunden und mit einer Messung am typischen Messpunkt begründet.' }
        : { ok: false, ampel: 'gelb', text: 'Fehler gefunden, aber die Begründung fehlt: Wähle einen Messpunkt, der den Fehler zeigt (' + typ.join(', ') + '), und löse die Messung aus.' };
      const dg = catOf(c.diagnose);
      return { ok: false, ampel: 'rot', text: 'Die Diagnose „' + (dg ? dg.name : c.diagnose) + '“ passt nicht zu den Messwerten.' };
    }
    function diag(r, c) {
      const out = [{ id: 'fehler-modell', kind: 'info', text: 'Simulation am freigeschalteten Gerät: Gemessen wird nur hinter dem Transformator und im Gleichspannungskreis. Das Lab ersetzt keine Unterweisung und ist keine Reparaturanleitung.' }];
      let list = [];
      try { list = CORE.diagnose({ rigId: 'fehler', state: Object.assign({}, c, { clicks: clicks.slice(), getauscht: getauscht.slice() }) }) || []; } catch (e) { list = []; }
      list.forEach(d => { const o = { id: d.id, kind: d.kind || 'info', text: d.text + (d.gegenprobe ? ' ' + d.gegenprobe : '') }; if (d.link) o.link = d.link; if (d.fx) o.fx = d.fx; out.push(o); });
      return out;
    }
    function state(r, c) {
      const cat = catOf(c.fehler), ord = (FT.order && FT.order(clicks)) || {};
      return { fehlerId: c.fehler || '', fehlerName: cat ? cat.name : '', zufall: rnd, behoben, clicks: clicks.slice(), getauscht: getauscht.slice(), sichtText,
        netzName: NETZ_INFO[c.netz] ? NETZ_INFO[c.netz].name : c.netz, netzText: NETZ_INFO[c.netz] ? NETZ_INFO[c.netz].text : '', reihenfolge: ord.ok ? ord.text : '',
        messung: lastMeas ? Object.assign({}, lastMeas) : null, messwerte: order.map(p => Object.assign({}, meas[p])), punkte: POINTS.filter(p => PINFO[p] && PINFO[p].netz.indexOf(c.netz) >= 0), ok: r.ok };
    }
    function fire() {
      if (!ctl.messpunkt) { P0.say('Wähle zuerst einen Messpunkt (Liste oder auf der Platine antippen).', 'warn'); return false; }
      return !!messe(ctl.messpunkt);
    }
    function onControl(key) {
      if (key === '*') { scen(); rnd = false; bump(); return; }
      if (key === 'fehler') { scen(); if (ctl.fehler === 'zufall') { rnd = true; roll(); } else rnd = false; bump(); return; }
      if (key === 'netz') { scen(); if (rnd) roll(); bump(); return; }
      if (key === 'seed') { if (rnd) { scen(); roll(); bump(); } return; }
      if (key === 'tausche') { if (ctl.tausche !== 'keins') doSwap(ctl.tausche); return; }
    }
    function onButton(key) { if (key === 'sicht') return sicht() !== false; return true; }

    /* Platine: Messpunkte der aktuellen Anlage mit laufender Nummer (MP1...), Zeichnung und Treffertest teilen sich diese Liste */
    function pcbData(c) {
      const lay = layoutOf(c.netz), ids = POINTS.filter(p => PINFO[p] && PINFO[p].netz.indexOf(c.netz) >= 0 && lay.pos[p]);
      const pts = ids.map((p, i) => ({ id: 'MP' + (i + 1), label: '', x: lay.pos[p][0], y: lay.pos[p][1], v: meas[p] ? meas[p].text : '', state: 'ok', selected: c.messpunkt === p }));
      return { ids, pts, parts: lay.parts.map((q, i) => (c.netz === 'zener' && q.stufe === 'regel' ? Object.assign({}, q, { name: 'Z-Diode' }) : q)) };
    }
    function pixelPts(D, rc, pd) {
      if (D && D.pcbPoints) { try { const a = D.pcbPoints(rc, { points: pd.pts }); if (a && a.length) return a; } catch (e) { /* Rueckfall */ } }
      return pd.pts.map(p => ({ id: p.id, x: rc.x + 14 + p.x * (rc.w - 28), y: rc.y + 26 + p.y * (rc.h - 40), r: 11 }));
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, pal = sc.pal, c = view.ctl, D = sc.D, fs = sc.fs;
      if (!rc || rc.w < 140 || rc.h < 100) return;
      const wide = rc.w >= 640, gap = 8, o2 = { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false };
      let pcb, side;
      if (wide) { const mw = Math.floor(rc.w * 0.6); pcb = { x: rc.x, y: rc.y, w: mw - gap, h: rc.h }; side = { x: rc.x + mw, y: rc.y, w: rc.w - mw, h: rc.h }; }
      else { const mh = Math.floor(rc.h * 0.52); pcb = { x: rc.x, y: rc.y, w: rc.w, h: mh - gap }; side = { x: rc.x, y: rc.y + mh, w: rc.w, h: rc.h - mh }; }
      const pd = pcbData(c);
      let ok = false;
      if (D && D.benchPcb) ok = !!D.benchPcb(ctx, pcb, { points: pd.pts, parts: pd.parts, reveal: false }, o2);
      if (!ok) B.gfx.text(ctx, 'Platine: ' + pd.pts.length + ' Messpunkte (Simulation)', pcb.x + 4, pcb.y + 20, { size: fs, color: pal.fg, max: pcb.w - 8 });
      if (!sc.ghost) last = { w, h, pts: pixelPts(D, pcb, pd), ids: pd.ids };
      /* Seitenfeld: Messwerte Ist gegen Soll, Sichtprüfung, Hinweis */
      B.gfx.panel(ctx, side.x, side.y, side.w, side.h, pal.panel, pal.line, 8);
      const lh = fs + 4, x0 = side.x + 8, mw2 = side.w - 16;
      let y = side.y + fs + 8;
      B.gfx.text(ctx, NETZ_INFO[c.netz] ? NETZ_INFO[c.netz].name + ' (Simulation)' : 'Netzteil (Simulation)', x0, y, { size: fs + 1, bold: true, color: pal.fg, max: mw2 });
      y += lh + 4;
      const put = (s, col, maxL) => {
        const room = Math.floor((side.y + side.h - y - 4) / lh);
        if (room < 1) return false;
        wrap(ctx, s, mw2, fs, Math.min(room, maxL || 2)).forEach(l => { B.gfx.text(ctx, l, x0, y, { size: fs, color: col, max: mw2 }); y += lh; });
        y += 2; return true;
      };
      if (sichtText) put('Sichtprüfung: ' + sichtText.replace(/^Sichtprüfung:\s*/, ''), pal.mute, 3);
      if (!order.length) put('Noch nichts gemessen. Tippe einen Messpunkt an (Kreis mit Nummer) und löse die Messung aus.', pal.mute, 3);
      order.slice().reverse().forEach(p => {
        const m = meas[p], idx = pd.ids.indexOf(p);
        put((idx >= 0 ? 'MP' + (idx + 1) + ' ' : '') + m.name + ': Ist ' + m.text + ', Soll ' + m.sollText + (m.abweichung ? ', weicht ab' : ', im Soll'), m.abweichung ? pal.rot : pal.mute, 3);
      });
    }
    function hit(px, py, w, h) {
      if (!last || last.w !== w || last.h !== h) return null;
      let best = null, bd = 1e9;
      last.pts.forEach((p, i) => { const d = Math.hypot(px - p.x, py - p.y); if (d < bd) { bd = d; best = i; } });
      if (best === null || bd > 22) return null;
      const id = last.ids[best];
      return id ? { key: 'messpunkt', point: id, to: id } : null;
    }
    function extend(api, h) {
      api.act = act; api.sicht = sicht; api.messe = messe; api.tausche = function (b) { if (typeof b !== 'string' || !b) return false; ctl.tausche = b; return doSwap(b); };
      const baseSnap = api.snapshot, baseRestore = api.restore;
      api.getControls = function () { return Object.assign({}, ctl, { clicks: clicks.slice(), getauscht: getauscht.slice() }); };
      api.snapshot = function () { const s = baseSnap(); s.fs = { clicks: clicks.slice(), getauscht: getauscht.slice(), behoben, rnd }; return s; };
      api.restore = function (s) {
        const keep = s && typeof s === 'object' && s.ctl && typeof s.ctl === 'object' ? s.ctl.tausche : undefined;
        const okr = baseRestore(s);
        if (okr && s.fs && typeof s.fs === 'object') {
          clicks = Array.isArray(s.fs.clicks) ? s.fs.clicks.filter(x => typeof x === 'string').slice(0, 200) : [];
          getauscht = Array.isArray(s.fs.getauscht) ? s.fs.getauscht.filter(x => typeof x === 'string').slice(0, 50) : [];
          behoben = s.fs.behoben === true; rnd = s.fs.rnd === true;
          if (typeof keep === 'string' && (keep === 'keins' || PART_IDS.indexOf(keep) >= 0)) ctl.tausche = keep;
          meas = {}; order = []; lastMeas = null;
          const live = liveState();
          if (live && live.ok) clicks.forEach(cl => { const m = /^messe:(.+)$/.exec(cl); if (m && POINTS.indexOf(m[1]) >= 0) { const q = FT.probe(live, m[1]); if (q && q.ok) { meas[m[1]] = { point: m[1], name: q.name, unit: q.unit, value: q.value, text: q.text, soll: q.soll, sollText: q.sollText, abweichung: q.abweichung === true, temp: q.temp === true }; order = order.filter(p => p !== m[1]).concat([m[1]]); lastMeas = meas[m[1]]; } } });
          h.bump();
        }
        return okr;
      };
    }
    function reset() { scen(); rnd = false; }
    return { compute, meters, bilanz, assess, diag, curves: () => [], state, fire, draw, hit, extend, onControl, onButton, reset, phaseHz: () => 0.3 };
  }

  R.register({ id: 'fehler', name: 'Fehlersuche am Netzteil', icon: '🔍', info: 'Fehlersuche am simulierten Netzteil: Sichtprüfung, Messen an Messpunkten, Bauteil tauschen, Diagnose abgeben.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'fehler', name: 'Fehlersuche am Netzteil', icon: '🔍', info: 'Fehlersuche am Netzteil', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
