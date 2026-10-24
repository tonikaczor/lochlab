/* elsrig-isolation.js - ELS-Lab (WP2c): Pruefstand 6 `isolation` - Isolation und Schutzleiter (SPEC 5.6).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Zeichenhuelle) liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ELS_CORE.insu.measure/parts, pe.measure/limit, leak.touch, limit); hier steht keine zweite Formel.
 * Alle Werte sind Uebungswerte (Uebungsanlage; F1 Schutzleiter ueber 5 m, F2 Pruefspannung und SK III, F3 Beruehrungsstrom SK I).
 * Messung nur am freigeschalteten, getrennten Pruefling (TEXTS.isoNurFrei). Simulation, keine Messanleitung fuer Netzspannung.
 * Steuerwerte: art (riso / rpe / ableit = zu beurteilende Messung), sk, feuchte, schmutz, defekt, uPruef (nur Anzeige), mode (2L/4L), rk (Kontaktwiderstand, Ohm), len (m), q (mm2),
 *   bruch (kein/wackel/offen), wiggle (Leitung bewegen), cy (Y-Kondensator, nF), Taste fire (Messung starten).
 * Messgeraete: riso (MOhm), rpe (Ohm; 0 = entfaellt bei SK II/III), iAbleit (mA), urteil (0 kein Urteil, 1 bestanden, 2 nicht bestanden, 3 unvollstaendig). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-isolation.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng } = B;

  const G_A = 'Messung', G_I = 'Isolierung', G_P = 'Schutzleiter und Messspitze', G_Y = 'Ableitstrom';
  const opt = (arr) => arr.map(a => ({ value: a[0], label: a[1] }));
  const visArt = (a) => (st) => !st || st.art === a;
  const ART = { riso: 'Isolation', rpe: 'Schutzleiter', ableit: 'Ableitstrom' };
  const CONTROLS = [
    { key: 'art', label: 'Messung', type: 'select', value: 'riso', options: opt([['riso', 'Isolationswiderstand'], ['rpe', 'Schutzleiterwiderstand'], ['ableit', 'Ableitstrom (SK I: Schutzleiterstrom, SK II: Berührungsstrom)']]), ebene: null, group: G_A,
      help: 'Welche Messung beurteilt wird. Isolationswiderstand und Schutzleiterwiderstand nur am freigeschalteten, getrennten Prüfling. Den Ableitstrom misst die Elektrofachkraft mit geprüftem Prüfaufbau.' },
    { key: 'sk', label: 'Schutzklasse', type: 'select', value: 'I', options: opt([['I', 'Schutzklasse I'], ['II', 'Schutzklasse II'], ['III', 'Schutzklasse III']]), ebene: null, group: G_A,
      help: 'Die Schutzklasse bestimmt den Grenzwert: Isolation ab 1 MΩ (SK I) oder 2 MΩ (SK II), Schutzleiterwiderstand nur bei SK I. Für SK III gibt es im Lab keinen Isolationsgrenzwert (F2). Der Ableitstrom gilt bei SK I als Schutzleiterstrom, bei SK II als Berührungsstrom.' },
    { key: 'feuchte', label: 'Feuchte', type: 'slider', scale: 'lin', min: 0, max: 1, step: 0.01, unit: '', unitKind: 'plain', value: 0, ebene: 'basis', group: G_I, visible: visArt('riso'),
      help: 'Feuchte der Isolierung von 0 (trocken) bis 1 (nass). Feuchte bildet einen Leckpfad parallel zum Material und senkt den Isolationswiderstand (Lehrmodell, Übungswerte).' },
    { key: 'schmutz', label: 'Verschmutzung', type: 'slider', scale: 'lin', min: 0, max: 1, step: 0.01, unit: '', unitKind: 'plain', value: 0, ebene: 'basis', group: G_I, visible: visArt('riso'),
      help: 'Verschmutzungsgrad von 0 bis 1. Schmutz bildet einen weiteren Leckpfad parallel zum Material (Lehrmodell, Übungswerte).' },
    { key: 'defekt', label: 'Isolierung durchgeschlagen', type: 'switch', value: false, ebene: 'basis', group: G_I, visible: visArt('riso'),
      help: 'Ein Durchschlag der Isolierung ist ein Leckpfad von 0,2 MΩ parallel zum Material. Simulation eines Fehlers: Das Gerät ist dann nicht in Ordnung.' },
    { key: 'uPruef', label: 'Prüfspannung', type: 'select', value: 500, options: [{ value: 500, label: '500 V Gleichspannung' }], ebene: null, group: G_I, visible: visArt('riso'),
      help: 'Prüfspannung der Isolationsmessung, nur zur Anzeige: Übungswert 500 V Gleichspannung (F2).' },
    { key: 'mode', label: 'Messart', type: 'select', value: '2L', options: opt([['2L', '2-Leiter'], ['4L', '4-Leiter']]), ebene: null, group: G_P, visible: visArt('rpe'),
      help: 'Bei der 2-Leiter-Messung zählt der Kontaktwiderstand der Messspitze mit, bei der 4-Leiter-Messung wird die Spannung getrennt abgegriffen und der Kontakt fällt heraus.' },
    { key: 'rk', label: 'Kontaktwiderstand', type: 'slider', scale: 'log', min: 0.01, max: 0.5, step: 0.01, unit: 'Ω', unitKind: 'res', value: 0.1, ebene: null, group: G_P, visible: visArt('rpe'),
      help: 'Übergangswiderstand der Messspitze (Übungswert 0,01 bis 0,5 Ω). Er verfälscht nur die 2-Leiter-Messung und kann das Urteil kippen.' },
    { key: 'len', label: 'Leitungslänge', type: 'slider', scale: 'log', min: 0.3, max: 30, step: 0.1, unit: 'm', unitKind: 'len', value: 1.5, ebene: 'fehler', group: G_P, visible: visArt('rpe'),
      help: 'Länge der Anschlussleitung des Prüflings. Der Grenzwert 0,3 Ω gilt bis 5 m; darüber gilt ein Zuschlag nach Norm, dafür hat das Lab keinen Wert (F1) und gibt kein Urteil.' },
    { key: 'q', label: 'Querschnitt', type: 'select', value: 1, options: opt([[0.75, '0,75 mm²'], [1, '1 mm²'], [1.5, '1,5 mm²'], [2.5, '2,5 mm²'], [4, '4 mm²']]), ebene: 'fehler', group: G_P, visible: visArt('rpe'),
      help: 'Querschnitt des Schutzleiters in der Anschlussleitung. Mehr Querschnitt ergibt weniger Widerstand: R = ρ · l / q mit ρ = 0,0178 Ω·mm²/m.' },
    { key: 'bruch', label: 'Schutzleiter', type: 'select', value: 'kein', options: opt([['kein', 'in Ordnung'], ['wackel', 'Wackelkontakt'], ['offen', 'unterbrochen']]), ebene: 'fehler', group: G_P, visible: visArt('rpe'),
      help: 'Zustand des Schutzleiters im Prüfling. Ein Wackelkontakt zeigt sich nur beim Bewegen der Leitung, ein unterbrochener Schutzleiter überschreitet den Messbereich. Das ist ein Fehlerbild und keine Anleitung.' },
    { key: 'wiggle', label: 'Leitung bewegen', type: 'switch', value: false, ebene: null, group: G_P, visible: visArt('rpe'),
      help: 'Wackelprüfung: Während der Messung wird die Leitung bewegt. Ein Wackelkontakt lässt den Wert dann schwanken.' },
    { key: 'cy', label: 'Y-Kondensator', type: 'slider', scale: 'log', min: 0.1, max: 100, step: 0.1, unit: 'nF', unitKind: 'cap', value: 2.2, ebene: 'basis', group: G_Y, visible: visArt('ableit'),
      help: 'Kapazität des Y-Kondensators zwischen Netzanschluss und berührbarem Teil. Der Ableitstrom ist I = 2π · f · C · U (50 Hz, 230 V). Referenz: 2,2 nF ergibt 0,159 mA.' },
    { key: 'fire', label: 'Messen', type: 'button', ebene: null, group: G_A, help: 'Startet die Messung: Der Zeiger läuft auf den Messwert ein. Das ist nur eine Simulation am freigeschalteten, getrennten Prüfling.' }
  ];
  const METERS = [
    { key: 'riso', label: 'Isolationswiderstand R_iso', unit: 'MΩ', digits: 3, min: 0, max: 1000, warnBelow: 1, help: 'Gesamtwiderstand aller Leckpfade parallel bei 500 V (Übungswert).' },
    { key: 'rpe', label: 'Schutzleiterwiderstand R_pe', unit: 'Ω', digits: 3, min: 0, max: 2, warnAbove: 0.3, zeroIsNone: true, help: 'Widerstand des Schutzleiters in der Anschlussleitung, bei 2-Leiter-Messung mit Kontaktwiderstand. 0 heißt: entfällt, weil der Prüfling keinen Schutzleiter hat.' },
    { key: 'iAbleit', label: 'Ableitstrom I_ab (SK I: Schutzleiterstrom, SK II: Berührungsstrom)', unit: 'mA', digits: 3, min: 0, max: 5, help: 'Strom über den Y-Kondensator von 230 V und 50 Hz: bei Schutzklasse I fließt er über den Schutzleiter (Schutzleiterstrom), bei Schutzklasse II über ein berührbares Teil (Berührungsstrom). Der Grenzwert hängt von der Schutzklasse ab, das Urteil zeigt die Anzeige Urteil.' },
    { key: 'urteil', label: 'Urteil', unit: '', digits: 0, min: 0, max: 3, zeroIsNone: true, help: 'Urteil zur gewählten Messung: 1 bestanden, 2 nicht bestanden, 3 unvollständig (Wackelprüfung fehlt), 0 kein Urteil möglich.' }
  ];
  const PRESETS = [
    { id: 'riso-trocken', name: 'Isolation trocken', info: 'Neues, trockenes Gerät: Der Isolationswiderstand liegt weit über dem Grenzwert.', params: { art: 'riso', sk: 'I', feuchte: 0, schmutz: 0, defekt: false } },
    { id: 'riso-feucht', name: 'Isolation feucht', info: 'Feuchte bildet einen Leckpfad parallel zum Material: Der Isolationswiderstand fällt unter den Grenzwert.', params: { art: 'riso', sk: 'I', feuchte: 0.8, schmutz: 0, defekt: false } },
    { id: 'pe-2l-4l', name: 'Schutzleiter 2-Leiter und 4-Leiter', info: 'Ein großer Kontaktwiderstand der Messspitze verfälscht die 2-Leiter-Messung; die 4-Leiter-Messung zeigt den Leitungswert.', params: { art: 'rpe', sk: 'I', mode: '2L', rk: 0.3, len: 1.5, q: 0.75, bruch: 'kein', wiggle: false } },
    { id: 'pe-bruch', name: 'Schutzleiter mit Wackelkontakt', info: 'Der Wackelkontakt zeigt sich erst beim Bewegen der Leitung.', params: { art: 'rpe', sk: 'I', mode: '4L', len: 1.5, q: 1, bruch: 'wackel', wiggle: true } },
    { id: 'y-ableit', name: 'Ableitstrom über Y-Kondensator', info: 'Netzteil der Schutzklasse II mit 4,7 nF: Der Berührungsstrom liegt unter 0,5 mA.', params: { art: 'ableit', sk: 'II', cy: 4.7 } }
  ];
  const PFAD = { fehler: 'Isolationsfehler oder Leitungsfehler im Prüfling', weg: 'Messspannung über die Leckpfade bzw. Messstrom durch den Schutzleiter', schutz: 'Prüfung am freigeschalteten, getrennten Prüfling mit Grenzwert', art: 'messung' };
  const PARAMS = { rho: 0.0178, rMat: 1e9, dispMs: 1800 };
  const URTEIL = { grau: 0, ok: 1, nicht: 2, unvoll: 3 };

  function plant(P0) {
    const CORE = P0.CORE;
    let measT = -1, clk = 0;                              // ms seit Messbeginn (-1 = keine Messung), laufende Uhr fuer das Schwanken
    const cfgIns = (ctl, par, fe) => ({ rMat: par.rMat, feuchte: fe === undefined ? ctl.feuchte : fe, schmutz: ctl.schmutz, defekt: ctl.defekt, sk: ctl.sk, uPruef: CORE.limit('upruef_iso').value });
    const cfgPe = (ctl, par, o) => Object.assign({ len: ctl.len, q: ctl.q, rho: par.rho, mode: ctl.mode, rk: ctl.rk, wiggle: ctl.wiggle, bruch: ctl.bruch === 'kein' ? false : ctl.bruch, seed: 1 }, o || {});

    function compute(ctl, par) {
      const sk = ctl.sk, ci = cfgIns(ctl, par);
      const ins = CORE.insu.measure(ci), parts = CORE.insu.parts(ci);
      if (!ins || ins.ok === false || !parts || parts.ok === false) return { ok: false, text: (ins && ins.why) || CORE.TEXTS.eingabe };
      const hasPe = sk === 'I';
      const pe = hasPe ? CORE.pe.measure(cfgPe(ctl, par)) : null;
      if (hasPe && (!pe || pe.ok === false)) return { ok: false, text: (pe && pe.why) || CORE.TEXTS.eingabe };
      const ab = CORE.leak.touch({ cy: ctl.cy, sk });
      if (!ab || ab.ok === false) return { ok: false, text: (ab && ab.why) || CORE.TEXTS.eingabe };
      const o = { ok: true, art: ctl.art, sk, ins, parts, pe, ab, hasPe, v: null };
      o.v = verdict(o, ctl);
      return o;
    }
    function verdict(r, ctl) {
      const art = ctl.art;
      if (art === 'riso') {
        const m = r.ins;
        if (m.bestanden === null) return { ampel: 'grau', text: m.text, urteil: URTEIL.grau, zusatz: CORE.TEXTS.isoNurFrei };
        const ampel = !m.bestanden ? 'rot' : m.nahe ? 'gelb' : 'gruen';
        return { ampel, text: m.text + (m.nahe ? ' Der Wert liegt nahe am Grenzwert.' : ''), urteil: m.bestanden ? URTEIL.ok : URTEIL.nicht, margin: m.rMOhm / m.grenze, zusatz: CORE.TEXTS.isoNurFrei };
      }
      if (art === 'rpe') {
        if (!r.hasPe) return { ampel: 'grau', text: 'Schutzklasse ' + r.sk + ' hat keinen Schutzleiter: Der Schutzleiterwiderstand entfällt, geprüft wird die Isolierung.', urteil: URTEIL.grau, zusatz: CORE.TEXTS.isoNurFrei };
        const p = r.pe;
        if (!p.grenze || !p.grenze.valid) return { ampel: 'grau', text: p.text, urteil: URTEIL.grau, zusatz: CORE.TEXTS.isoNurFrei };
        const unvoll = p.bestanden === true && p.bruch === 'wackel' && !p.wiggle;
        if (unvoll) return { ampel: 'gelb', text: p.text, urteil: URTEIL.unvoll, margin: p.grenze.value / p.R, zusatz: CORE.TEXTS.isoNurFrei };
        return { ampel: p.bestanden ? 'gruen' : 'rot', text: p.text, urteil: p.bestanden ? URTEIL.ok : URTEIL.nicht, margin: p.ueberlauf ? undefined : p.grenze.value / p.R, zusatz: CORE.TEXTS.isoNurFrei };
      }
      const a = r.ab;
      if (a.bestanden === null) return { ampel: 'grau', text: a.text, urteil: URTEIL.grau, zusatz: CORE.TEXTS.messNurFachkraft };
      return { ampel: a.bestanden ? 'gruen' : 'rot', text: a.text, urteil: a.bestanden ? URTEIL.ok : URTEIL.nicht, margin: a.imA > 0 ? a.grenze / a.imA : undefined, zusatz: CORE.TEXTS.messNurFachkraft };
    }
    function meters(r) {
      if (!r || r.ok === false) return { riso: 0, rpe: 0, iAbleit: 0, urteil: 0 };
      return { riso: r.ins.rMOhm, rpe: r.pe ? r.pe.R : 0, iAbleit: r.ab.imA, urteil: r.v.urteil };
    }
    function assess(r) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      const v = r.v, o = { ok: v.ampel !== 'rot' && v.ampel !== 'grau', ampel: v.ampel, text: v.text };
      if (isNum(v.margin)) o.margin = v.margin;
      if (v.zusatz) o.zusatz = v.zusatz;
      return o;
    }
    function diag(r, ctl) {
      const out = [];
      if (!r || r.ok === false) return out;
      if (ctl.art === 'riso') {
        const fe = r.parts.parts.find(p => p.id === 'feuchte');
        if (fe && r.ins.bestanden === false) out.push({ id: 'leckpfad-feuchte', kind: 'warn', text: 'Die Feuchtigkeit bildet einen Leckpfad von ' + eng(fe.R, 'Ω') + ' parallel zum Material und senkt den Gesamtwert auf ' + eng(r.ins.R_gemessen, 'Ω') + '.' });
        if (ctl.defekt) out.push({ id: 'durchschlag', kind: 'error', text: 'Die Isolierung ist durchgeschlagen: Der Leckpfad parallel zum Material begrenzt den Isolationswiderstand auf ' + eng(r.ins.R_gemessen, 'Ω') + '.' });
        out.push({ id: 'nur-frei', kind: 'info', text: CORE.TEXTS.isoNurFrei });
      } else if (ctl.art === 'rpe') {
        if (!r.hasPe) out.push({ id: 'entfaellt', kind: 'info', text: 'Schutzklasse ' + r.sk + ' hat keinen Schutzleiter: Der Schutzleiterwiderstand entfällt.' });
        else {
          const p = r.pe;
          if (!p.grenze.valid) out.push({ id: 'ueber-5m', kind: 'warn', text: p.grenze.text });
          if (p.verfaelscht) out.push({ id: 'kontakt-verfaelscht', kind: 'warn', text: 'Der Kontaktwiderstand der Messspitze von ' + fm(p.R_Kontakt, 3) + ' Ω verfälscht das Urteil: Ohne ihn sind es ' + fm(p.rKorr, 3) + ' Ω.' });
          if (p.ueberlauf) out.push({ id: 'unterbrochen', kind: 'error', text: 'Der Messbereich ist überschritten: Der Schutzleiter ist unterbrochen.' });
          if (p.bruch === 'wackel' && !p.wiggle) out.push({ id: 'wackel-unentdeckt', kind: 'warn', text: 'Der gute Wert täuscht: Der Schutzleiter hat einen Wackelkontakt, der erst beim Bewegen der Leitung auftritt.' });
          if (p.bruch === 'wackel' && p.wiggle) out.push({ id: 'wackel', kind: 'error', text: 'Beim Bewegen der Leitung schwankt der Wert zwischen ' + fm(p.rMin, 3) + ' Ω und ' + fm(p.rMax, 3) + ' Ω: Wackelkontakt im Schutzleiter.' });
        }
        out.push({ id: 'nur-frei', kind: 'info', text: CORE.TEXTS.isoNurFrei });
      } else {
        if (r.ab.bestanden === false) out.push({ id: 'ableit-zu-gross', kind: 'error', text: 'Der ' + (r.sk === 'I' ? 'Schutzleiterstrom ' : 'Berührungsstrom ') + fm(r.ab.imA, 3) + ' mA ist zu groß; die größte Kapazität unter dem Grenzwert ist ' + fm(r.ab.cMaxNf, 2) + ' nF.' });
        out.push({ id: 'nur-fachkraft', kind: 'info', text: CORE.TEXTS.messNurFachkraft });
      }
      return out;
    }
    function curves(r, ctl, par) {
      par = P0.params;
      const cs = [];
      const xs = n => Array.from({ length: n + 1 }, (_, k) => k / n);
      // Isolationswiderstand ueber der Feuchte
      {
        const pts = xs(20).map(f => { const m = CORE.insu.measure(cfgIns(ctl, par, f)); return m && m.ok !== false ? [f, m.rMOhm] : null; }).filter(Boolean);
        const c = { id: 'riso-feuchte', title: 'Isolationswiderstand über der Feuchte (Lehrmodell, Übungswerte)', xLabel: 'Feuchte (0 bis 1)', xUnit: '', xScale: 'lin', yLabel: 'Isolationswiderstand', yUnit: 'MΩ', yScale: 'log', series: [{ name: 'R_iso', points: pts }] };
        if (r && r.ok !== false) { c.marker = { x: ctl.feuchte, y: Math.max(r.ins.rMOhm, 1e-6), label: 'Betriebspunkt ' + fm(r.ins.rMOhm, 3) + ' MΩ' }; if (r.ins.grenze) c.limit = { y: r.ins.grenze, label: 'Grenzwert ' + fm(r.ins.grenze, 0) + ' MΩ (Schutzklasse ' + ctl.sk + ')' }; }
        cs.push(c);
      }
      // Schutzleiterwiderstand ueber der Laenge
      {
        const lens = Array.from({ length: 21 }, (_, k) => 0.3 * Math.pow(100, k / 20));
        const mk = mode => lens.map(l => { const m = CORE.pe.measure(cfgPe(ctl, par, { len: l, mode, bruch: false, wiggle: false })); return m && m.ok !== false ? [l, m.R] : null; }).filter(Boolean);
        const c = { id: 'rpe-laenge', title: 'Schutzleiterwiderstand über der Leitungslänge (Übungswerte)', xLabel: 'Leitungslänge', xUnit: 'm', xScale: 'log', yLabel: 'Schutzleiterwiderstand', yUnit: 'Ω', yScale: 'lin',
          series: [{ name: '2-Leiter (mit Kontakt)', points: mk('2L') }, { name: '4-Leiter', points: mk('4L') }] };
        if (r && r.ok !== false && r.pe && !r.pe.ueberlauf) c.marker = { x: ctl.len, y: r.pe.R, label: 'Betriebspunkt ' + fm(r.pe.R, 3) + ' Ω' };
        const lim = CORE.pe.limit(1);
        if (lim && lim.valid) c.limit = { y: lim.value, label: 'Grenzwert ' + fm(lim.value, 1) + ' Ω bis 5 m' };
        cs.push(c);
      }
      // Beruehrungsstrom ueber der Y-Kapazitaet
      {
        const cap = Array.from({ length: 21 }, (_, k) => 0.1 * Math.pow(1000, k / 20));
        const pts = cap.map(cy => { const a = CORE.leak.touch({ cy, sk: ctl.sk }); return a && a.ok !== false ? [cy, a.imA] : null; }).filter(Boolean);
        const c = { id: 'ableit-cy', title: 'Ableitstrom über der Y-Kapazität (230 V, 50 Hz)', xLabel: 'Y-Kapazität', xUnit: 'nF', xScale: 'log', yLabel: 'Ableitstrom', yUnit: 'mA', yScale: 'lin', series: [{ name: 'I_ab = 2π · f · C · U', points: pts }] };
        if (r && r.ok !== false) { c.marker = { x: ctl.cy, y: r.ab.imA, label: 'Betriebspunkt ' + fm(r.ab.imA, 3) + ' mA' }; if (r.ab.grenze) c.limit = { y: r.ab.grenze, label: 'Grenzwert ' + fm(r.ab.grenze, 1) + ' mA (Schutzklasse ' + ctl.sk + ')' }; }
        cs.push(c);
      }
      return cs;
    }
    // ---- Zeichnen ----
    const running = () => measT >= 0;
    const prog = (reduced) => (measT < 0 ? 0 : reduced ? 1 : clamp(measT / PARAMS.dispMs, 0, 1));
    const ease = (f) => 1 - Math.pow(1 - f, 3);
    function gauge(r, ctl) {
      const v = r.v;
      if (ctl.art === 'riso') return { val: r.ins.rMOhm, unit: 'MΩ', log: true, lo: 0.01, hi: 10000, lim: r.ins.grenze, d: 3, below: true };
      if (ctl.art === 'rpe') {
        if (!r.hasPe) return null;
        let val = r.pe.R;
        if (r.pe.schwankt && r.pe.werte.length > 1 && r.pe.wiggle) val = r.pe.werte[Math.floor(clk / 180) % r.pe.werte.length];
        const lim = CORE.pe.limit(ctl.len);
        return { val, unit: 'Ω', log: true, lo: 0.01, hi: 1e6, lim: lim && lim.valid ? lim.value : null, d: 3, over: r.pe.ueberlauf };
      }
      const hi = Math.max(r.ab.grenze ? r.ab.grenze * 2 : 1, r.ab.imA * 1.15, 0.1);
      return { val: r.ab.imA, unit: 'mA', log: false, lo: 0, hi, lim: r.ab.grenze, d: 3 };
    }
    function wrap(ctx, g, s, x, y, w, size, color, maxLines, lh) {
      ctx.font = g.font(size, false);
      const words = String(s).split(' '), lines = []; let cur = '';
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > w) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur);
      if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(' '); lines.length = maxLines - 1; lines.push(rest); }
      lines.forEach((ln, i) => g.text(ctx, ln, x, y + i * lh, { size, color, max: w }));
      return y + lines.length * lh;
    }
    function ableitScene(ctx, rect, r, ctl, sc) {
      const g = sc.gfx, pal = sc.pal, fs = sc.fs;
      g.panel(ctx, rect.x, rect.y, rect.w, rect.h, pal.panel, pal.line, 8);
      const px = rect.x + rect.w * 0.30, pw = rect.x + rect.w - 14 - px, mid = rect.y + rect.h * 0.46, yN = mid + 22, yL = mid - 22;
      g.panel(ctx, px, rect.y + 28, pw, rect.h - 76, pal.panel2, pal.fg, 8);
      g.text(ctx, 'Prüfling, Schutzklasse ' + ctl.sk, px + 8, rect.y + 22, { size: fs, color: pal.mute, max: pw - 8 });
      g.text(ctx, 'Netzanschluss', rect.x + 10, yL - 10, { size: fs, color: pal.mute, max: px - rect.x - 16 });
      g.line(ctx, [[rect.x + 10, yL], [px + 20, yL]], pal.l1, 3);
      g.line(ctx, [[rect.x + 10, yN], [px + 20, yN]], pal.neutral, 3);
      g.text(ctx, 'L', rect.x + 12, yL + 14, { size: fs, bold: true, color: pal.l1 });
      g.text(ctx, 'N', rect.x + 12, yN + 14, { size: fs, bold: true, color: pal.neutral });
      // Y-Kondensator von L zum beruehrbaren Teil
      const cx = px + pw * 0.45, yG = rect.y + rect.h - 52;
      g.line(ctx, [[px + 20, yL], [cx, yL], [cx, yL + 24]], pal.l1, 3);
      g.line(ctx, [[cx - 14, yL + 24], [cx + 14, yL + 24]], pal.fg, 3);
      g.line(ctx, [[cx - 14, yL + 32], [cx + 14, yL + 32]], pal.fg, 3);
      g.line(ctx, [[cx, yL + 32], [cx, yG]], pal.fehler, 3);
      g.text(ctx, 'C_Y ' + fm(ctl.cy, 1) + ' nF', cx + 20, yL + 32, { size: fs, bold: true, color: pal.fg, bg: pal.panel2, max: pw * 0.5 });
      g.text(ctx, 'berührbares Teil', cx + 10, yG - 8, { size: fs, color: pal.mute, max: pw * 0.5 });
      g.line(ctx, [[cx, yG], [cx, yG + 14]], pal.fehler, 3);
      g.line(ctx, [[cx - 12, yG + 14], [cx + 12, yG + 14]], pal.pe, 3);
      g.line(ctx, [[cx - 7, yG + 20], [cx + 7, yG + 20]], pal.pe, 3);
      g.text(ctx, 'I = ' + fm(r.ab.imA, 3) + ' mA', rect.x + 10, rect.y + rect.h - 12, { size: fs + 1, bold: true, color: pal.fg, max: rect.w * 0.45 });
      g.text(ctx, r.ab.grenze ? 'Grenzwert ≤ ' + fm(r.ab.grenze, 1) + ' mA' : 'kein Grenzwert', rect.x + rect.w - 10, rect.y + rect.h - 12, { size: fs, color: pal.mute, align: 'right', max: rect.w * 0.45 });
    }
    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs, D = sc.D, ct = view.ctl;
      if (!R0 || !(R0.w >= 240 && R0.h >= 300) || !r || r.ok === false) return;
      const wide = R0.w >= 620, chH = 32, gap = 6;
      const chips = [
        { key: 'fire', label: '', value: 'Messen', color: pal.fehler, on: running() },
        { key: 'art', label: 'Art ', value: ART[ct.art] },
        { key: 'sk', label: 'Klasse ', value: ct.sk }
      ];
      if (ct.art === 'rpe') { chips.push({ key: 'mode', label: 'Messart ', value: ct.mode === '2L' ? '2-Leiter' : '4-Leiter' }); chips.push({ key: 'wiggle', label: 'Wackeln ', value: ct.wiggle ? 'ja' : 'nein', on: ct.wiggle }); }
      const cols = wide ? Math.min(5, chips.length) : 2, rows = Math.ceil(chips.length / cols), chipsH = rows * (chH + gap), gaugeH = 58;
      const cw = (R0.w - (cols - 1) * gap) / cols;
      chips.forEach((c, i) => {
        const x = R0.x + (i % cols) * (cw + gap), y = R0.y + R0.h - chipsH + Math.floor(i / cols) * (chH + gap);
        g.chip(ctx, c.label, c.value, x, y, cw, chH, pal, { color: c.color, on: c.on, size: fs });
        sc.hit(c.key, x, y, cw, chH);
      });
      const f = prog(sc.reduced), e = ease(f), gy = R0.y + R0.h - chipsH - gaugeH - 2;
      const top = { x: R0.x, y: R0.y, w: R0.w, h: gy - R0.y - 6 };
      // ---- oben: Schaltbild ----
      let done = false;
      const meas = f >= 1 ? true : false;
      if (ct.art === 'ableit') { ableitScene(ctx, top, r, ct, sc); done = true; }
      else if (D && typeof D.isoCircuit === 'function' && top.w >= 240 && top.h >= 140) {
        try {
          if (ct.art === 'riso') {
            const st = { art: 'riso', branches: r.parts.parts.map(p => ({ name: p.name, r: p.R / 1e6 })), mode: '2L', unit: 'MΩ' };
            if (meas) st.rMeas = fm(r.ins.rMOhm, 3) + ' MΩ';
            done = !!D.isoCircuit(ctx, top, st, { theme: sc.theme });
          } else if (r.hasPe) {
            const st = { art: 'rpe', branches: [{ name: 'Schutzleiter ' + fm(ct.len, 1) + ' m', r: r.pe.R_Leitung }], mode: ct.mode, rk: ct.rk, unit: 'Ω' };
            if (meas) st.rMeas = r.pe.ueberlauf ? 'Bereich überschritten' : fm(r.pe.R, 3) + ' Ω';
            done = !!D.isoCircuit(ctx, top, st, { theme: sc.theme });
          }
        } catch (e2) { done = false; }
      }
      if (!done) {
        g.panel(ctx, top.x, top.y, top.w, top.h, pal.panel, pal.line, 8);
        const txt = ct.art === 'rpe' && !r.hasPe ? 'Schutzklasse ' + ct.sk + ': kein Schutzleiter, der Schutzleiterwiderstand entfällt.' : 'Schaltbild: ' + ART[ct.art];
        wrap(ctx, g, txt, top.x + 12, top.y + 26, top.w - 24, fs + 1, pal.fg, 3, fs + 6);
        g.text(ctx, CORE.TEXTS.isoNurFrei, top.x + 12, top.y + top.h - 12, { size: fs, color: pal.mute, max: top.w - 24 });
      }
      // ---- Mitte: Anzeige ----
      const gg = gauge(r, ct);
      g.panel(ctx, R0.x, gy, R0.w, gaugeH, pal.panel, pal.line, 8);
      if (gg) {
        const frac = (v) => gg.log ? clamp((Math.log10(Math.max(v, gg.lo)) - Math.log10(gg.lo)) / (Math.log10(gg.hi) - Math.log10(gg.lo)), 0, 1) : clamp((v - gg.lo) / (gg.hi - gg.lo), 0, 1);
        const shown = gg.over ? gg.val : gg.val * e, started = measT >= 0;
        const acol = pal[r.v.ampel] || pal.grau;
        const label = !started ? 'Anzeige bereit: Taste „Messen“' : gg.over && f >= 1 ? 'Messbereich überschritten' : eng(started ? (gg.unit === 'MΩ' ? shown * 1e6 : gg.unit === 'mA' ? shown / 1000 : shown) : 0, gg.unit === 'MΩ' ? 'Ω' : gg.unit === 'mA' ? 'A' : gg.unit);
        g.text(ctx, label, R0.x + 10, gy + 18, { size: fs + 1, bold: true, color: pal.fg, max: R0.w - 20 });
        g.text(ctx, ART[ct.art] + (gg.lim ? ' · Grenzwert ' + (gg.below ? '≥ ' : gg.unit === 'Ω' || gg.unit === 'mA' ? '≤ ' : '') + fm(gg.lim, gg.lim < 1 ? 1 : 0) + ' ' + gg.unit : ' · kein Grenzwert'), R0.x + 10, gy + 36, { size: fs, color: pal.mute, max: R0.w - 20 });
        g.bar(ctx, R0.x + 10, gy + 42, R0.w - 20, 10, started ? (gg.over ? 1 : frac(Math.max(shown, 1e-12))) : 0, 1, started ? acol : pal.grau, pal, gg.lim ? frac(gg.lim) : undefined);
      } else g.text(ctx, 'Keine Anzeige: ' + (r.v.text || ''), R0.x + 10, gy + 20, { size: fs, color: pal.mute, max: R0.w - 20 });
    }
    return {
      compute, meters, assess, diag, curves, draw,
      phaseHz: () => 0.4,
      step(dtMs) { clk += dtMs; if (measT >= 0 && measT < PARAMS.dispMs + 400) measT += dtMs; },
      fire(r) {
        measT = 0;
        const a = assess(r);
        P0.say('Messung: ' + a.text, a.ampel === 'rot' ? 'warn' : 'info');
        return true;
      },
      onControl() { measT = -1; },
      reset() { measT = -1; clk = 0; },
      state(r) {
        const ok = r && r.ok !== false;
        return { riso: ok ? r.ins.rMOhm : 0, rpe: ok && r.pe ? r.pe.R : 0, iAbleit: ok ? r.ab.imA : 0, urteil: ok ? r.v.urteil : 0, statusText: ok ? r.v.text : '', gemessen: measT >= 0, fireT: Math.max(measT, 0) };
      }
    };
  }

  R.register({ id: 'isolation', name: 'Isolation und Schutzleiter', icon: '🧪',
    info: 'Isolationswiderstand als Parallelschaltung der Leckpfade, Schutzleiterwiderstand mit 2- und 4-Leiter-Messung, Ableitstrom über den Y-Kondensator (Übungswerte). Nur am freigeschalteten, getrennten Prüfling; Simulation.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'isolation', name: 'Isolation und Schutzleiter', icon: '🧪', info: '', world: { w: 960, h: 640 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
