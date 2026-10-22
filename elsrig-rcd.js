/* elsrig-rcd.js - ELS-Lab (WP2b): Pruefstand 4 `rcd` - Der Summenstrom (SPEC 5.4).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Partikel, Zeichenhuelle) liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ELS_CORE.rcd.trip / sum / leakSum / testButton / person / types); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (RCD-Verhalten F9, Koerperwiderstand F11): Uebungsanlage. Simulation, kein Hinweis fuer Arbeiten an Netzspannung.
 * Steuerwerte: idn (mA), type (AC/A/F/B), form (sinus/puls/gleich/mix, Form des Fehlerstroms), iFehler (mA, 0 erlaubt), leak1...leak3 (Ableitstroeme dreier Geraete, mA),
 *   person (Beruehrung ja/nein), pe (Schutzleiter angeschlossen/unterbrochen), Tasten taste (Pruefstaste) und fire (Pruefstaste bzw. Fehlerstrom).
 * Messgeraete: idiff (mA, tatsaechlicher Differenzstrom), ratio (idiff / IDn), tTrip (ms, 0 = keine sichere Ausloesung), ausgeloest (0/1). Wirft nie.
 * Modell: Differenzstrom = Fehlerstrom (nur bei angeschlossenem Schutzleiter) + Beruehrungsstrom der Person + Ableitstroeme (alle nach Erde, ueber den Ring nicht zurueck).
 * Ableitstroeme und Beruehrungsstrom gelten als sinusfoermig, der Fehlerstrom hat die gewaehlte Form. Ein Typ, der die Form nicht erkennt, ist blind fuer diesen Anteil.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-rcd.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng } = B;

  const G_R = 'RCD', G_F = 'Fehler und Berührung', G_A = 'Ableitströme der Geräte';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const leakDef = (k, n, v) => ({ key: k, label: 'Ableitstrom Gerät ' + n, type: 'slider', scale: 'lin', min: 0, max: 30, step: 0.1, unit: 'mA', unitKind: 'plain', value: v, ebene: null, group: G_A,
    help: 'Betriebsmäßiger Ableitstrom von Gerät ' + n + ' gegen Erde. Alle Ableitströme laufen nach Erde und addieren sich im RCD zum Differenzstrom. Ab dem 0,5-fachen von IΔn droht Fehlauslösung (Lehrfaustwert).' });
  const CONTROLS = [
    { key: 'idn', label: 'Nennfehlerstrom IΔn', type: 'select', value: 30, ebene: 'zusatz', group: G_R, options: [10, 30, 100, 300, 500].map(v => ({ value: v, label: v + ' mA' })),
      help: 'Nennfehlerstrom des RCD. Als Zusatzschutz für Personen sind höchstens 30 mA vorgesehen; größere Werte schützen eher Anlage und Brandschutz, nicht den Menschen.' },
    { key: 'type', label: 'RCD-Typ', type: 'select', value: 'A', ebene: 'zusatz', group: G_R, options: opt([['AC', 'Typ AC'], ['A', 'Typ A'], ['F', 'Typ F'], ['B', 'Typ B']]),
      help: 'Der Typ bestimmt, welche Stromformen der RCD erkennt (Lehrmodell F9): AC nur Sinus, A zusätzlich pulsierend, F zusätzlich Frequenzgemische, B zusätzlich glatten Gleichstrom. Eine nicht erkannte Form macht den RCD blind.' },
    { key: 'form', label: 'Form des Fehlerstroms', type: 'select', value: 'sinus', ebene: null, group: G_F, options: opt([['sinus', 'Sinus'], ['puls', 'pulsierend (DC)'], ['gleich', 'glatter Gleichstrom'], ['mix', 'Frequenzgemisch']]),
      help: 'Stromform des Fehlerstroms. Nur Typen, die diese Form erkennen, lösen aus; für alle anderen ist der Fehlerstrom unsichtbar.' },
    { key: 'iFehler', label: 'Fehlerstrom', type: 'slider', scale: 'log', logZero: true, min: 0, max: 1000, step: 0.1, unit: 'mA', unitKind: 'plain', value: 0, ebene: null, group: G_F,
      help: 'Fehlerstrom nach Erde über den Schutzleiter (Körperschluss). 0 heißt: kein Fehler. Bei unterbrochenem Schutzleiter kann er nicht fließen.' },
    { key: 'person', label: 'Berührung durch Person', type: 'switch', value: false, ebene: null, group: G_F,
      help: 'Eine Person berührt ein unter Spannung stehendes Teil. Der Körperstrom fließt nach Erde und wird zum Differenzstrom. Der RCD verkürzt die Einwirkzeit, er macht die Berührung nicht ungefährlich.' },
    { key: 'pe', label: 'Schutzleiter', type: 'select', value: 'angeschlossen', ebene: 'fehler', group: G_F, options: opt([['angeschlossen', 'angeschlossen'], ['unterbrochen', 'unterbrochen (Fehlerbild)']]),
      help: 'Schutzleiter angeschlossen oder unterbrochen. Unterbrochen ist ein Fehlerbild, das nur zur Erklärung dient: Der Fehlerstrom kann dann nicht nach Erde fließen, der RCD sieht ihn nicht. Die Prüftaste prüft den Schutzleiter nicht.' },
    leakDef('leak1', '1', 3), leakDef('leak2', '2', 2), leakDef('leak3', '3', 1),
    { key: 'taste', label: 'Prüftaste', type: 'button', ebene: null, group: G_R,
      help: 'Die Prüftaste erzeugt einen künstlichen Differenzstrom. Geprüft wird nur die Auslösefunktion des RCD, nicht den Schutzleiter und nicht den Erdungswiderstand.' },
    { key: 'fire', label: 'Auslösen', type: 'button', ebene: null, group: G_F,
      help: 'Legt den Fehlerstrom an (bei Fehler oder Berührung) oder drückt die Prüftaste, wenn kein Fehler eingestellt ist. Die Zeit läuft in Zeitlupe. Nur eine Simulation.' }
  ];
  const METERS = [
    { key: 'idiff', label: 'Differenzstrom IΔ', unit: 'mA', digits: 2, min: 0, max: 1000, help: 'Tatsächlicher Differenzstrom: Summe aller Ströme, die nach Erde fließen (Fehler, Person, Ableitströme).' },
    { key: 'ratio', label: 'Verhältnis IΔ / IΔn', unit: '', digits: 2, min: 0, max: 5, warnAbove: 0.5, help: 'Differenzstrom im Verhältnis zum Nennfehlerstrom. Ab 0,5 kann der RCD auslösen, ab 1 löst er sicher aus (Lehrfaustwert).' },
    { key: 'tTrip', label: 'Auslösezeit', unit: 'ms', digits: 0, min: 0, max: 300, zeroIsNone: true, help: 'Höchste Auslösezeit bei diesem Differenzstrom (Lehrmodell); 0 heißt: keine sichere Auslösung.' },
    { key: 'ausgeloest', label: 'RCD löst aus', unit: '', digits: 0, min: 0, max: 1, help: '1: Der RCD löst bei diesem Differenzstrom sicher aus (Lehrmodell), 0: nicht sicher.' }
  ];
  const BASE = { idn: 30, type: 'A', form: 'sinus', iFehler: 0, person: false, pe: 'angeschlossen', leak1: 3, leak2: 2, leak3: 1 };
  const preset = (id, name, info, over) => ({ id, name, info, params: Object.assign({}, BASE, over) });
  const PRESETS = [
    preset('taste', 'Prüftaste', 'Kein Fehler: Die Prüftaste prüft nur die Auslösefunktion, nicht den Schutzleiter.', {}),
    preset('koerperschluss', 'Körperschluss', 'Fehlerstrom über den Schutzleiter, größer als der Nennfehlerstrom: Der RCD löst aus.', { iFehler: 50 }),
    preset('mensch', 'Berührung durch Person', 'Körperstrom einer Person über den RCD: Er verkürzt die Zeit, die Berührung bleibt gefährlich.', { person: true }),
    preset('fehlausloesung', 'Fehlauslösung durch Ableitströme', 'Drei Geräte zusammen: Die Summe der Ableitströme liegt über der Marke 0,5 · IΔn.', { leak1: 8, leak2: 6, leak3: 4 }),
    preset('gleichstrom-typa', 'Gleichstrom an Typ A', 'Glatter Gleichfehlerstrom: Typ A erkennt die Form nicht, der RCD ist blind. Probiere Typ B.', { form: 'gleich', iFehler: 30 })
  ];
  const PFAD = { fehler: 'Fehlerstrom nach Erde oder Körperstrom einer Person', weg: 'Differenz der Ströme in Hin- und Rückleiter (Summenstromwandler)', schutz: 'RCD löst aus, wenn der Differenzstrom groß genug ist und der Typ die Stromform erkennt', art: 'verhalten' };
  const PARAMS = { U: 230, haut: 'nass', pfad: 'hand-fuss', rv: 0, iLast: 5000, dispS: 2.5, nachlaufS: 0.6, skalaMs: 400 };
  const SHAPE_NAME = { sinus: 'Sinus', puls: 'Puls', mix: 'Gemisch', gleich: 'Gleich' };
  const worst = (...a) => (a.indexOf('rot') >= 0 ? 'rot' : a.indexOf('gelb') >= 0 ? 'gelb' : 'gruen');

  function plant(P0) {
    const CORE = P0.CORE;
    let fireT = -1, mode = null, tasteDone = false;     // fireT s seit Start, mode 'fehler' | 'taste'
    const lim = (id, d) => { try { const l = CORE.limit(id); return l && isNum(l.value) ? l.value : d; } catch (e) { return d; } };

    function compute(ctl, par) {
      const cfg = { idn: ctl.idn, type: ctl.type, on: true };
      const ls = CORE.rcd.leakSum([ctl.leak1, ctl.leak2, ctl.leak3], cfg);
      if (!ls || ls.ok === false) return { ok: false, text: (ls && ls.why) || CORE.TEXTS.eingabe };
      let person = null;
      if (ctl.person) { person = CORE.rcd.person({ U: par.U, idn: ctl.idn, type: ctl.type, on: true, haut: par.haut, pfad: par.pfad, rv: par.rv }); if (person && person.ok === false) person = null; }
      const personMa = person ? person.iKmA : 0;
      const feldMa = ctl.pe === 'angeschlossen' ? ctl.iFehler : 0;
      const iDiff = CORE.rcd.sum([{ i: ctl.leak1, phase: 'L' }, { i: ctl.leak2, phase: 'L' }, { i: ctl.leak3, phase: 'L' }, { i: feldMa, phase: 'L' }, { i: personMa, phase: 'L' }]);
      if (!isNum(iDiff)) return { ok: false, text: CORE.TEXTS.eingabe };
      const ty = CORE.rcd.types.find(t => t.id === ctl.type);
      const erkennt = !!ty && ty.shapes.indexOf(ctl.form) >= 0;
      const sinusPart = ls.sum + personMa;
      const blind = feldMa > 0 && !erkennt;
      const blindText = blind ? CORE.rcd.trip(cfg, ctl.form, feldMa).text : '';
      const iSicht = sinusPart + (erkennt ? feldMa : 0);
      const trip = blind && sinusPart <= 0 ? CORE.rcd.trip(cfg, ctl.form, feldMa) : CORE.rcd.trip(cfg, erkennt && feldMa > 0 ? ctl.form : 'sinus', iSicht);
      if (!trip || trip.ok === false) return { ok: false, text: (trip && trip.why) || CORE.TEXTS.eingabe };
      const tTripMs = trip.tripped && isNum(trip.tTrip) ? trip.tTrip * 1000 : 0;
      const taste = CORE.rcd.testButton(cfg);
      return { ok: true, cfg, ls, person, personMa, feldMa, iDiff, iSicht, sinusPart, erkennt, blind, blindText, trip, tripped: !!trip.tripped, tTripMs,
        ratio: iDiff / ctl.idn, idn: ctl.idn, type: ctl.type, form: ctl.form, faultPresent: ctl.iFehler > 0 || !!ctl.person, taste, pe: ctl.pe,
        zone: person ? (trip.tripped && person.zoneMit ? person.zoneMit : person.zoneOhne) : null };
    }
    function meters(r) {
      if (!r || r.ok === false) return { idiff: 0, ratio: 0, tTrip: 0, ausgeloest: 0 };
      return { idiff: r.iDiff, ratio: r.ratio, tTrip: r.tTripMs, ausgeloest: r.tripped ? 1 : 0 };
    }
    function assess(r, ctl) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      const rb = lim('rcd_bereich', 0.5);
      let faultAmp = 'gruen';
      const t = [];
      if (r.iDiff > 0) t.push('Differenzstrom ' + fm(r.iDiff, 2) + ' mA (' + fm(r.ratio, 2) + ' · IΔn).');
      else t.push('Es fließt kein Differenzstrom: Hin- und Rückstrom heben sich im Summenstromwandler auf.');
      if (ctl.iFehler > 0) {
        if (r.blind) { faultAmp = 'rot'; t.push(r.blindText + ' Der Fehlerstrom bleibt unbemerkt.'); }
        else if (r.pe === 'unterbrochen') { faultAmp = 'rot'; t.push('Der Schutzleiter ist unterbrochen: Der Fehlerstrom kann nicht nach Erde fließen, der RCD sieht ihn nicht und löst deshalb nicht aus.'); }
        else { t.push(r.trip.text); faultAmp = worst(faultAmp, r.tripped ? 'gruen' : 'gelb'); }
      }
      if (r.person) {
        t.push(r.person.text);
        faultAmp = worst(faultAmp, !r.tripped ? 'rot' : r.zone.zone === 1 ? 'gruen' : r.zone.zone === 2 ? 'gelb' : 'rot');
        if (r.tripped && r.zone) t.push('Körperstrom in Zone ' + r.zone.zone + ' (' + r.zone.name + ').');
      }
      let leakAmp = 'gruen';
      if (r.ls.fehlausloesung) { leakAmp = 'rot'; t.push(r.ls.text); }
      else if (r.ls.nahe) { leakAmp = 'gelb'; t.push('Die Summe der Ableitströme ' + fm(r.ls.sum, 2) + ' mA liegt bei ' + fm(r.ls.ratio, 2) + ' · IΔn, nahe der Marke ' + fm(rb, 1) + ' · IΔn (Lehrfaustwert): Fehlauslösung droht.'); }
      else if (r.ls.sum > 0) t.push('Die Summe der Ableitströme ' + fm(r.ls.sum, 2) + ' mA liegt bei ' + fm(r.ls.ratio, 2) + ' · IΔn, unter 0,3 · IΔn (Lehrfaustwert).');
      let peAmp = 'gruen';
      if (r.pe === 'unterbrochen') { peAmp = 'gelb'; t.push('Schutzleiter unterbrochen: Ein Körperschluss wäre über den Schutzleiter nicht mehr zu erkennen.'); }
      if (tasteDone) t.push(r.taste.text);
      const a = worst(faultAmp, leakAmp, peAmp);
      const out = { ok: a !== 'rot', ampel: a, text: t.join(' ') };
      if (r.ls.ratio > 0) out.margin = rb / r.ls.ratio;
      if (r.person) out.zusatz = CORE.TEXTS.rcdVerkuerzt;
      return out;
    }
    function diag(r, ctl) {
      const out = [];
      if (!r || r.ok === false) return out;
      if (r.blind) out.push({ id: 'rcd-blind', kind: 'error', text: r.blindText });
      if (r.ls.fehlausloesung) out.push({ id: 'rcd-fehlausl', kind: 'warn', text: r.ls.text });
      else if (r.ls.nahe) out.push({ id: 'ableit-nahe', kind: 'info', text: 'Die Summe der Ableitströme ' + fm(r.ls.sum, 2) + ' mA liegt bei ' + fm(r.ls.ratio, 2) + ' · IΔn und damit nahe der Fehlauslösung (Lehrfaustwert).' });
      if (r.pe === 'unterbrochen' && ctl.iFehler > 0 && !ctl.person) out.push({ id: 'pe-unterbr', kind: 'error', text: 'Der Schutzleiter ist unterbrochen: Der Fehlerstrom kann nicht nach Erde fließen, der RCD sieht keinen Differenzstrom und löst nicht aus. Das ist ein Fehlerbild zur Erklärung, kein Vorgehen.' });
      if (r.trip.bereich === 'unsicher') out.push({ id: 'unsicher', kind: 'warn', text: r.trip.text });
      if (r.person && !r.tripped) out.push({ id: 'person-nicht', kind: 'error', text: r.person.text + ' Als Zusatzschutz sind höchstens ' + fm(lim('idn_zusatz', 30), 0) + ' mA vorgesehen.' });
      if (r.person && r.tripped) out.push({ id: 'person-verkuerzt', kind: 'info', text: r.person.text });
      if (tasteDone) out.push({ id: 'rcd-taste', kind: r.pe === 'unterbrochen' ? 'warn' : 'info', text: r.taste.text + (r.pe === 'unterbrochen' ? ' Der Schutzleiter ist trotzdem unterbrochen: Das zeigt die Taste nicht.' : '') });
      return out;
    }
    function curves(r, ctl) {
      const cfg = { idn: ctl.idn, type: ctl.type, on: true }, pts = [];
      [1, 1.5, 2, 3, 4, 5, 7, 10].forEach(m => { const tr = CORE.rcd.trip(cfg, 'sinus', m * ctl.idn); if (tr && tr.tripped && isNum(tr.tTrip)) pts.push([m, tr.tTrip * 1000]); });
      const c1 = { id: 'ausloesezeit', title: 'Auslösezeit über dem Differenzstrom (Lehrmodell, Übungswerte)', xLabel: 'Differenzstrom als Vielfaches von IΔn', xUnit: '· IΔn', xScale: 'lin', yLabel: 'höchste Auslösezeit', yUnit: 'ms', yScale: 'lin',
        series: [{ name: 'höchste Auslösezeit', points: pts }] };
      if (r && r.ok && r.tripped) c1.marker = { x: r.iSicht / r.idn, y: r.tTripMs, label: 'Arbeitspunkt ' + fm(r.tTripMs, 0) + ' ms' };
      c1.limit = { y: lim('rcd_zeit', 300), label: 'höchstens ' + fm(lim('rcd_zeit', 300), 0) + ' ms bei IΔn (Übungswert)' };
      const sums = [], max = Math.max(ctl.idn * 1.2, 1);
      for (let k = 0; k <= 24; k++) { const s = max * k / 24; sums.push([s, s / ctl.idn]); }
      const c2 = { id: 'ableitung', title: 'Ableitstrom-Summe im Verhältnis zu IΔn', xLabel: 'Summe der Ableitströme', xUnit: 'mA', xScale: 'lin', yLabel: 'Verhältnis zu IΔn', yUnit: '', yScale: 'lin',
        series: [{ name: 'Summe / IΔn', points: sums }] };
      if (r && r.ok) c2.marker = { x: r.ls.sum, y: r.ls.ratio, label: 'Summe ' + fm(r.ls.sum, 1) + ' mA' };
      c2.limit = { y: lim('rcd_bereich', 0.5), label: 'Fehlauslösung ab ' + fm(lim('rcd_bereich', 0.5), 1) + ' · IΔn (Lehrfaustwert)' };
      return [c1, c2];
    }
    function waveform(r) {
      if (!r || r.ok === false || !(r.iDiff > 0)) return null;
      const tEnd = r.tripped ? Math.max(r.tTripMs * 2.5, 100) : 400, N = 60, t = [], y = [], th = [];
      for (let k = 0; k <= N; k++) {
        const tk = tEnd * k / N; t.push(tk);
        y.push(r.tripped && tk > r.tTripMs ? 0 : r.iDiff);
        th.push(r.idn);
      }
      const marks = r.tripped ? [{ t: r.tTripMs, label: 'RCD löst aus (höchstens ' + fm(r.tTripMs, 0) + ' ms)' }] : [];
      return { tUnit: 'ms', t, series: [{ name: 'Differenzstrom IΔ', y, unit: 'mA' }, { name: 'Nennfehlerstrom IΔn', y: th, unit: 'mA' }], marks };
    }
    // ---- Zeitablauf der Anzeige (Zeitlupe) ----
    const started = () => fireT >= 0;
    const progress = (par, reduced) => (fireT < 0 ? 0 : reduced ? 1 : clamp(fireT / par.dispS, 0, 1));
    function tripNow(r, f, par) {
      if (!started() || !r || r.ok === false) return false;
      if (mode === 'taste') return r.taste && r.taste.tripped && f >= 0.3;
      return r.tripped && f * par.skalaMs >= r.tTripMs;
    }
    function typeTable(ctx, rect, r, ctl, pal, g, fs) {
      g.panel(ctx, rect.x, rect.y, rect.w, rect.h, pal.panel, pal.line, 8);
      g.text(ctx, 'Welcher Typ erkennt welche Form?', rect.x + 10, rect.y + 20, { size: fs, bold: true, color: pal.fg, max: rect.w - 20 });
      const shapes = ['sinus', 'puls', 'mix', 'gleich'], types = CORE.rcd.types || [];
      const x0 = rect.x + 10, lw = 46, cw = Math.max(40, (rect.w - 20 - lw) / 4), y0 = rect.y + 30, rh = Math.max(20, Math.min(30, (rect.h - 40) / 5));
      shapes.forEach((s, j) => {
        const cx = x0 + lw + j * cw;
        if (s === ctl.form) g.panel(ctx, cx + 1, y0, cw - 2, rh * 5, null, pal.pfad, 4);
        g.text(ctx, SHAPE_NAME[s], cx + cw / 2, y0 + rh / 2, { size: fs, bold: s === ctl.form, color: pal.mute, align: 'center', base: 'middle', max: cw - 2 });
      });
      types.forEach((ty, i) => {
        const yy = y0 + rh * (i + 1);
        if (ty.id === ctl.type) g.panel(ctx, x0 - 2, yy + 1, lw + cw * 4 + 4, rh - 2, null, B.ebeneColor('zusatz', pal), 4);
        g.text(ctx, 'Typ ' + ty.id, x0 + 2, yy + rh / 2, { size: fs, bold: ty.id === ctl.type, color: pal.fg, base: 'middle', max: lw - 4 });
        shapes.forEach((s, j) => {
          const yes = ty.shapes.indexOf(s) >= 0;
          g.text(ctx, yes ? '✓' : '✗', x0 + lw + j * cw + cw / 2, yy + rh / 2, { size: fs + 1, bold: true, color: yes ? pal.gruen : pal.rot, align: 'center', base: 'middle' });
        });
      });
    }
    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs, D = sc.D, ctl = view.ctl, par = view.rig.params;
      if (!R0 || !(R0.w >= 240 && R0.h >= 170) || !r || r.ok === false) {
        if (R0 && r && r.ok === false) g.text(ctx, r.text || '', R0.x + 8, R0.y + 20, { size: fs, color: pal.rot, max: R0.w - 16 });
        return;
      }
      const narrow = R0.w < 640, chipH = 32, n = R0.w < 760 ? 3 : 5, rows = Math.ceil(5 / n);
      const botH = rows * (chipH + 6) + 44, top = { x: R0.x, y: R0.y, w: R0.w, h: R0.h - botH - 4 };
      const f = progress(par, sc.reduced), tripped = tripNow(r, f, par);
      const swR = narrow ? { x: top.x, y: top.y, w: top.w, h: top.h >= 330 ? Math.round(top.h * 0.5) : top.h } : { x: top.x, y: top.y, w: Math.round(top.w * 0.55), h: top.h };
      const tbR = narrow ? (top.h >= 330 ? { x: top.x, y: top.y + swR.h + 6, w: top.w, h: top.h - swR.h - 6 } : null) : { x: top.x + swR.w + 8, y: top.y, w: top.w - swR.w - 8, h: top.h };
      // ---- oben: Summenstromwandler und Typ-Tabelle ----
      let done = false;
      const diffShow = mode === 'taste' && started() ? Math.max(r.iDiff, r.idn) : r.iDiff;
      if (D && typeof D.sumTransformer === 'function') {
        try { done = !!D.sumTransformer(ctx, swR, { iL: par.iLast + diffShow, iN: par.iLast, diff: diffShow, idn: r.idn, tripped }, { theme: sc.theme, quality: sc.quality, reduced: sc.reduced }); } catch (e) { done = false; }
      }
      if (!done) {
        g.panel(ctx, swR.x, swR.y, swR.w, swR.h, pal.panel, pal.line, 8);
        g.text(ctx, 'Summenstromwandler: IΔ = ' + fm(r.iDiff, 2) + ' mA, IΔn = ' + fm(r.idn, 0) + ' mA', swR.x + 10, swR.y + 22, { size: fs, color: pal.fg, max: swR.w - 20 });
        g.text(ctx, tripped ? 'RCD hat ausgelöst' : 'RCD bereit', swR.x + 10, swR.y + 44, { size: fs, color: tripped ? pal.rot : pal.mute, max: swR.w - 20 });
      }
      sc.hit('fire', swR.x, swR.y, swR.w, swR.h);
      if (tbR && tbR.w >= 200 && tbR.h >= 140) typeTable(ctx, tbR, r, ctl, pal, g, fs);
      // ---- unten: Tasten und Zeitbalken ----
      const by = R0.y + R0.h - botH, cwid = Math.floor((R0.w - (n - 1) * 8) / n);
      const chips = [['IΔn ', ctl.idn + ' mA', 'idn', B.ebeneColor('zusatz', pal)], ['Typ ', ctl.type, 'type', B.ebeneColor('zusatz', pal)], ['Form ', SHAPE_NAME[ctl.form], 'form', pal.fehler],
        ['', 'Prüftaste', 'taste', pal.pfad], ['', 'Auslösen', 'fire', pal.fehler]];
      chips.forEach((c, i) => {
        const cx = R0.x + (i % n) * (cwid + 8), cy = by + Math.floor(i / n) * (chipH + 6);
        g.chip(ctx, c[0], c[1], cx, cy, cwid, chipH, pal, { color: c[3], on: (c[2] === 'fire' || c[2] === 'taste') && started() && (c[2] === 'taste') === (mode === 'taste'), size: fs });
        sc.hit(c[2], cx, cy, cwid, chipH);
      });
      const bby = by + rows * (chipH + 6) + 14;
      const lab = mode === 'taste' && started() ? 'Prüftaste: künstlicher Differenzstrom, geprüft wird nur die Auslösefunktion'
        : r.tripped ? 'RCD löst höchstens nach ' + fm(r.tTripMs, 0) + ' ms aus (Zeitlupe, Skala ' + fm(par.skalaMs, 0) + ' ms)' : r.blind && r.sinusPart <= 0 ? 'RCD blind für diese Stromform: keine Auslösung' : 'keine sichere Auslösung bei diesem Differenzstrom';
      g.text(ctx, lab, R0.x, bby - 4, { size: fs, color: pal.mute, max: R0.w });
      const lm = mode !== 'taste' && r.tripped ? clamp(r.tTripMs / par.skalaMs, 0.01, 1) : undefined;
      g.bar(ctx, R0.x, bby, R0.w, 14, f, 1, tripped ? pal.rot : pal.gelb, pal, lm);
    }
    return {
      compute, meters, assess, diag, curves, waveform, draw,
      phaseHz: () => 0.5,
      step(dtMs, r, ctl) { if (fireT >= 0 && fireT < P0.params.dispS + P0.params.nachlaufS) fireT += dtMs / 1000; },
      fire(r, ctl) {
        const fehler = !!(ctl && (ctl.iFehler > 0 || ctl.person));
        mode = fehler ? 'fehler' : 'taste'; fireT = 0;
        if (mode === 'taste') { tasteDone = true; if (r && r.ok) P0.say(r.taste.text, 'info'); }
        else if (r && r.ok) P0.say('Fehlerstrom angelegt: ' + r.trip.text, r.tripped ? 'info' : 'warn');
        return true;
      },
      onButton(key) {
        if (key !== 'taste') return true;
        mode = 'taste'; fireT = 0; tasteDone = true; P0.bump();
        return true;
      },
      onControl() { fireT = -1; mode = null; tasteDone = false; },
      reset() { fireT = -1; mode = null; tasteDone = false; },
      state(r) {
        const f = progress(PARAMS, false);
        return { gestartet: started(), modus: mode || '', ausgeloest: !!(r && r.ok && tripNow(r, f, PARAMS)), blind: !!(r && r.ok && r.blind), fehlausloesung: !!(r && r.ok && r.ls.fehlausloesung),
          iSicht: r && r.ok ? r.iSicht : 0, tasteGedrueckt: tasteDone, fireT: Math.max(fireT, 0) };
      }
    };
  }

  R.register({ id: 'rcd', name: 'Der Summenstrom (RCD)', icon: '🌀',
    info: 'Summenstromwandler: Hin- und Rückstrom heben sich auf, ein Differenzstrom löst den RCD aus. Typ-Blindheit, Ableitströme, Prüftaste (Lehrmodell, Übungswerte). Simulation, kein Hinweis für Arbeiten an Netzspannung.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'rcd', name: 'Der Summenstrom (RCD)', icon: '🌀', info: '', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
